// The shipyard — the "Basic Ships" stock and the parsed ship models it sells.
//
// Milestone-scoped: the one shipyard the default flow needs (New Boston's
// "Basic Ships": Shuttle / Sparrow / Star Barge from `human/sales.txt`), parsed
// lazily and served from memory. Everything else (licenses, storage, sale
// of ships) is Milestone 2+.

import { parseData } from './DataParser';
import type { DataNode } from './DataNode';
import { fetchText } from './fetchText';
import { parseShip, type Ship } from '../game/Ship';

export interface Shipyard {
  name: string;
  ships: Ship[];
}

const SALES_URL = '/content/data/human/sales.txt';
const SHIPS_URL = '/content/data/human/ships.txt';

// Pure parse: resolve a named shipyard's stock from the parsed sales/ships
// files. Exported so tests can feed the real data in.
export function parseShipyard(salesNode: DataNode, shipsNode: DataNode, name: string, onWarn?: (message: string) => void): Shipyard {
  let stockNode: DataNode | null = null;
  for (const node of salesNode.children) {
    if (node.tokenOr(0) === 'shipyard' && node.tokenOr(1) === name) {
      stockNode = node;
      break;
    }
  }
  if (!stockNode) {
    throw new Error(`shipyard "${name}" not found in sales.txt`);
  }

  const ships: Ship[] = [];
  for (const entry of stockNode.children) {
    // Each child is a ship name line (no children) — e.g. `"Shuttle"`.
    if (entry.getSize() !== 1) {
      onWarn?.(`shipyard "${name}": unexpected entry: ${entry.tokens.join(' ')}`);
      continue;
    }
    const shipName = entry.tokens[0];
    const shipNode = shipsNode.children.find(n => n.tokenOr(0) === 'ship' && n.tokenOr(1) === shipName);
    if (!shipNode) {
      onWarn?.(`ship "${shipName}" not found in ships.txt`);
      continue;
    }
    ships.push(parseShip(shipNode));
  }

  return { name, ships };
}

// Load the named shipyard's stock, resolving each entry to its parsed ship.
// Every call fetches fresh — no memoized promise — so a failed load can be
// retried by simply calling again. The fetch is bounded (see fetchText).
export async function loadShipyard(
  name: string,
  onWarn?: (message: string) => void,
): Promise<Shipyard> {
  const [salesText, shipsText] = await Promise.all([
    fetchText(SALES_URL),
    fetchText(SHIPS_URL),
  ]);
  const salesNode = parseData(salesText, { onWarn });
  const shipsNode = parseData(shipsText, { onWarn });
  return parseShipyard(salesNode, shipsNode, name, onWarn);
}
