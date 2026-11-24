// The starting-scenario model — a faithful port of the reference's
// StartConditions + CoreStartData (endless-sky/source/StartConditions.h/.cpp
// and CoreStartData.h/.cpp).
//
// The scenario model carries: the identity (identifier, display name,
// thumbnail), the info shown in the picker (description, system/planet/date/
// credits/debt, per state), the condition assignments applied to the pilot,
// and the conversation to run. World objects (systems/planets/ships) are
// Milestone 2+ — the names are carried through as strings; the conversation is
// parsed lazily at run time, against the player's live conditions store.

import { type DataNode } from '../data/DataNode.ts';
import { parseConditionSet, ConditionSet } from './ConditionSet.ts';
import { ConditionAssignments } from './ConditionAssignments.ts';
import { Account } from './Account.ts';
import { Date } from '../util/Date.ts';
import { AbbreviatedNumber } from '../util/Format.ts';
import type { ConditionsStore } from './ConditionsStore.ts';

export const StartState = {
  HIDDEN: 0,
  DISPLAYED: 1,
  REVEALED: 2,
  UNLOCKED: 3,
} as const;

export type StartState = (typeof StartState)[keyof typeof StartState];

export interface StartInfo {
  thumbnail: string | null;
  displayName: string;
  description: string;
  system: string;
  planet: string;
  date: Date | null;
  dateString: string;
  credits: string;
  debt: string;
}

function emptyStartInfo(): StartInfo {
  return {
    thumbnail: null,
    displayName: '',
    description: '',
    system: '',
    planet: '',
    date: null,
    dateString: '',
    credits: '',
    debt: '',
  };
}

export class CoreStartData {
  identifier = 'Unidentified Start';
  systemName = '';   // empty = unset (default Rutilicus)
  planetName = '';   // empty = unset (default New Boston)
  date: Date | null = null;
  account = new Account();

  getPlanet(): string {
    return this.planetName || 'New Boston';
  }

  getSystem(): string {
    return this.systemName || 'Rutilicus';
  }

  getDate(): Date {
    return this.date ?? new Date(16, 11, 3013);
  }

  getAccounts(): Account {
    return this.account;
  }
}

function parseEmptySet(conditions: ConditionsStore): ConditionSet {
  // No condition restriction: an AND with no children evaluates as true.
  const set = new ConditionSet(conditions);
  set.operator = 'AND';
  set.children = [];
  return set;
}

export class StartConditions {
  identifier = 'Unidentified Start';
  core = new CoreStartData();
  conditions = new ConditionAssignments(new (Object as any)());
  toDisplay: ConditionSet;
  toReveal: ConditionSet;
  toUnlock: ConditionSet;
  conversationNode: DataNode | null = null;
  conversationByName: string | null = null;
  state: StartState = StartState.HIDDEN;
  private infoByState = new Map<StartState, StartInfo>();

  constructor(conditions: ConditionsStore) {
    this.toDisplay = parseEmptySet(conditions);
    this.toReveal = parseEmptySet(conditions);
    this.toUnlock = parseEmptySet(conditions);
  }

  // --- loading ────────────────────────────────────────────────────────────

  static load(node: DataNode, globalConditions: ConditionsStore, playerConditions: ConditionsStore, onWarn?: (message: string) => void): StartConditions {
    const start = new StartConditions(playerConditions);
    const assignments = new ConditionAssignments(playerConditions);

    start.identifier = node.getSize() >= 2 ? node.tokens[1] : 'Unidentified Start';
    start.core.identifier = start.identifier;

    for (const child of node.children) {
      // The root node carries no operator; each of its children is handled.
      start.loadChild(child, globalConditions, playerConditions, assignments, onWarn);
    }

    // The UNLOCKED info: name/description/thumbnail from the root children,
    // with the planet/system/date/credits/debt resolved from the core data
    // (the reference's FinishLoading, done here eagerly).
    const unlocked = start.infoByState.get(StartState.UNLOCKED) ?? emptyStartInfo();
    unlocked.planet = start.core.getPlanet();
    unlocked.system = start.core.getSystem();
    unlocked.date = start.core.getDate();
    unlocked.credits = AbbreviatedNumber(start.core.getAccounts().credits);
    unlocked.debt = AbbreviatedNumber(start.core.getAccounts().totalDebt());
    start.infoByState.set(StartState.UNLOCKED, unlocked);

    // Fill the DISPLAYED/REVEALED states with "???" for missing fields and the
    // UNLOCKED thumbnail (like the reference's FillState).
    for (const state of [StartState.DISPLAYED, StartState.REVEALED]) {
      const info = start.infoByState.get(state) ?? emptyStartInfo();
      if (!info.thumbnail) info.thumbnail = start.infoByState.get(StartState.UNLOCKED)?.thumbnail ?? null;
      if (!info.displayName) info.displayName = '???';
      if (!info.description) info.description = '???';
      if (!info.system) info.system = '???';
      if (!info.planet) info.planet = '???';
      if (!info.dateString && !info.date) info.dateString = '???';
      if (!info.credits) info.credits = '???';
      if (!info.debt) info.debt = '???';
      start.infoByState.set(state, info);
    }

    start.conditions = assignments;
    return start;
  }

