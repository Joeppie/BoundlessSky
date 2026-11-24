// The conversation engine — a faithful port of the reference's Conversation
// (endless-sky/source/Conversation.h/.cpp).
//
// A conversation is a network of nodes parsed from a `conversation` block in a
// data file:
// - text paragraphs (merged into one node unless ended by a goto / display
//   condition / label / choice / branch / scene / action / name)
// - `scene "<sprite>"` — starts a new node; the given sprite is shown with it
// - `label "<name>"` — marks the node that will be created next
// - `choice` — a choice node: one child per option (one token each, with
//   optional `goto` / `to display` / `to activate` children)
// - `name` — an empty choice node (the name prompt)
// - `branch` — conditions + two destinations (true / false)
// - `goto "<label>"` — a goto node
// - `action` — a node whose GameAction runs when it is reached
// - bare paragraphs — ordinary text nodes

import { type DataNode } from '../data/DataNode.ts';
import type { ConditionsStore } from './ConditionsStore.ts';
import { parseConditionSet, ConditionSet } from './ConditionSet.ts';
import { GameAction } from './GameAction.ts';

export const ENDPOINTS: Record<string, number> = {
  accept: -1,
  decline: -2,
  defer: -3,
  launch: -4,
  flee: -5,
  depart: -6,
  die: -7,
  explode: -8,
};

export function endpointTokenIndex(token: string): number {
  return ENDPOINTS[token] ?? 0;
}

export interface ConversationElement {
  text: string;
  next: number;
  toDisplay: ConditionSet;
  toActivate: ConditionSet;
}

export interface ConversationNode {
  conditions: ConditionSet;
  actions: GameAction;
  elements: ConversationElement[];
  isChoice: boolean;
  canMergeOnto: boolean;
  scene: string | null;
}

export class Conversation {
  nodes: ConversationNode[] = [];
  sceneNames = new Set<string>();
  private labels = new Map<string, number>();
  private unresolved: { label: string; node: number; element: number }[] = [];
  private runtimeConditions: ConditionsStore;

  static parse(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): Conversation {
    const conv = new Conversation(conditions);
    conv.load(node, onWarn);
    return conv;
  }

  private constructor(conditions: ConditionsStore) {
    this.runtimeConditions = conditions;
  }

  private emptySet(): ConditionSet {
    // No condition restriction: an AND with no children evaluates as true,
    // like the reference's default ConditionSet.
    const set = new ConditionSet(this.runtimeConditions);
    set.operator = 'AND';
    set.children = [];
    return set;
  }

  private addNode(): void {
    this.nodes.push({
      conditions: this.emptySet(),
      actions: new GameAction(this.runtimeConditions),
      elements: [{ text: '', next: this.nodes.length + 1, toDisplay: this.emptySet(), toActivate: this.emptySet() }],
      isChoice: false,
      canMergeOnto: true,
      scene: null,
    });
  }

