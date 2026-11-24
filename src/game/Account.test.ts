import { describe, expect, it } from 'vitest';
import { parseData } from '../data/DataParser.ts';
import { Account } from './Account.ts';

// Tests mirror the reference's tests/unit/src/test_account.cpp: loading the
// scenario's account block (credits, score, mortgages) and the debt total.

describe('Account', () => {
  it('loads credits and credit score from the account block', () => {
    const root = parseData(`account
\tcredits 480000
\tscore 500\n`);
    const node = root.children[0];
    const account = new Account(node);
    expect(account.credits).toBe(480000);
    expect(account.creditScore).toBe(500);
  });

  it('defaults the score to 400 when not given (like the reference)', () => {
    const root = parseData(`account
\tcredits 120000\n`);
    const account = new Account(root.children[0]);
    expect(account.credits).toBe(120000);
    expect(account.creditScore).toBe(400);
  });

  it('loads each mortgage and totals the debt across mortgages', () => {
    const root = parseData(`account
\tcredits 100000
\tmortgage Mortgage
\t\tprincipal 200000
\t\tinterest 0.004
\t\tterm 365
\tmortgage Second mortgage
\t\tprincipal 150000
\t\tinterest 0.002
\t\tterm 100
`);
    const account = new Account(root.children[0]);
    expect(account.mortgages.length).toBe(2);
    expect(account.mortgages[0].principal).toBe(200000);
    expect(account.mortgages[0].interest).toBeCloseTo(0.004);
    expect(account.mortgages[0].term).toBe(365);
    expect(account.mortgages[1].principal).toBe(150000);
    expect(account.mortgages[1].type).toBe('Second');
    expect(account.totalDebt()).toBe(350000);
  });

  it('caps the mortgage term at 1 (like the reference)', () => {
    const root = parseData(`account
\tmortgage Mortgage
\t\tprincipal 10000
\t\tterm 0
`);
    const account = new Account(root.children[0]);
    expect(account.mortgages[0].term).toBe(1);
  });

  it('starts empty when the account block is absent', () => {
    const account = new Account();
    expect(account.credits).toBe(0);
    expect(account.creditScore).toBe(400);
    expect(account.totalDebt()).toBe(0);
  });
});