  private loadChild(child: DataNode, globalConditions: ConditionsStore, playerConditions: ConditionsStore, assignments: ConditionAssignments, onWarn?: (message: string) => void): void {
    const key = child.tokens[0];
    const hasValue = child.getSize() >= 2;
    const isAdd = key === 'add';
    const effectiveKey = isAdd ? child.tokens[1] : key;
    const valueIndex = isAdd ? 2 : 1;
    const hasValueFor = child.getSize() > valueIndex;

    // Core attributes (loaded into CoreStartData).
    if (effectiveKey === 'date' && !isAdd) {
      if (child.getSize() >= valueIndex + 3) {
        this.core.date = new Date(child.value(valueIndex), child.value(valueIndex + 1), child.value(valueIndex + 2));
      }
      // Core "date" is also loaded into the UNLOCKED state info below (same values).
      this.loadStateChild(child, this.unlockedInfo(), false, false, onWarn);
      return;
    }
    if (effectiveKey === 'system' && !isAdd) {
      if (hasValueFor) this.core.systemName = child.tokens[valueIndex];
      this.loadStateChild(child, this.unlockedInfo(), false, false, onWarn);
      return;
    }
    if (effectiveKey === 'planet' && !isAdd) {
      if (hasValueFor) this.core.planetName = child.tokens[valueIndex];
      this.loadStateChild(child, this.unlockedInfo(), false, false, onWarn);
      return;
    }
    if (effectiveKey === 'account' && !isAdd) {
      this.core.account = new Account(child, true);
      return;
    }

    // Conversation (a reference by name, or inline).
    if (effectiveKey === 'conversation') {
      if (child.hasChildren()) {
        this.conversationNode = child; // inline conversation
      } else if (hasValue) {
        this.conversationByName = child.tokens[isAdd ? 2 : 1];
      }
      return;
    }

    // Ship models — not implemented yet (Milestone 2+).
    if (effectiveKey === 'ship' || effectiveKey === 'ships') return;

    // State-visibility conditions (global conditions only).
    if (effectiveKey === 'to' && hasValueFor) {
      const value = child.tokens[valueIndex];
      if (value === 'display') this.toDisplay = parseConditionSet(child, globalConditions, onWarn);
      else if (value === 'reveal') this.toReveal = parseConditionSet(child, globalConditions, onWarn);
      else if (value === 'unlock') this.toUnlock = parseConditionSet(child, globalConditions, onWarn);
      return;
    }

    // "on display"/"on reveal" state info blocks.
    if (effectiveKey === 'on' && hasValueFor) {
      const value = child.tokens[valueIndex];
      if (value === 'display' || value === 'reveal') {
        this.loadStateChildren(child, value === 'display' ? StartState.DISPLAYED : StartState.REVEALED, onWarn);
      }
      return;
    }

    // The "add" keyword only supports the state attributes (mainly description).
    // isAdd is truthy for "add" lines.
    if (isAdd) {
      this.loadStateChild(child, this.unlockedInfo(), false, true, onWarn);
      return;
    }

    // Load the UNLOCKED state attributes (name/description/thumbnail/credits/debt).
    if (this.loadStateChild(child, this.unlockedInfo(), false, false, onWarn)) return;

    // Anything else: a condition assignment.
    assignments.add(child, onWarn);
  }

