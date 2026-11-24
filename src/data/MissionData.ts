// The intro mission — the first quest of a captain.
//
// Milestone-scoped loader for the New Boston start's `intro missions.txt`:
// the `conversation "intro mission"` that the mission offers and the mission
// `Intro [0]` that gates it. The file is fetched and parsed once (cached);
// the mission itself is re-parsed per run so its condition sets bind to the
// player's live conditions store. Everything else in the file is Milestone 2+.

import { parseData } from './DataParser';
import type { DataNode } from './DataNode';
import { fetchText } from './fetchText';
import { parseMission, type Mission } from '../game/Mission';
import type { ConditionsStore } from '../game/ConditionsStore';

export const INTRO_MISSION_NAME = 'Intro [0]';

export interface LoadedIntroMission {
  // The conversation the mission offers (unparsed; the conversation screen
  // parses it lazily at run time against the player's live conditions).
  conversationNode: DataNode | null;
  // The parsed mission for this player.
  mission: Mission;
}

const MISSIONS_URL = '/content/data/human/intro missions.txt';

// Pure parse: find the conversation + mission in a parsed intro missions root.
export function parseIntroMission(root: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): LoadedIntroMission {
  let conversationNode: DataNode | null = null;
  let missionNode: DataNode | null = null;
  for (const node of root.children) {
    if (node.tokenOr(0) === 'conversation' && node.tokenOr(1) === 'intro mission') {
      conversationNode = node;
    } else if (node.tokenOr(0) === 'mission' && node.tokenOr(1) === INTRO_MISSION_NAME) {
      missionNode = node;
    }
  }

  if (!missionNode) {
    throw new Error(`mission "${INTRO_MISSION_NAME}" not found in intro missions.txt`);
  }

  const mission = parseMission(missionNode, conditions, onWarn);
  return { conversationNode, mission };
}

let missionsPromise: Promise<DataNode> | null = null;

function loadMissionsFile(onWarn?: (message: string) => void): Promise<DataNode> {
  if (!missionsPromise) {
    const promise = (async () => {
      const text = await fetchText(MISSIONS_URL);
      return parseData(text, { onWarn });
    })();
    // A failed attempt must not poison later attempts — the next call refetches.
    promise.catch(() => { if (missionsPromise === promise) missionsPromise = null; });
    missionsPromise = promise;
  }
  return missionsPromise;
}

// Load the intro mission for the given conditions. The conversation node is
// shared (read-only); the mission is freshly parsed per run.
export async function loadIntroMission(
  conditions: ConditionsStore,
  onWarn?: (message: string) => void,
): Promise<LoadedIntroMission> {
  const root = await loadMissionsFile(onWarn);
  return parseIntroMission(root, conditions, onWarn);
}
