import { describe, expect, it } from 'vitest';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { GameAction } from './GameAction.ts';

// Tests mirror the reference's plain/special log handling in GameAction:
// plain `log "message"` entries, special `log <category> <heading> <message>`
// entries, and the condition assignments that are carried along.

function parseAction(text: string, store: ConditionsStore, warnings: string[] = []) {
  const root = parseData(`action\n${text.split('\n').map(l => `\t${l}`).join('\n')}\n`);
  return GameAction.parse(root.children[0], store, m => warnings.push(m));
}

describe('GameAction', () => {
  it('is empty for an empty action node', () => {
    const action = parseAction('', new ConditionsStore());
    expect(action.isEmpty()).toBe(true);
  });

  it('collects plain log entries with paragraphs', () => {
    const warnings: string[] = [];
    const action = parseAction('log "Finally scraped together my money."', new ConditionsStore(), warnings);
    expect(action.isEmpty()).toBe(false);
    expect(action.logEntries.length).toBe(1);
    expect(action.logEntries[0].paragraphs[0]).toContain('Finally scraped together');
  });

  it('collects special log entries with category, heading and paragraphs', () => {
    const warnings: string[] = [];
    const action = parseAction('log Factions Republic "Hundreds of years ago..."', new ConditionsStore(), warnings);
    expect(action.specialLogEntries.size).toBe(1);
    const headings = action.specialLogEntries.get('Factions');
    expect(headings?.get('Republic')?.paragraphs[0]).toContain('Hundreds of years ago');
  });

  it('skips scene items (kept for the UI, not the log store)', () => {
    const action = parseAction('log scene scene/lobby', new ConditionsStore());
    expect(action.logEntries.length).toBe(1); // the plain entry exists but the scene is skipped
  });

  it('carries condition assignments (set/clear/++/--/<op>)', () => {
    const store = new ConditionsStore();
    const action = parseAction('set "species: human"\nset "license: Pilot\'s"', store);
    const seen: string[] = [];
    action.apply(e => seen.push(e.paragraphs[0] ?? ''), (c, h, e) => seen.push(`${c}/${h}`), store);
    expect(store.has('species: human')).toBe(true);
    expect(store.has('license: Pilot\'s')).toBe(true);
  });

  it('applies log entries and assignments through apply()', () => {
    const store = new ConditionsStore();
    const action = parseAction('log "Line one."\nset "start: default"', store);
    const plain: string[] = [];
    const special: string[] = [];
    action.apply(e => plain.push(e.paragraphs[0] ?? ''), (c, h, e) => special.push(`${c}/${h}`), store);
    expect(plain).toContain('Line one.');
    expect(store.has('start: default')).toBe(true);
  });
});
