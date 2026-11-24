// A mission — the milestone-scoped subset of the reference's Mission
// (endless-sky/source/Mission.h/.cpp): identity, the offer/accept conditions,
// the substitutions the mission's text uses, and the two actions the start
// flow runs — the on-offer conversation and the on-accept log entries.
//
// The "Intro [0]" mission (New Boston start, "intro mission" conversation) is
// the only mission this milestone parses; the model itself is the shape the
// reference uses for every mission, so Milestone 2+ can grow it.

import type { DataNode } from '../data/DataNode.ts';
import type { ConditionsStore } from './ConditionsStore.ts';
import { ConditionSet, parseConditionSet } from './ConditionSet.ts';
import { GameAction } from './GameAction.ts';

export class Mission {
  // The mission's trueName (e.g. "Intro [0]") — also used as the condition
  // prefix for "offered"/"active"/"declined"/"done" tracking.
  name = '';
  displayName = '';
  description = '';
  landing = false;
  passengers = 0;
  source = '';
  destination = '';
  toOffer: ConditionSet;
  toAccept: ConditionSet;
  // Unconditional substitutions (e.g. "<trade>" → "stock up on medical goods").
  substitutions = new Map<string, string>();
  // The conversation the mission offers (by name) — e.g. "intro mission".
  onOfferConversation: string | null = null;
  // The on-accept action (log entries + condition assignments), applied when
  // the player accepts.
  onAccept: GameAction;

  constructor(conditions: ConditionsStore) {
    this.toOffer = emptyConditionSet(conditions);
    this.toAccept = emptyConditionSet(conditions);
    this.onAccept = new GameAction(conditions);
  }

  get title(): string {
    return this.displayName || this.name;
  }

  // Whether the mission may be offered right now (the reference: IsAtLocation +
  // CanOffer + CanAccept). For this milestone the player is always "landed" at
  // the source, so only the conditions are checked.
  isOfferable(): boolean {
    return this.toOffer.test() && this.toAccept.test();
  }
}

// The "no condition restriction" set (an AND with no children evaluates as
// true), like the reference's default ConditionSet.
function emptyConditionSet(conditions: ConditionsStore): ConditionSet {
  const set = new ConditionSet(conditions);
  set.operator = 'AND';
  set.children = [];
  return set;
}

// Parse a `mission "<name>"` node from the intro missions file.
export function parseMission(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): Mission {
  const mission = new Mission(conditions);
  mission.name = node.getSize() >= 2 ? node.token(1) : 'Unidentified Mission';

  for (const child of node.children) {
    const key = child.tokenOr(0);
    const hasValue = child.getSize() >= 2;

    if (key === 'name' && hasValue) {
      mission.displayName = child.token(1);
    } else if (key === 'description' && hasValue) {
      mission.description = child.token(1);
    } else if (key === 'landing') {
      mission.landing = true;
    } else if (key === 'passengers' && hasValue) {
      mission.passengers = child.value(1);
    } else if (key === 'source' && hasValue) {
      mission.source = child.token(1);
    } else if (key === 'destination' && hasValue) {
      mission.destination = child.token(1);
    } else if (key === 'to' && hasValue && child.token(1) === 'offer') {
      mission.toOffer = parseConditionSet(child, conditions, onWarn);
    } else if (key === 'to' && hasValue && child.token(1) === 'accept') {
      mission.toAccept = parseConditionSet(child, conditions, onWarn);
    } else if (key === 'substitutions' && child.hasChildren()) {
      for (const grand of child.children) {
        if (grand.getSize() >= 2) mission.substitutions.set(grand.token(0), grand.token(1));
        else if (grand.getSize() >= 1) onWarn?.(`mission "${mission.name}": substitution "${grand.token(0)}" has no replacement`);
      }
    } else if (key === 'on' && hasValue && child.token(1) === 'offer') {
      for (const grand of child.children) {
        if (grand.tokenOr(0) === 'conversation' && grand.getSize() >= 2) {
          mission.onOfferConversation = grand.token(1);
        }
      }
    } else if (key === 'on' && hasValue && child.token(1) === 'accept') {
      mission.onAccept = GameAction.parse(child, conditions, onWarn);
    }
    // Anything else (deadline, waypoint, npc, timers, "on complete", ...) is
    // Milestone 2+ — ignored on purpose.
  }

  if (mission.displayName.length === 0) mission.displayName = mission.name;
  return mission;
}
