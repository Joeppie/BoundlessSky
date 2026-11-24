import { describe, expect, it } from 'vitest';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { Conversation, endpointTokenIndex } from './Conversation.ts';

// Tests covering the conversation engine: parsing the reference's default
// intro (faithful to the real conversation in starts.txt) and the synthetic
// branch/choice/goto routing shapes.

function getStartConversation() {
  const fs = require('node:fs');
  const text = fs.readFileSync('endless-sky/data/starts.txt', 'utf8');
  const root = parseData(text);
  const node = root.children.find(n => n.tokens[0] === 'conversation' && n.tokens[1] === 'default intro');
  if (!node) throw new Error('default intro conversation not found');
  return node;
}

describe('Conversation (default intro from starts.txt)', () => {
  const store = new ConditionsStore();
  const warnings: string[] = [];
  const conv = Conversation.parse(getStartConversation(), store, m => warnings.push(m));

  it('parses without warnings or unresolved labels', () => {
    expect(warnings.length).toBe(0);
  });

  it('is a valid intro (has an empty choice node = the name prompt)', () => {
    expect(conv.isValidIntro()).toBe(true);
  });

  it('parses 4 nodes: action, text (with scene), name prompt, final text', () => {
    expect(conv.nodes.length).toBe(4);
    expect(conv.isAction(0)).toBe(true);
    expect(conv.isChoice(1)).toBe(false);
    expect(conv.isChoice(2)).toBe(true); // the name prompt
    expect(conv.isChoice(3)).toBe(false);
    expect(conv.text(3)).toContain('elevator');
    expect(conv.nodes[2].elements.length).toBe(0);
  });

  it('carries the scene into the text node and lists it', () => {
    expect(conv.nodes[1].scene).toBe('scene/lobby');
    expect([...conv.sceneNames]).toContain('scene/lobby');
  });

  it('the action node records the plain and special log entries', () => {
    const action = conv.getAction(0);
    expect(action).not.toBeNull();
    expect(action!.logEntries.length).toBe(1);
    expect([...action!.specialLogEntries.keys()]).toContain('Factions');
    const republic = action!.specialLogEntries.get('Factions')?.get('Republic');
    expect(republic?.paragraphs[0]).toContain('Hundreds of years ago');
  });

  it('the name prompt node has zero elements', () => {
    expect(conv.choices(2)).toBe(0);
    expect(conv.hasAnyChoices(2)).toBe(true); // zero-length choice = name prompt
  });

  it('the final text node is not empty', () => {
    expect(conv.text(3).length).toBeGreaterThan(0);
  });
});

describe('Conversation (synthetic routing)', () => {
  const store = new ConditionsStore();

  function parseSynthetic(text: string, warnings: string[] = []) {
    // `text` is the conversation's body, indented one level deeper than the
    // "conversation" keyword.
    const root = parseData(`conversation\n${text}`);
    return Conversation.parse(root.children[0], store, m => warnings.push(m));
  }

  it('parses a choice with a goto to a label (like the reference)', () => {
    const warnings: string[] = [];
    const conv = parseSynthetic(`
\t\`Some text.\`

\tchoice
\t\tYes
\t\t\tgoto end
\t\tNo

\tlabel end

\tDone.
`, warnings);
    expect(warnings.length).toBe(0);
    expect(conv.nodes.length).toBeGreaterThan(0);
    const choice = conv.nodes.find(n => n.isChoice);
    expect(choice).toBeDefined();
    expect(choice!.elements.length).toBe(2);
  });

  it('routes a branch to two different destinations', () => {
    const warnings: string[] = [];
    const conv = parseSynthetic(`
\t\`Start\`

\tbranch licensed done-path
\t\thas "licensed"

\tlabel licensed

\t\`Licensed path.\`

\tlabel done-path

\t\`Done path.\`
`, warnings);
    expect(warnings.length).toBe(0);
    const branch = conv.nodes.find(n => !n.conditions.isEmpty() && n.elements.length === 2);
    expect(branch).toBeDefined();
    expect(branch!.elements[0].next).toBe(2); // label "licensed"
    expect(branch!.elements[1].next).toBe(3); // label "done-path"
  });

  it('guards against infinite loops and marks the conversation empty', () => {
    const warnings: string[] = [];
    const conv = parseSynthetic(`
\tlabel top

\tchoice
\t\tLoop
\t\t\tgoto top
`, warnings);
    expect(conv.isEmpty()).toBe(true);
  });

  it('treats endpoint tokens as -1..-8 (like the reference)', () => {
    expect(endpointTokenIndex('accept')).toBe(-1);
    expect(endpointTokenIndex('die')).toBe(-7);
    expect(endpointTokenIndex('unknown')).toBe(0);
  });
});
