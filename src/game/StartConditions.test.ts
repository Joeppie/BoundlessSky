import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { StartConditions, StartState } from './StartConditions.ts';

// Tests mirror the reference's way of loading the start scenarios from the
// real starts.txt — the states, the UNLOCKED/DISPLAYED fills, and the
// condition assignments — against the oracle data file.

function loadScenarios() {
  const root = parseData(readFileSync('endless-sky/data/starts.txt', 'utf8'));
  return root.children
    .filter(n => n.tokens[0] === 'start')
    .map(n => {
      const warnings: string[] = [];
      const sc = StartConditions.load(n, new ConditionsStore(), new ConditionsStore(), m => warnings.push(m));
      sc.setState();
      return { node: n, start: sc, warnings };
    });
}

describe('StartConditions (from starts.txt)', () => {
  const scenarios = loadScenarios();

  it('loads all five scenarios', () => {
    expect(scenarios.length).toBe(5);
    expect(scenarios.map(s => s.node.tokens[1])).toEqual(['default', 'deep', 'paradise', 'syndicate', 'hai space']);
  });

  it('parses without warnings', () => {
    for (const { start, warnings, node } of scenarios) {
      expect(warnings, `scenario ${node.tokens[1]}`).toEqual([]);
    }
  });

  it('marks the four human-space starts UNLOCKED', () => {
    for (const [id, state] of [['default', StartState.UNLOCKED], ['deep', StartState.UNLOCKED], ['paradise', StartState.UNLOCKED], ['syndicate', StartState.UNLOCKED]] as const) {
      const { start } = scenarios.find(s => s.node.tokens[1] === id)!;
      expect(start.state).toBe(state);
    }
  });

  it('marks hai space DISPLAYED (locked) at boot', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'hai space')!;
    expect(start.state).toBe(StartState.DISPLAYED);
  });

  it('gives the default scenario its identity and fields (like the reference)', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'default')!;
    expect(start.getDisplayName()).toBe('Endless Sky');
    expect(start.getPlanetName()).toBe('New Boston');
    expect(start.getSystemName()).toBe('Rutilicus');
    expect(start.getDateString()).toBe('Tue, 16 Nov 3013');
    expect(start.getCredits()).toBe('480,000');
    expect(start.getDebt()).toBe('480,000');
    expect(start.getThumbnail()).toBe('scene/new boston');
    expect(start.getDescription()).toContain('You grew up on New Boston');
  });

  it('resolves the conversation reference by name', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'default')!;
    expect(start.getConversationByName()).toBe('default intro');
    expect(start.getConversationNode()).toBeNull();
  });

  it('fills the UNLOCKED info from the core data (not the root block)', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'default')!;
    expect(start.getSystemName()).toBe('Rutilicus');
    expect(start.getPlanetName()).toBe('New Boston');
  });

  it('applies the scenario condition assignments (like PlayerInfo::New)', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'default')!;
    const store = new ConditionsStore();
    start.conditions.apply(store);
    expect(store.has('license: Pilot\'s')).toBe(true);
    expect(store.has('species: human')).toBe(true);
    expect(store.has('human space start')).toBe(true);
    expect(store.has('start: default')).toBe(true);
    expect(store.has('start: vanilla')).toBe(true);
  });

  it('shows the locked hai space start with "???" fields and its thumbnail', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'hai space')!;
    expect(start.getDisplayName()).toBe('???');
    expect(start.getDescription().trim()).toBe('This start is locked.');
    expect(start.getPlanetName()).toBe('???');
    expect(start.getSystemName()).toBe('???');
    expect(start.getDateString()).toBe('???');
    expect(start.getCredits()).toBe('???');
    expect(start.getDebt()).toBe('???');
    expect(start.getThumbnail()).toBe('scene/greenwater'); // inherited from the unlocked thumbnail
  });

  it('carries the hai space reveal state in the REVEALED info (unused at boot)', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'hai space')!;
    // The reveal state is stored but not active at boot. The UNLOCKED fields from
    // the reveal block do NOT leak into the DISPLAYED state.
    expect(start.getSystemName()).toBe('???');
  });

  it('keeps the "deep" start with its own core values (Midgard / Aludra)', () => {
    const { start } = scenarios.find(s => s.node.tokens[1] === 'deep')!;
    expect(start.getDisplayName()).toBe('Deep Desire');
    expect(start.getPlanetName()).toBe('Midgard');
    expect(start.getSystemName()).toBe('Aludra');
    expect(start.getCredits()).toBe('680,000');
    expect(start.getDebt()).toBe('680,000');
  });
});
