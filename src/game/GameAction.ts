// The game action performed by a conversation's `action` node — a faithful
// subset of the reference's GameAction (endless-sky/source/GameAction.h/.cpp).
//
// Supported (the forms the start conversation uses):
// - `log "<message>"` — a plain log entry
// - `log <category> <heading> "<message>"` — a special log entry, with
//   continuation children (one paragraph each)
// - condition assignments (`set`/`clear`/`++`/`--`/`name <op> <expr>`)
//
// Any other key is treated as a condition assignment, like the reference's
// else branch — unsupported action kinds (ships, events, music, messages)
// land in the conditions parser and simply do nothing harmful.

import { type DataNode } from '../data/DataNode.ts';
import type { ConditionsStore } from './ConditionsStore.ts';
import { ConditionAssignments } from './ConditionAssignments.ts';

export class BookEntry {
  // Paragraphs of text, in document order.
  paragraphs: string[] = [];

  static fromNode(node: DataNode, startAt: number): BookEntry {
    const entry = new BookEntry();
    for (const child of node.children) {
      if (child.tokens[0] === 'scene') continue; // scene items are the UI's job
      entry.paragraphs.push(child.tokens.join('\n\t'));
    }
    if (node.getSize() - startAt >= 1) {
      const text = node.tokens.slice(startAt).join('\n\t');
      if (text) entry.paragraphs.push(text);
    }
    return entry;
  }
}

export class GameAction {
  logEntries: BookEntry[] = [];
  specialLogEntries = new Map<string, Map<string, BookEntry>>();
  conditions: ConditionAssignments;

  constructor(conditions: ConditionsStore) {
    this.conditions = new ConditionAssignments(conditions);
  }

  static parse(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): GameAction {
    const action = new GameAction(conditions);
    action.load(node, conditions, onWarn);
    return action;
  }

  private load(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): void {
    for (const child of node.children) {
      this.loadSingle(child, conditions, onWarn);
    }
  }

  private loadSingle(child: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): void {
    const key = child.tokens[0];

    if (key === 'log') {
      if (child.getSize() >= 3 && child.token(1) !== 'scene') {
        // Special log: log <category> <heading> [<message>]
        const category = child.token(1);
        const heading = child.token(2);
        if (!this.specialLogEntries.has(category)) this.specialLogEntries.set(category, new Map());
        const entry = new BookEntry();
        const message = child.tokens.slice(3).join('\n\t');
        if (message) entry.paragraphs.push(message);
        for (const grand of child.children) {
          if (grand.tokens[0] === 'scene') continue;
          entry.paragraphs.push(grand.tokens.join('\n\t'));
        }
        this.specialLogEntries.get(category)!.set(heading, entry);
      } else {
        // Plain log: log [<message>]
        const entry = new BookEntry();
        const message = child.tokens.slice(1).join('\n\t');
        if (message) entry.paragraphs.push(message);
        for (const grand of child.children) {
          if (grand.tokens[0] === 'scene') continue;
          entry.paragraphs.push(grand.tokens.join('\n\t'));
        }
        this.logEntries.push(entry);
      }
      return;
    }

    // Everything else is a condition assignment (per the reference's else branch).
    this.conditions.add(child, onWarn);
  }

  isEmpty(): boolean {
    return this.logEntries.length === 0 && this.specialLogEntries.size === 0 && this.conditions.assignments.length === 0;
  }

  // Apply the action's effects to the player, mirroring the reference's Do().
  apply(
    addLogEntry: (entry: BookEntry) => void,
    addSpecialLog: (category: string, heading: string, entry: BookEntry) => void,
    store: ConditionsStore,
  ): void {
    for (const entry of this.logEntries) addLogEntry(entry);
    for (const [category, headings] of this.specialLogEntries) {
      for (const [heading, entry] of headings) addSpecialLog(category, heading, entry);
    }
    this.conditions.apply(store);
  }
}
