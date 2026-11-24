// A node in the parsed indented-text tree.
//
// Faithful to the reference's DataNode (endless-sky/source/DataNode.h/.cpp):
// - `tokens`: the line's tokens, with quoted strings stored without their quotes.
// - `children`: indented child nodes, in document order.
// - `parent`: the node this node was parsed as a child of.
// - `lineNumber`: 1-based line this node was parsed from.

export class DataNode {
  tokens: string[] = [];
  children: DataNode[] = [];
  parent: DataNode | null;
  lineNumber: number;

  constructor(parent: DataNode | null = null, lineNumber = 0) {
    this.parent = parent;
    this.lineNumber = lineNumber;
  }

  getSize(): number {
    return this.tokens.length;
  }

  token(index: number): string {
    if (index < 0 || index >= this.tokens.length) {
      throw new Error(`node has no token at index ${index} (line ${this.lineNumber}: ${this.tokens.join(' ')})`);
    }
    return this.tokens[index];
  }

  // Safe version of token(): returns "" when missing.
  tokenOr(index: number): string {
    return index >= 0 && index < this.tokens.length ? this.tokens[index] : '';
  }

  value(index: number): number {
    const raw = this.tokenOr(index);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  hasChildren(): boolean {
    return this.children.length > 0;
  }

  // A printable path for warnings, e.g. "start > conversation > name".
  path(): string {
    const parts: string[] = [];
    let node: DataNode | null = this;
    while (node && node.parent) {
      parts.unshift(node.tokens[0] ?? '(empty)');
      node = node.parent;
    }
    return parts.join(' > ');
  }

  describe(): string {
    return `${this.tokens[0] ?? '(empty)'} (line ${this.lineNumber})`;
  }
}
