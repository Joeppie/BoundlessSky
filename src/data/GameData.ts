// The game-data registry — loads the content the start flow needs.
//
// Milestone 1 scope (faithful to the reference's loading, documented subset):
// - `data/starts.txt`: the start scenarios and their conversations. Everything
//   else (ships, systems, planets, outfits, ...) is Milestone 2+.
//
// Scenarios and conversations are parsed eagerly (the file is small); the
// conversation is parsed at run time, against the player's live conditions
// store, so condition checking always reflects the current player.

import { parseData } from './DataParser';
import type { DataNode } from './DataNode';
import { StartConditions, StartState } from '../game/StartConditions';
import { ConditionsStore } from '../game/ConditionsStore';

export interface LoadedGameData {
  starts: StartConditions[];
  // The raw conversation nodes, keyed by the conversation's name (all from
  // starts.txt for this milestone).
  conversationsByName: Map<string, DataNode>;
  // The starts whose visibility should be evaluated against the (empty)
  // global conditions.
  globalConditions: ConditionsStore;
  // The file name, for display/debug.
  source: string;
}

export interface LoadGameDataOptions {
  // Called when the setup has finished. Receives the number of ms spent.
  onProgress?: (fraction: number, message: string) => void;
}

const STARTS_URL = '/content/data/starts.txt';

// Load the game data the start flow needs. This is the one entry point the
// loading screen drives — it does real work (fetch + parse), so the UI can
// report an honest progress bar.
export async function loadGameData(onProgress?: (fraction: number, message: string) => void): Promise<LoadedGameData> {
  onProgress?.(0.05, 'Fetching start scenarios…');
  const response = await fetch(STARTS_URL, { credentials: 'omit' });
  if (!response.ok) throw new Error(`could not load ${STARTS_URL} (HTTP ${response.status})`);
  const text = await response.text();
  onProgress?.(0.35, 'Parsing start scenarios…');

  const warnings: string[] = [];
  const root = parseData(text, {
    onWarn: (message) => warnings.push(message),
  });

  onProgress?.(0.5, 'Finding conversations…');
  const conversationsByName = new Map<string, DataNode>();
  for (const node of root.children) {
    if (node.tokens[0] === 'conversation' && node.getSize() >= 2) {
      conversationsByName.set(node.tokens[1], node);
    }
  }

  onProgress?.(0.65, 'Loading scenarios…');
  const globalConditions = new ConditionsStore();
  const playerConditions = new ConditionsStore();

  const starts: StartConditions[] = [];
  for (const node of root.children) {
    if (node.tokens[0] !== 'start') continue;
    const start = StartConditions.load(node, globalConditions, playerConditions, (m) => warnings.push(m));
    start.setState();
    if (start.visible()) starts.push(start);
  }

  onProgress?.(0.85, 'Preparing the table…');
  return {
    starts,
    conversationsByName,
    globalConditions,
    source: STARTS_URL,
  };
}

export { StartState };
