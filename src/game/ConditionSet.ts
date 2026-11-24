// The condition-set expression evaluator — a faithful subset of the reference's
// ConditionSet (endless-sky/source/ConditionSet.h/.cpp).
//
// Supported language (the forms used by the start flow):
// - literals (480000), condition names (license: Pilot's) and the special
//   `has "<name>"` / `not "<name>"` / `never` nodes
// - `and` / `or` / `min` / `max` single-parent blocks
// - bare child lines, always AND-combined (the toplevel rule)
// - flat expressions: `(` `)` arithmetic (`+ - * / %`), comparisons
//   (`== != < <= > >=`), `and` / `or`
//
// Anything unsupported marks the set INVALID — the reference's failure mode (the
// set evaluates as never-true and a warning is logged).

import { type DataNode } from '../data/DataNode.ts';
import type { ConditionsStore } from './ConditionsStore.ts';

export type ExpressionOp =
  | 'INVALID' | 'LIT' | 'VAR'
  | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD' | 'MIN' | 'MAX'
  | 'EQ' | 'NE' | 'LE' | 'GE' | 'LT' | 'GT'
  | 'AND' | 'OR';

const OP_RANK: Record<string, number> = {
  '*': 6, '/': 6, '%': 6,
  '+': 5, '-': 5,
  '==': 3, '!=': 3, '>': 3, '<': 3, '>=': 3, '<=': 3,
  'and': 0, 'or': 0,
};

export class ConditionSet {
  operator: ExpressionOp = 'AND';
  literal = 0;
  conditionName = '';
  children: ConditionSet[] = [];
  conditions: ConditionsStore;

  constructor(conditions: ConditionsStore) {
    this.conditions = conditions;
  }

  isEmpty(): boolean {
    return (this.operator === 'AND' && this.children.length === 0) || this.operator === 'INVALID';
  }

  evaluate(): number {
    switch (this.operator) {
      case 'VAR':
        return this.conditions.get(this.conditionName);
      case 'LIT':
        return this.literal;
      case 'AND': {
        if (this.children.length === 0) return 1;
        let result = 0;
        for (const child of this.children) {
          const childResult = child.evaluate();
          if (!childResult) return 0;
          if (!result) result = childResult;
        }
        return result;
      }
      case 'OR': {
        for (const child of this.children) {
          const childResult = child.evaluate();
          if (childResult) return childResult;
        }
        return 0;
      }
      case 'MIN':
        return Math.min(...this.children.map(c => c.evaluate()));
      case 'MAX':
        return Math.max(...this.children.map(c => c.evaluate()));
      case 'ADD':
        return this.children.reduce((sum, c) => sum + c.evaluate(), 0);
      case 'SUB':
        return this.children.reduce((diff, c, i) => (i === 0 ? c.evaluate() : diff - c.evaluate()), 0);
      case 'MUL':
        return this.children.reduce((product, c) => product * c.evaluate(), 1);
      case 'DIV': {
        let quotient = this.children[0].evaluate();
        for (const child of this.children.slice(1)) {
          const divisor = child.evaluate();
          quotient = divisor ? Math.floor(quotient / divisor) : Number.MAX_SAFE_INTEGER;
        }
        return quotient;
      }
      case 'MOD': {
        let remainder = this.children[0].evaluate();
        for (const child of this.children.slice(1)) {
          const divisor = child.evaluate();
          remainder = divisor ? remainder % divisor : remainder;
        }
        return remainder;
      }
      case 'EQ': return this.children.length === 2 && this.children[0].evaluate() === this.children[1].evaluate() ? 1 : 0;
      case 'NE': return this.children.length === 2 && this.children[0].evaluate() !== this.children[1].evaluate() ? 1 : 0;
      case 'LE': return this.children.length === 2 && this.children[0].evaluate() <= this.children[1].evaluate() ? 1 : 0;
      case 'GE': return this.children.length === 2 && this.children[0].evaluate() >= this.children[1].evaluate() ? 1 : 0;
      case 'LT': return this.children.length === 2 && this.children[0].evaluate() < this.children[1].evaluate() ? 1 : 0;
      case 'GT': return this.children.length === 2 && this.children[0].evaluate() > this.children[1].evaluate() ? 1 : 0;
      default:
        return 0;
    }
  }

