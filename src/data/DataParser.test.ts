import { describe, expect, it } from 'vitest';
import { parseData } from './DataParser.ts';

// Tests mirror the reference's tests/unit/src/test_datafile.cpp (the oracle).

describe('parseData', () => {
  it('parses the default start scenario from the real data file', async () => {
    const fs = await import('node:fs');
    const text = fs.readFileSync('endless-sky/data/starts.txt', 'utf8');
    const root = parseData(text);
    expect(root.children.length).toBe(14);

    const start = root.children[0];
    expect(start.tokens).toEqual(['start', 'default']);
    expect(start.children.map(c => c.tokens[0])).toContain('name');
    expect(start.children.find(c => c.tokens[0] === 'name')?.tokens[1]).toBe('Endless Sky');
    expect(start.children.find(c => c.tokens[0] === 'system')?.tokens[1]).toBe('Rutilicus');
    expect(start.children.find(c => c.tokens[0] === 'planet')?.tokens[1]).toBe('New Boston');
    const date = start.children.find(c => c.tokens[0] === 'date');
    expect(date?.tokens.slice(1)).toEqual(['16', '11', '3013']);
    expect(start.children.find(c => c.tokens[0] === 'conversation')?.tokens[1]).toBe('default intro');
  });

  it('parses plain nodes with no indentation at the root', () => {
    const root = parseData('node1\n\tfoo\n\nnode2 hi\n\tsomething else\n\t\tgrand child\n');
    expect(root.children.length).toBe(2);
    expect(root.children[0].tokens[0]).toBe('node1');
    expect(root.children[1].tokens[0]).toBe('node2');
    expect(root.children[0].children[0].tokens[0]).toBe('foo');
    expect(root.children[1].children[0].tokens[0]).toBe('something');
    expect(root.children[1].children[0].children[0].tokens).toEqual(['grand', 'child']);
  });

  it('skips comment lines and inline comments', () => {
    const root = parseData('node1\n# comment line\nnode2 # trailing comment\n');
    expect(root.children.length).toBe(2);
    expect(root.children[1].tokens).toEqual(['node2']);
  });

  it('keeps quoted strings as one token (empty quoted token stays empty)', () => {
    const root = parseData('name ""\n');
    expect(root.children[0].tokens).toEqual(['name', '']);
  });

  it('keeps backtick strings with embedded quotes and spaces', () => {
    const root = parseData('description `The bank\'s \"futuristic\" statement`\n');
    expect(root.children[0].tokens[1]).toBe('The bank\'s "futuristic" statement');
  });

  it('warns and keeps a token with a missing closing quote', () => {
    const warnings: string[] = [];
    const root = parseData('"system Sol\n', { onWarn: m => warnings.push(m) });
    expect(root.children[0].tokens).toEqual(['system Sol']);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('closing quotation mark is missing');
  });

  it('keeps a stray quote inside an unquoted token without warning', () => {
    const warnings: string[] = [];
    const root = parseData('system" f\n\tthis is" ok"\n', { onWarn: m => warnings.push(m) });
    expect(root.children[0].tokens).toEqual(['system"', 'f']);
    expect(warnings.length).toBe(0);
  });

  it('warns on mixed indentation (tabs then spaces)', () => {
    const warnings: string[] = [];
    const root = parseData('system foo\n\tsomething\n\nnow with\n spaces\n', { onWarn: m => warnings.push(m) });
    // one warning per mixed line, matching the reference's single mixed-whitespace report
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('mixed whitespace usage at line 5');
  });

  it('warns on mixed indentation in comment lines only', () => {
    const warnings: string[] = [];
    const root = parseData('\nsystem foo\n\t# something\n\nnow with\n # spaces\n', { onWarn: m => warnings.push(m) });
    // the leading newline makes the mixed comment line line 6, like the reference test
    expect(root.children.length).toBe(2);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('comment at line 6');
  });

  it('treats an unterminated backtick as a token running to end of line', () => {
    const warnings: string[] = [];
    const root = parseData('description `unterminated\n', { onWarn: m => warnings.push(m) });
    expect(root.children[0].tokens).toEqual(['description', 'unterminated']);
    expect(warnings.length).toBe(1);
  });
});