  private load(node: DataNode, onWarn?: (message: string) => void): void {
    if (node.tokens[0] !== 'conversation') return;

    this.nodes = [];
    this.sceneNames = new Set();
    this.labels = new Map();
    this.unresolved = [];

    for (const child of node.children) {
      const key = child.tokens[0];
      const hasValue = child.getSize() >= 2;

      if (key === 'scene' && hasValue) {
        // A scene always starts a new text node.
        this.addNode();
        this.nodes[this.nodes.length - 1].scene = child.tokens[1];
        this.sceneNames.add(child.tokens[1]);
      } else if (key === 'label' && hasValue) {
        // You cannot merge text above a label with text below it.
        if (this.nodes.length > 0) this.nodes[this.nodes.length - 1].canMergeOnto = false;
        this.addLabel(child.tokens[1], child, onWarn);
      } else if (key === 'choice') {
        // Create a new choice node.
        this.nodes.push({
          conditions: this.emptySet(),
          actions: new GameAction(this.runtimeConditions),
          elements: [],
          isChoice: true,
          canMergeOnto: false,
          scene: null,
        });
        const nodeIndex = this.nodes.length - 1;
        let foundErrors = false;
        for (const grand of child.children) {
          if (grand.getSize() > 1) {
            onWarn?.(`conversation choices should be a single token (line ${grand.lineNumber})`);
            foundErrors = true;
            continue;
          }
          const element: ConversationElement = {
            text: grand.tokens[0] + '\n',
            next: this.nodes.length,
            toDisplay: this.emptySet(),
            toActivate: this.emptySet(),
          };
          this.nodes[nodeIndex].elements.push(element);
          this.loadDestinations(grand, nodeIndex, this.nodes[nodeIndex].elements.length - 1, onWarn);
        }
        if (this.nodes[nodeIndex].elements.length === 0) {
          if (!foundErrors) onWarn?.(`conversation contains an empty "choice" node (line ${child.lineNumber})`);
          this.nodes.splice(nodeIndex, 1);
        }
      } else if (key === 'name') {
        // A name entry field is just an empty choice node.
        this.nodes.push({
          conditions: this.emptySet(),
          actions: new GameAction(this.runtimeConditions),
          elements: [],
          isChoice: true,
          canMergeOnto: false,
          scene: null,
        });
      } else if (key === 'branch') {
        // Don't merge "branch" nodes with any other nodes.
        this.nodes.push({
          conditions: this.emptySet(),
          actions: new GameAction(this.runtimeConditions),
          elements: [],
          isChoice: false,
          canMergeOnto: false,
          scene: null,
        });
        if (child.hasChildren()) {
          this.nodes[this.nodes.length - 1].conditions = parseConditionSet(child, this.runtimeConditions, onWarn);
        }
        for (let i = 1; i <= 2; ++i) {
          // If no link is provided, just go to the next node.
          const element: ConversationElement = {
            text: '',
            next: this.nodes.length,
            toDisplay: this.emptySet(),
            toActivate: this.emptySet(),
          };
          this.nodes[this.nodes.length - 1].elements.push(element);
          if (child.getSize() > i) {
            const token = child.tokens[i];
            const index = endpointTokenIndex(token);
            if (index === 0) {
              this.goto(token, this.nodes.length - 1, i - 1);
            } else if (index < 0) {
              this.nodes[this.nodes.length - 1].elements[i - 1].next = index;
            }
          }
        }
      } else if (key === 'goto' && hasValue) {
        // Goto the label with the given name, even if it matches an endpoint.
        this.nodes.push({
          conditions: this.emptySet(),
          actions: new GameAction(this.runtimeConditions),
          elements: [{ text: '', next: this.nodes.length + 1, toDisplay: this.emptySet(), toActivate: this.emptySet() }],
          isChoice: false,
          canMergeOnto: false,
          scene: null,
        });
        this.goto(child.tokens[1], this.nodes.length - 1, 0);
      } else if (key === 'action' || key === 'apply') {
        this.addNode();
        this.nodes[this.nodes.length - 1].canMergeOnto = false;
        this.nodes[this.nodes.length - 1].actions = GameAction.parse(child, this.runtimeConditions, onWarn);
      } else if (hasValue) {
        onWarn?.(`conversation text should be a single token (line ${child.lineNumber})`);
      } else {
        // Ordinary text node.
        if (this.nodes.length === 0 || !this.nodes[this.nodes.length - 1].canMergeOnto || this.hasDisplayRestriction(child)) {
          this.addNode();
        }
        const merged = this.nodes[this.nodes.length - 1];
        merged.elements[merged.elements.length - 1].text += child.tokens[0] + '\n';
        if (this.loadDestinations(child, this.nodes.length - 1, 0, onWarn)) {
          merged.canMergeOnto = false;
        }
      }
    }

    // Warn about unresolved labels.
    for (const { label } of this.unresolved) {
      onWarn?.(`conversation contains unrecognized label "${label}"`);
    }
    this.unresolved = [];

    // Check for infinite loops from each label.
    for (const [, nodeIndex] of this.labels) {
      let current = nodeIndex;
      let guard = 0;
      while (current >= 0 && this.choices(current) <= 1 && guard < this.nodes.length + 1) {
        current = this.nextNodeForChoice(current);
        if (current === nodeIndex) {
          onWarn?.('conversation contains infinite loop beginning with label');
          this.nodes = [];
          return;
        }
        guard++;
      }
    }
  }

  private addLabel(label: string, node: DataNode, onWarn?: (message: string) => void): void {
    if (this.labels.has(label)) {
      onWarn?.(`conversation: label "${label}" is used more than once`);
      return;
    }
    // Resolve outstanding gotos to this label, which point at the node that
    // will be created next.
    const remaining: { label: string; node: number; element: number }[] = [];
    for (const outstanding of this.unresolved) {
      if (outstanding.label === label) {
        this.nodes[outstanding.node].elements[outstanding.element].next = this.nodes.length;
      } else {
        remaining.push(outstanding);
      }
    }
    this.unresolved = remaining;
    this.labels.set(label, this.nodes.length);
  }

  private goto(label: string, node: number, element: number): void {
    const target = this.labels.get(label);
    if (target === undefined) {
      this.unresolved.push({ label, node, element });
    } else {
      this.nodes[node].elements[element].next = target;
    }
  }

  private hasDisplayRestriction(node: DataNode): boolean {
    for (const child of node.children) {
      if (child.tokens[0] === 'to' && child.getSize() >= 2 && child.tokens[1] === 'display') {
        return true;
      }
    }
    return false;
  }