  test(): boolean {
    return this.evaluate() !== 0;
  }
}

function isConditionName(token: string): boolean {
  // Faithful to DataNode::IsConditionName: starts with a letter, not a bool
  // literal, not a quoted string.
  if (token.length === 0) return false;
  const code = token.charCodeAt(0);
  if (code < 65 || (code > 90 && (code < 97 || code > 122))) return false;
  const lower = token.toLowerCase();
  if (lower === 'true' || lower === 'false' || lower === '1' || lower === '0') return false;
  return !token.startsWith('"');
}

function isNumber(token: string): boolean {
  if (token.length === 0) return false;
  return /^[+-]?[0-9]*[.]?[0-9]*([eE][+-]?[0-9]*)?$/.test(token) && !/^[+-]$/.test(token);
}

export function parseConditionSet(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): ConditionSet {
  const set = new ConditionSet(conditions);
  // The top node is always an "and" node — the reference's top-level rule.
  set.operator = 'AND';
  try {
    if (!node.hasChildren()) {
      set.operator = 'INVALID';
      onWarn?.('Condition set has no child nodes.');
      return set;
    }
    set.children = node.children.map(child => {
      const c = new ConditionSet(conditions);
      parseFromStart(c, child, conditions, onWarn);
      return c;
    });
    if (set.children.some(c => c.operator === 'INVALID')) {
      set.operator = 'INVALID';
      return set;
    }
  } catch (error) {
    set.operator = 'INVALID';
    onWarn?.(`condition parse failed at line ${node.lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return set;
}

function parseFromStart(set: ConditionSet, node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): void {
  const tokens = node.tokens;
  const head = tokens[0] ?? '';

  // and / or / min / max with a single token are single-parent blocks.
  if (tokens.length === 1 && (head === 'and' || head === 'or' || head === 'min' || head === 'max')) {
    set.operator = (head === 'and' ? 'AND' : head === 'or' ? 'OR' : head === 'min' ? 'MIN' : 'MAX') as ExpressionOp;
    if (!node.hasChildren()) {
      set.operator = 'INVALID';
      onWarn?.(`condition block "${head}" has no child nodes (line ${node.lineNumber}).`);
      return;
    }
    set.children = node.children.map(child => {
      const c = new ConditionSet(conditions);
      parseFromStart(c, child, conditions, onWarn);
      return c;
    });
    if (set.children.some(c => c.operator === 'INVALID')) {
      set.operator = 'INVALID';
    }
    return;
  }

  // Nodes beyond this point should not have children (like the reference).
  if (node.hasChildren()) {
    set.operator = 'INVALID';
    onWarn?.(`unexpected child nodes (line ${node.lineNumber}: ${tokens.join(' ')}).`);
    return;
  }

  if (head === 'never' && tokens.length === 1) {
    set.operator = 'LIT';
    set.literal = 0;
    return;
  }
  if (head === 'has' && tokens.length === 2 && isConditionName(tokens[1])) {
    set.operator = 'VAR';
    set.conditionName = tokens[1];
    return;
  }
  if (head === 'not' && tokens.length === 2 && isConditionName(tokens[1])) {
    const left = new ConditionSet(conditions);
    left.operator = 'VAR';
    left.conditionName = tokens[1];
    const right = new ConditionSet(conditions);
    right.operator = 'LIT';
    right.literal = 0;
    set.operator = 'EQ';
    set.children = [left, right];
    return;
  }

  if (!parseFlat(set, tokens, 0, conditions)) {
    set.operator = 'INVALID';
    onWarn?.(`cannot parse condition expression (line ${node.lineNumber}: ${tokens.join(' ')}).`);
    return;
  }
}

// A precedence-climbing flat-expression parser.
const PRECEDENCE: Record<string, number> = {
  '*': 6, '/': 6, '%': 6,
  '+': 5, '-': 5,
  '==': 3, '!=': 3, '>': 3, '<': 3, '>=': 3, '<=': 3,
  'and': 0, 'or': 0,
};

const TOKEN_OPERATOR: Record<string, ExpressionOp> = {
  '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '%': 'MOD',
  '==': 'EQ', '!=': 'NE', '>': 'GT', '<': 'LT', '>=': 'GE', '<=': 'LE',
  'and': 'AND', 'or': 'OR',
};

function parseFlat(set: ConditionSet, tokens: string[], startIndex: number, conditions: ConditionsStore): boolean {
  let pos = startIndex;

  function peek(): string {
    return tokens[pos] ?? '';
  }

  function next(): string {
    return tokens[pos++] ?? '';
  }

  function parseExpression(minRank: number): ConditionSet {
    let left = parsePrefix();
    if (left.operator === 'INVALID') return left;
    while (true) {
      const token = peek();
      if (token === '') break;
      const rank = PRECEDENCE[token];
      if (rank === undefined) break;
      if (rank < minRank) break;
      next();
      const right = parseExpression(rank + 1);
      if (right.operator === 'INVALID') {
        const invalid = new ConditionSet(conditions);
        invalid.operator = 'INVALID';
        return invalid;
      }
      const node = new ConditionSet(conditions);
      node.operator = TOKEN_OPERATOR[token] as ExpressionOp;
      node.children = [left, right];
      left = node;
    }
    return left;
  }

  function parsePrefix(): ConditionSet {
    const token = peek();
    if (token === '(') {
      next();
      const node = parseExpression(0);
      if (peek() === ')') {
        next();
      } else {
        const invalid = new ConditionSet(conditions);
        invalid.operator = 'INVALID';
        return invalid;
      }
      return node;
    }
    // min / max function calls: `max ( expr , expr , ... )`
    if (token === 'min' || token === 'max') {
      // Require the function form: `min ( ... )`
      const functionToken = next();
      if (peek() !== '(') {
        // Not a function call — treat the bare keyword as a condition name (INVALID).
        const invalid = new ConditionSet(conditions);
        invalid.operator = 'INVALID';
        return invalid;
      }
      next(); // consume '('
      const children: ConditionSet[] = [];
      while (true) {
        const child = parseExpression(0);
        if (child.operator === 'INVALID') {
          const invalid = new ConditionSet(conditions);
          invalid.operator = 'INVALID';
          return invalid;
        }
        children.push(child);
        if (peek() === ',') {
          next();
          continue;
        }
        break;
      }
      if (peek() !== ')') {
        const invalid = new ConditionSet(conditions);
        invalid.operator = 'INVALID';
        return invalid;
      }
      next(); // consume ')'
      const node = new ConditionSet(conditions);
      node.operator = functionToken === 'min' ? 'MIN' : 'MAX';
      node.children = children;
      return node;
    }
    next(); // consume the first token
    if (isNumber(token)) {
      const node = new ConditionSet(conditions);
      node.operator = 'LIT';
      node.literal = Number(token);
      return node;
    }
    if (isConditionName(token)) {
      const node = new ConditionSet(conditions);
      node.operator = 'VAR';
      node.conditionName = token;
      return node;
    }
    const invalid = new ConditionSet(conditions);
    invalid.operator = 'INVALID';
    return invalid;
  }

  const tree = parseExpression(0);
  if (tree.operator === 'INVALID' || pos < tokens.length) {
    const invalid = new ConditionSet(conditions);
    invalid.operator = 'INVALID';
    return false;
  }
  set.operator = tree.operator;
  set.literal = tree.literal;
  set.conditionName = tree.conditionName;
  set.children = tree.children;
  return true;
}

export function parseFlatExpression(tokens: string[], conditions: ConditionsStore): ConditionSet {
  const set = new ConditionSet(conditions);
  if (!parseFlat(set, tokens, 0, conditions)) {
    return new ConditionSet(conditions); // operator INVALID by construction
  }
  return set;
}
