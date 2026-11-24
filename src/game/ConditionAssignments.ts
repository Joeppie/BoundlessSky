// Condition assignments — the `set`/`clear`/`++`/`--`/`name <op> <expr>`
// statements of a start scenario (or a conversation's action node).
//
// Faithful-enough subset of the reference's ConditionAssignments
// (endless-sky/source/ConditionAssignments.h/.cpp).

import { type DataNode } from '../data/DataNode.ts';
import type { ConditionsStore } from './ConditionsStore.ts';
import { ConditionSet, parseFlatExpression } from './ConditionSet.ts';

export type AssignOp = 'ASSIGN' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'LT' | 'GT';

export interface Assignment {
  condition: string;
  op: AssignOp;
  expression: ConditionSet;
}

const ASSIGN_OPS: Record<string, AssignOp> = {
  '=': 'ASSIGN',
  '+=': 'ADD',
  '-=': 'SUB',
  '*=': 'MUL',
  '/=': 'DIV',
  '<?=': 'LT',
  '>?=': 'GT',
};

export class ConditionAssignments {
  assignments: Assignment[] = [];
  conditions: ConditionsStore;

  constructor(conditions: ConditionsStore) {
    this.conditions = conditions;
  }

  add(node: DataNode, onWarn?: (message: string) => void): void {
    const key = node.token(0);

    if ((key === 'set' || key === 'clear') && node.getSize() === 2 && this.isConditionName(node.token(1))) {
      const literal = new ConditionSet(this.conditions);
      literal.operator = 'LIT';
      literal.literal = key === 'set' ? 1 : 0;
      this.assignments.push({ condition: node.token(1), op: 'ASSIGN', expression: literal });
      return;
    }

    if (node.getSize() === 2 && (node.token(1) === '++' || node.token(1) === '--') && this.isConditionName(key)) {
      const literal = new ConditionSet(this.conditions);
      literal.operator = 'LIT';
      literal.literal = 1;
      this.assignments.push({
        condition: key,
        op: node.token(1) === '++' ? 'ADD' : 'SUB',
        expression: literal,
      });
      return;
    }

    if (node.getSize() >= 3) {
      const op = ASSIGN_OPS[node.token(1)];
      if (!op || !this.isConditionName(key)) {
        onWarn?.(`unsupported assignment at line ${node.lineNumber}: ${node.tokens.join(' ')}`);
        return;
      }
      const expression = parseFlatExpression(node.tokens.slice(2), this.conditions);
      if (expression.operator === 'INVALID') {
        onWarn?.(`invalid assignment expression at line ${node.lineNumber}: ${node.tokens.join(' ')}`);
        return;
      }
      this.assignments.push({ condition: key, op, expression });
      return;
    }

    onWarn?.(`incomplete assignment at line ${node.lineNumber}: ${node.tokens.join(' ')}`);
  }

  // Apply all assignments to the given store, in order.
  apply(store: ConditionsStore): void {
    for (const assignment of this.assignments) {
      const value = assignment.expression.evaluate();
      const current = store.get(assignment.condition);
      switch (assignment.op) {
        case 'ASSIGN':
          store.set(assignment.condition, value);
          break;
        case 'ADD':
          store.set(assignment.condition, current + value);
          break;
        case 'SUB':
          store.set(assignment.condition, current - value);
          break;
        case 'MUL':
          store.set(assignment.condition, current * value);
          break;
        case 'DIV':
          store.set(assignment.condition, value ? Math.floor(current / value) : Number.MAX_SAFE_INTEGER);
          break;
        case 'LT':
          store.set(assignment.condition, Math.min(current, value));
          break;
        case 'GT':
          store.set(assignment.condition, Math.max(current, value));
          break;
      }
    }
  }

  // Load a whole block of assignments from a node's children.
  static fromChildren(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): ConditionAssignments {
    const assignments = new ConditionAssignments(conditions);
    for (const child of node.children) {
      assignments.add(child, onWarn);
    }
    return assignments;
  }

  private isConditionName(token: string): boolean {
    if (token.length === 0) return false;
    const code = token.charCodeAt(0);
    if (code < 65 || (code > 90 && (code < 97 || code > 122))) return false;
    const lower = token.toLowerCase();
    if (lower === 'true' || lower === 'false' || lower === '1' || lower === '0') return false;
    return !token.startsWith('"');
  }
}

export function parseAssignmentsFromNode(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): ConditionAssignments {
  // If the node itself is a single assignment (no children), add it directly;
  // otherwise add each child line.
  if (!node.hasChildren()) {
    const assignments = new ConditionAssignments(conditions);
    assignments.add(node, onWarn);
    return assignments;
  }
  return ConditionAssignments.fromChildren(node, conditions, onWarn);
}
