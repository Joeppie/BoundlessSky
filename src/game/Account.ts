// A mortgage — the loan attached to a start scenario's account.
//
// Faithful-enough subset of the reference's Mortgage (endless-sky/source/Mortgage.h).

import { type DataNode } from '../data/DataNode.ts';

export class Mortgage {
  type = 'Mortgage';
  principal = 0;
  interest = 0;
  term = 1;

  constructor(node?: DataNode) {
    if (node) this.load(node);
  }

  private load(node: DataNode): void {
    if (node.getSize() >= 2) this.type = node.token(1);
    for (const child of node.children) {
      const key = child.tokens[0];
      if (key === 'principal' && child.getSize() >= 2) {
        this.principal = child.value(1);
      } else if (key === 'interest' && child.getSize() >= 2) {
        this.interest = child.value(1);
      } else if (key === 'term' && child.getSize() >= 2) {
        this.term = Math.max(1, child.value(1));
      }
    }
  }
}

// The player's account — credits, credit score and mortgages.
//
// Faithful-enough subset of the reference's Account (endless-sky/source/Account.h):
// loading, credits, and total debt. Income/payout mechanics are Milestone 4.

export class Account {
  credits = 0;
  creditScore = 400;
  mortgages: Mortgage[] = [];

  constructor(node?: DataNode, clearFirst = true) {
    if (node) this.load(node, clearFirst);
  }

  private load(node: DataNode, clearFirst: boolean): void {
    if (clearFirst) {
      this.credits = 0;
      this.creditScore = 400;
      this.mortgages = [];
    }
    for (const child of node.children) {
      const key = child.tokens[0];
      if (key === 'credits' && child.getSize() >= 2) {
        this.credits = child.value(1);
      } else if (key === 'score' && child.getSize() >= 2) {
        this.creditScore = child.value(1);
      } else if (key === 'mortgage') {
        this.mortgages.push(new Mortgage(child));
      }
    }
  }

  // Total debt across all mortgages (principal amounts).
  totalDebt(): number {
    return this.mortgages.reduce((sum, m) => sum + m.principal, 0);
  }
}
