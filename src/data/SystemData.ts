// The system loader — fetches and parses a system from the reference's
// "map systems.txt". Systems are static world data, so the parsed file is
// memoized; per-system parses are cheap enough to do per call. Same bounded
//-fetch pattern as the planet/shipyard loaders: a stalled fetch shows an
// error state, never a silent hang.

import { parseData } from './DataParser';
import type { DataNode } from './DataNode';
import { fetchText } from './fetchText';
import { parseSystem, type System } from '../game/System';

const SYSTEMS_URL = '/content/data/map systems.txt';

let systemsPromise: Promise<DataNode> | null = null;

function loadSystemsFile(onWarn?: (message: string) => void): Promise<DataNode> {
  if (!systemsPromise) {
    const promise = (async () => {
      const text = await fetchText(SYSTEMS_URL);
      return parseData(text, { onWarn });
    })();
    // A failed attempt must not poison later attempts — the next call refetches.
    promise.catch(() => { if (systemsPromise === promise) systemsPromise = null; });
    systemsPromise = promise;
  }
  return systemsPromise;
}

// Load one system by name. Throws a clear error when the system is missing.
export async function loadSystem(name: string, onWarn?: (message: string) => void): Promise<System> {
  const root = await loadSystemsFile(onWarn);
  for (const node of root.children) {
    if (node.tokenOr(0) === 'system' && node.tokenOr(1) === name) {
      return parseSystem(node, onWarn);
    }
  }
  throw new Error(`system "${name}" not found in map systems.txt`);
}

// The neighbor systems of `system` (its `link` lines), in file order.
export function jumpNeighbors(system: System): string[] {
  return system.links;
}
