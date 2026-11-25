// The shipyard — the stock the planet's named shipyards sell, parsed lazily
// and served from memory. Milestone-scoped: one purchase, no licenses,
// fleet management or storage (Milestone 2+). Every call fetches fresh — no
// memoized promise — so a failed load can be retried by simply calling again.

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

// Resolve the stock of the named shipyards — the union of their ships,
// deduped by model name, like the reference's shipyardStock. Exported so
// tests can feed the real data in. Throws a clear error when any named shop
// is missing — the planet cannot serve it.
export function parseShipyards(
  salesNode: DataNode,
  shipsNode: DataNode,
  names: string[],
  onWarn?: (message: string) => void,
): Shipyard {
  const ships: Ship[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const shipyard = parseShipyard(salesNode, shipsNode, name, onWarn);
    for (const ship of shipyard.ships) {
      if (!seen.has(ship.name)) {
        seen.add(ship.name);
        ships.push(ship);
      }
    }
  }
  return { name: names.join(' / '), ships };
}

// Load the stock of the named shipyards, resolving each entry to its parsed
// ship. Every call fetches fresh — no memoized promise — so a failed load can
// be retried by simply calling again. The fetch is bounded (see fetchText).
export async function loadShipyards(
  names: string[],
  onWarn?: (message: string) => void,
): Promise<Shipyard> {
  const [salesText, shipsText] = await Promise.all([
    fetchText(SALES_URL),
    fetchText(SHIPS_URL),
  ]);
  const salesNode = parseData(salesText, { onWarn });
  const shipsNode = parseData(shipsText, { onWarn });
  return parseShipyards(salesNode, shipsNode, names, onWarn);
}
