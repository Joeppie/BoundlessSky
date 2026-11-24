import { describe, expect, it } from 'vitest';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { parseConditionSet } from './ConditionSet.ts';

// Tests mirror the reference's tests/unit/src/test_conditionSet.cpp: the
// arithmetic, comparison, and/or, min/max and has/not/never expressions,
// using the reference's own GENERATE table (with the same syntax — note the
// spaces around parens, like the reference writes them).

function parse(text: string, store: ConditionsStore, warnings: string[] = []) {
  const root = parseData(`toplevel\n${text.split('\n').map(l => `\t${l}`).join('\n')}\n`);
  return parseConditionSet(root.children[0], store, m => warnings.push(m));
}

describe('ConditionSet', () => {
  it('is empty for a childless node', () => {
    const set = parseConditionSet(parseData('toplevel').children[0], new ConditionsStore());
    expect(set.isEmpty()).toBe(true);
  });

  it('marks a broken arithmetic expression as invalid and warns', () => {
    const warnings: string[] = [];
    const set = parse('4 +', new ConditionsStore(), warnings);
    expect(set.isEmpty()).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rejects leftover tokens (like the reference)', () => {
    const warnings: string[] = [];
    const set = parse('2 77', new ConditionsStore(), warnings);
    expect(set.isEmpty()).toBe(true);
  });

  // The reference's evaluation table (see test_conditionSet.cpp).
  const store = () => {
    const s = new ConditionsStore();
    s.set('event: war begins', 1);
    s.set('someData', 100);
    s.set('moreData', 100);
    s.set('otherData', 100);
    return s;
  };

  const simpleCases: [string, number][] = [
    ['never', 0],
    ['0', 0],
    ['1', 1],
    ['2 + 6', 8],
    ['2 + 6 * 8', 50],
    ['2 * ( 6 + 8 )', 28],
    ['( 2 + 6 ) * 8', 64],
    ['2 * ( 6 + 8 ) * 10', 280],
    ['2 + 6 * 8 * 4 + 5', 199],
    ['2 + 6 * 8 * 4 - 5 * 22 / 11', 184],
    ['60 / 5', 12],
    ['60 % 0', 60],
    ['60 % 50', 10],
    ['( ( 20 - ( ( 1000 ) ) + 50 ) )', -930],
    ['10 > 20', 0],
    ['10 < 20', 1],
    ['10 == 20', 0],
    ['10 <= 20', 1],
    ['10 == 10', 1],
    ['someData + 5 > moreData', 1],
    ['someData + 5 < moreData', 0],
    ['someData <= moreData', 1],
    ['moreData - 100', 0],
    ['otherData - 10 - 50 + -200', -160],
    ['max\n\t1\n\t10', 10],
    ['min\n\t1\n\t10', 1],
    ['max\n\t-30\n\t11', 11],
    ['min\n\t-30\n\t11', -30],
    ['4 + max ( 10 , 20 )', 24],
    ['4 + min ( 10 , -20 )', -16],
    ['max ( 10 , 20 )', 20],
    ['2 and 11', 2],
    ['11 and 2 and 5', 11],
    ['14 and 0 and 5', 0],
    ['0 or 11', 11],
    ['8 or 2 or 5', 8],
    ['0 or 0 or -7', -7],
    ['not someData', 0],
    ['not missingData', 1],
    ['has someData', 100],
  ];

  for (const [text, expected] of simpleCases) {
    it(`evaluates "${text.replace(/\n/g, ' ')}" to ${expected}`, () => {
      const set = parse(text, store());
      expect(set.isEmpty()).toBe(false);
      expect(set.evaluate()).toBe(expected);
    });
  }

  it('evaluates "and"-combined bare lines to the first non-zero value', () => {
    const set = parse('3\n2\n5', store());
    expect(set.evaluate()).toBe(3);
  });

  it('evaluates "or" blocks to the first non-zero child', () => {
    const set = parse('or\n\t0\n\t-7', store());
    expect(set.evaluate()).toBe(-7);
  });

  it('reports invalid arithmetic (and warns)', () => {
    const warnings: string[] = [];
    parse('4 + 6 +', store(), warnings);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
