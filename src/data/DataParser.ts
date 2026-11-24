// The indented-text parser — a faithful port of the reference's DataFile.cpp
// (endless-sky/source/DataFile.cpp).
//
// Rules:
// - Each non-empty, non-comment line is a node.
// - Indentation (spaces or tabs) determines nesting: a line more indented than
//   the previous node is its child; otherwise it is a sibling. Mixed
//   indentation within a file warns.
// - `#` starts a comment line (skips the whole line) or an in-line trailing
//   comment after a token.
// - `"quoted"` strings keep their content without quotes; backtick strings
//   (`...`) do the same and may contain quotes and spaces.
// - A missing closing quote is a warning, not an error (the token is kept).
// - Unquoted tokens run until the first char <= ' ' (space, tab, newline) —
//   exactly like the reference, which means a stray quote inside an unquoted
//   token is kept as part of the token.
// - The first line may start with a UTF-8 BOM, which is skipped.

import { DataNode } from './DataNode.ts';

export interface ParseOptions {
  // Called for each warning (missing quote, mixed indentation, ...).
  onWarn?: (message: string) => void;
}

const BOM = 0xfeff;

export function parseData(text: string, options: ParseOptions = {}): DataNode {
  const warn = options.onWarn ?? (() => {});

  if (text.charCodeAt(0) === BOM) text = text.slice(1);

  const root = new DataNode(null, 0);
  // (node, separators) stack; the root is pushed with separators = -1.
  const stack: { node: DataNode; separators: number }[] = [{ node: root, separators: -1 }];

  let fileIsTabs = false;
  let fileIsSpaces = false;
  let lineNumber = 0;

  const lines = text.split('\n');
  for (let raw of lines) {
    ++lineNumber;

      // Skip the newline-at-EOF artifact (the final empty segment after a
      // trailing newline is an empty line, and is skipped below).

      // Find the leading indentation.
      let i = 0;
      let separators = 0;
      let mixed = false;
      while (i < raw.length && raw[i].charCodeAt(0) <= 32) {
        const code = raw.charCodeAt(i);
        const ch = raw[i];
        if (!fileIsTabs && !fileIsSpaces) {
          if (ch === '\t') fileIsTabs = true;
          else if (ch === ' ') fileIsSpaces = true;
        } else if ((fileIsTabs && ch !== '\t') || (fileIsSpaces && ch !== ' ')) {
          mixed = true;
        }
        ++separators;
        ++i;
      }

      const rest = raw.slice(i);
      // Skip empty lines (whitespace-only) and comment lines.
      if (rest.length === 0) continue;
      if (rest[0] === '#') {
        if (mixed) warn(`mixed whitespace usage for comment at line ${lineNumber}`);
        continue;
      }

      // Place the node: pop nodes whose separators >= this line's separators.
      while (stack[stack.length - 1].separators >= separators) stack.pop();
      const parent = stack[stack.length - 1].node;
      const node = new DataNode(parent, lineNumber);
      parent.children.push(node);
      stack.push({ node, separators });

      // Tokenize. A trailing '#' ends the token list and skips the rest of the line.
      let j = 0;
      while (j < rest.length) {
        const ch = rest[j];
        if (ch <= ' ') { ++j; continue; }
        if (ch === '#') break; // trailing comment
        if (ch === '"' || ch === '`') {
          const end = rest.indexOf(ch, j + 1);
          if (end === -1) {
            // Missing closing quote: keep the token and warn.
            node.tokens.push(rest.slice(j + 1));
            warn(`closing quotation mark is missing (line ${lineNumber}: ${rest.slice(j)})`);
            j = rest.length; // the token ran to end of line
            continue;
          }
          node.tokens.push(rest.slice(j + 1, end));
          j = end + 1;
          continue;
        }
        // Unquoted token: any char > ' '.
        const start = j;
        while (j < rest.length && rest[j] > ' ') ++j;
        node.tokens.push(rest.slice(start, j));
      }

      if (mixed) warn(`mixed whitespace usage at line ${lineNumber}`);
    }

  return root;
}
