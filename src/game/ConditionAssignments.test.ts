import { describe, expect, it } from 'vitest';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { ConditionAssignments } from './ConditionAssignments.ts';

// Tests mirror the reference's tests/unit/src/test_conditionAssignments.cpp:
// creation (empty/invalid/valid nodes) and applying assignments to a store.

function parse(text: string, store: ConditionsStore, warnings: string[] = []) {
  const root = parseData(`toplevel\n${text.split('\n').map(l => `\t${l}`).join('\n')}\n`);
  const assignments = new ConditionAssignments(store);
  for (const child of root.children[0].children) {
    assignments.add(child, m => warnings.push(m));
  }
  return assignments;
}

describe('ConditionAssignments', () => {
  it('is empty when nothing is added', () => {
    const store = new ConditionsStore();
    const assignments = parse('', store);
    expect(assignments.assignments.length).toBe(0);
  });

  it('ignores invalid nodes and warns (like the reference)', () => {
    const warnings: string[] = [];
    const assignments = parse('has', new ConditionsStore(), warnings);
    expect(assignments.assignments.length).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('parses "someCondition = 5"', () => {
    const store = new ConditionsStore();
    const assignments = parse('someCondition = 5', store);
    expect(assignments.assignments.length).toBe(1);
    assignments.apply(store);
    expect(store.get('someCondition')).toBe(5);
  });

  it('set/clear assignments write 1/0', () => {
    const store = new ConditionsStore();
    const assignments = parse('set "myPilot"\nclear "oldPilot"', store);
    assignments.apply(store);
    expect(store.has('myPilot')).toBe(true);
    expect(store.has('oldPilot')).toBe(false);
  });

  it('increments and decrements with ++/--', () => {
    const store = new ConditionsStore();
    const assignments = parse('points ++\npoints --', store);
    assignments.apply(store);
    expect(store.get('points')).toBe(0); // +1 then -1
    const assignments2 = parse('points ++', store);
    assignments2.apply(store);
    expect(store.get('points')).toBe(1);
  });

  it('applies +=, -=, *=, /=, <?=, >?= in order', () => {
    const store = new ConditionsStore();
    store.set('result', 10);
    const assignments = parse('result += 5\nresult -= 3\nresult *= 2\nresult /= 4\nresult <?= 100\nresult >?= 1', store);
    assignments.apply(store);
    // 10 + 5 - 3 = 12; 12 * 2 = 24; 24 / 4 = 6; min(6, 100) = 6; max(6, 1) = 6
    expect(store.get('result')).toBe(6);
  });

  it('evaluates the expression against the live store (like the reference)', () => {
    const store = new ConditionsStore();
    store.set('year', 3000);
    const assignments = parse('year2 = year + 13', store);
    assignments.apply(store);
    expect(store.get('year2')).toBe(3013);
  });

  it('warns on unsupported assignments and skips them', () => {
    const warnings: string[] = [];
    const assignments = parse('year ?= 3013', new ConditionsStore(), warnings);
    expect(assignments.assignments.length).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