  // Load goto/to display/to activate children of a text or choice element.
  // Returns true if gotos or display conditions were found.
  private loadDestinations(node: DataNode, nodeIndex: number, elementIndex: number, onWarn?: (message: string) => void): boolean {
    let hasGoto = false;
    let hasDisplayCondition = false;
    let hasActivationCondition = false;

    for (const child of node.children) {
      const key = child.tokens[0];
      const hasValue = child.getSize() >= 2;

      if (key === 'goto' && hasValue) {
        if (hasGoto) {
          onWarn?.(`ignoring extra endpoint in conversation choice (line ${child.lineNumber})`);
        } else {
          this.goto(child.tokens[1], nodeIndex, elementIndex);
          hasGoto = true;
        }
      } else if (key === 'to' && hasValue && child.tokens[1] === 'display') {
        if (hasDisplayCondition) {
          onWarn?.(`ignoring extra condition in conversation choice (line ${child.lineNumber})`);
        } else {
          this.nodes[nodeIndex].elements[elementIndex].toDisplay = parseConditionSet(child, this.runtimeConditions, onWarn);
          hasDisplayCondition = true;
        }
      } else if (key === 'to' && hasValue && child.tokens[1] === 'activate') {
        if (hasActivationCondition) {
          onWarn?.(`ignoring extra condition in conversation choice (line ${child.lineNumber})`);
        } else {
          this.nodes[nodeIndex].elements[elementIndex].toActivate = parseConditionSet(child, this.runtimeConditions, onWarn);
          hasActivationCondition = true;
        }
      } else {
        // Check if this is a recognized endpoint name.
        const index = endpointTokenIndex(key);
        if (!hasValue && index < 0) {
          if (hasGoto) {
            onWarn?.(`ignoring extra endpoint in conversation choice (line ${child.lineNumber})`);
          } else {
            this.nodes[nodeIndex].elements[elementIndex].next = index;
            hasGoto = true;
          }
        } else {
          onWarn?.(`expected goto, to display, or endpoint in conversation (line ${child.lineNumber})`);
        }
      }
    }
    return hasGoto || hasDisplayCondition;
  }

  // --- Queries -------------------------------------------------------------

  isEmpty(): boolean {
    return this.nodes.length === 0;
  }

  // Check if this conversation includes a name prompt, and thus can be used
  // as an "intro" conversation.
  isValidIntro(): boolean {
    return this.nodes.some(n => n.isChoice && n.elements.length === 0);
  }

  nodeIsValid(node: number): boolean {
    return node >= 0 && node < this.nodes.length;
  }

  elementIsValid(node: number, element: number): boolean {
    return this.nodeIsValid(node) && element >= 0 && element < this.nodes[node].elements.length;
  }

  isChoice(node: number): boolean {
    return this.nodeIsValid(node) && this.nodes[node].isChoice;
  }

  hasAnyChoices(node: number): boolean {
    if (!this.nodeIsValid(node)) return false;
    const n = this.nodes[node];
    if (!n.isChoice) return false;
    if (n.elements.length === 0) return true; // A zero-length choice is the name prompt.
    for (const element of n.elements) {
      if (element.toDisplay.isEmpty() || element.toDisplay.test()) return true;
    }
    return false;
  }

  choices(node: number): number {
    if (!this.nodeIsValid(node)) return 0;
    return this.nodes[node].isChoice ? this.nodes[node].elements.length : 0;
  }

  choiceIsActive(node: number, element: number): boolean {
    if (!this.nodeIsValid(node) || !this.isChoice(node) || !this.elementIsValid(node, element)) return false;
    return this.nodes[node].elements[element].toActivate.test();
  }

  isBranch(node: number): boolean {
    if (!this.nodeIsValid(node)) return false;
    const n = this.nodes[node];
    return !n.conditions.isEmpty() && n.elements.length > 1;
  }

  isAction(node: number): boolean {
    if (!this.nodeIsValid(node)) return false;
    return !this.nodes[node].actions.isEmpty();
  }

  conditions(node: number): ConditionSet {
    if (!this.nodeIsValid(node)) return this.emptySet();
    return this.nodes[node].conditions;
  }

  getAction(node: number): GameAction | null {
    if (!this.nodeIsValid(node)) return null;
    return this.nodes[node].actions;
  }

  text(node: number, element = 0): string {
    if (!this.nodeIsValid(node) || !this.elementIsValid(node, element)) return '';
    return this.nodes[node].elements[element].text;
  }

  scene(node: number): string | null {
    if (!this.nodeIsValid(node)) return null;
    return this.nodes[node].scene;
  }

  nextNodeForChoice(node: number, element = 0): number {
    if (!this.nodeIsValid(node) || !this.elementIsValid(node, element)) return -2;
    return this.nodes[node].elements[element].next;
  }

  stepToNextNode(node: number): number {
    if (!this.nodeIsValid(node)) return -2;
    return node + 1 < this.nodes.length ? node + 1 : -2;
  }

  shouldDisplayNode(node: number, element = 0): boolean {
    if (!this.nodeIsValid(node) || !this.elementIsValid(node, element)) return false;
    const n = this.nodes[node];
    if (n.isChoice) return n.elements[element].toDisplay.test();
    if (element !== 0) return false;
    return n.elements[0].toDisplay.test();
  }
}
