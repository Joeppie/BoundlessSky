// The planet loader — fetches and parses the start scenario's planet from the
// reference's `map planets.txt`. Milestone-1 scoped to one planet (the start
// planet); everything else (systems, world model) is Milestone 2+.

import { parseData } from './DataParser';
import type { DataNode } from './DataNode';
import { fetchText } from './fetchText';
import { parsePlanet, type Planet } from '../game/Planet';
import type { ConditionsStore } from '../game/ConditionsStore';

const PLANETS_URL = '/content/data/map planets.txt';

let planetsPromise: Promise<DataNode> | null = null;

function loadPlanetsFile(onWarn?: (message: string) => void): Promise<DataNode> {
  if (!planetsPromise) {
    const promise = (async () => {
      const text = await fetchText(PLANETS_URL);
      return parseData(text, { onWarn });
    })();
    // A failed attempt must not poison later attempts — the next call refetches.
    promise.catch(() => { if (planetsPromise === promise) planetsPromise = null; });
    planetsPromise = promise;
  }
  return planetsPromise;
}

// Load the planet named by the start scenario. The result is re-parsed per
// call (the description conditions evaluate against the LIVE conditions store).
export async function loadPlanet(
  name: string,
  conditions: ConditionsStore,
  onWarn?: (message: string) => void,
): Promise<Planet> {
  const root = await loadPlanetsFile(onWarn);
  for (const node of root.children) {
    if (node.tokenOr(0) === 'planet' && node.tokenOr(1) === name) {
      return parsePlanet(node, conditions, onWarn);
    }
  }
  throw new Error(`planet "${name}" not found in map planets.txt`);
}