  private unlockedInfo(): StartInfo {
    let info = this.infoByState.get(StartState.UNLOCKED);
    if (!info) {
      info = emptyStartInfo();
      this.infoByState.set(StartState.UNLOCKED, info);
    }
    return info;
  }

  private loadStateChild(child: DataNode, info: StartInfo, _clearDescription: boolean, isAdd: boolean, onWarn?: (message: string) => void): boolean {
    const key = child.tokens[isAdd ? 1 : 0];
    const valueIndex = isAdd ? 2 : 1;
    const hasValue = child.getSize() > valueIndex;
    const value = child.tokens[hasValue ? valueIndex : 0];

    if (key === 'name' && hasValue) {
      info.displayName = value;
      return true;
    }
    if (key === 'description' && hasValue) {
      info.description += value + '\n';
      return true;
    }
    if (key === 'thumbnail' && hasValue) {
      info.thumbnail = value;
      return true;
    }
    if (key === 'system' && hasValue) {
      info.system = value;
      return true;
    }
    if (key === 'planet' && hasValue) {
      info.planet = value;
      return true;
    }
    if (key === 'date' && hasValue) {
      if (child.getSize() >= valueIndex + 3) {
        info.date = new Date(child.value(valueIndex), child.value(valueIndex + 1), child.value(valueIndex + 2));
      } else {
        info.dateString = value;
      }
      return true;
    }
    if (key === 'credits' && hasValue) {
      const n = Number(value);
      info.credits = Number.isFinite(n) && value.trim() !== '' ? AbbreviatedNumber(n) : value;
      return true;
    }
    if (key === 'debt' && hasValue) {
      const n = Number(value);
      info.debt = Number.isFinite(n) && value.trim() !== '' ? AbbreviatedNumber(n) : value;
      return true;
    }
    return false;
  }

  private loadStateChildren(node: DataNode, state: StartState, onWarn?: (message: string) => void): void {
    const info = emptyStartInfo();
    let clearDescription = false;
    for (const child of node.children) {
      if (!this.loadStateChild(child, info, clearDescription, false, onWarn)) {
        // Unknown — ignore (the reference logs a warning; keep it quiet for state info).
      }
    }
    this.infoByState.set(state, info);
  }

  // --- states ────────────────────────────────────────────────────────────

  visible(): boolean {
    return this.toDisplay.test();
  }

  setState(): void {
    if (this.toDisplay.test()) {
      if (this.toReveal.test()) {
        this.state = this.toUnlock.test() ? StartState.UNLOCKED : StartState.REVEALED;
      } else {
        this.state = StartState.DISPLAYED;
      }
    } else {
      this.state = StartState.HIDDEN;
    }
  }

  isUnlocked(): boolean {
    return this.state === StartState.UNLOCKED;
  }

  // --- accessors (read from the current state, like the reference) ---------

  private stateInfo(): StartInfo | null {
    return this.infoByState.get(this.state) ?? null;
  }

  getDisplayName(): string {
    const info = this.stateInfo();
    return info?.displayName || '???';
  }

  getDescription(): string {
    const info = this.stateInfo();
    return info?.description || '';
  }

  getPlanetName(): string {
    const info = this.stateInfo();
    return info?.planet || this.core.getPlanet();
  }

  getSystemName(): string {
    const info = this.stateInfo();
    return info?.system || this.core.getSystem();
  }

  getDateString(): string {
    const info = this.stateInfo();
    if (info?.date) return info.date.toString();
    if (info?.dateString) return info.dateString;
    return this.core.getDate().toString();
  }

  getThumbnail(): string | null {
    return this.stateInfo()?.thumbnail ?? null;
  }

  getCredits(): string {
    const info = this.stateInfo();
    if (info?.credits) return info.credits;
    return AbbreviatedNumber(this.core.getAccounts().credits);
  }

  getDebt(): string {
    const info = this.stateInfo();
    if (info?.debt) return info.debt;
    return AbbreviatedNumber(this.core.getAccounts().totalDebt());
  }

  // --- runtime ────────────────────────────────────────────────────────────

  // The conversation to run, parsed lazily at run time (against the player's
  // live conditions store).
  getConversationNode(): DataNode | null {
    return this.conversationNode;
  }

  getConversationByName(): string | null {
    return this.conversationByName;
  }

  getIdentifier(): string {
    return this.identifier;
  }
}
