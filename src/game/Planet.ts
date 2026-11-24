// The planet — a faithful milestone-scoped subset of the reference's Planet
// (endless-sky/source/Planet.cpp): the name, landscape, attributes, the
// description paragraphs (with their "to display" conditions, evaluated against
// the live player conditions) and the named shops. The full reference set is
// out of scope (spaceport, security, tribute, required attributes, ...).

import type { DataNode } from '../data/DataNode';
import type { ConditionsStore } from './ConditionsStore';
import { ConditionSet, parseConditionSet, type ConditionSet as ConditionSetT } from './ConditionSet';

export interface PlanetParagraph {
  // The paragraph text (without trailing whitespace).
  text: string;
  // The condition the paragraph is shown under; an unconditional set matches
  // everything, exactly like the reference's empty ConditionSet.
  conditions: ConditionSetT;
}

export interface Planet {
  name: string;
  // Landscape sprite name, e.g. "land/water2" (empty when unset).
  landscape: string;
  // Attribute strings, e.g. ["dirt belt", "farming", "textiles"].
  attributes: string[];
  // The description paragraphs, in document order.
  description: PlanetParagraph[];
  // Named shipyards the planet sells from (e.g. ["Basic Ships"]).
  shipyards: string[];
  // Named outfitters.
  outfitters: string[];
}

// Pure parse: read a planet node into a Planet. Exported so tests can feed the
// real data in.
export function parsePlanet(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): Planet {
  if (node.tokenOr(0) !== 'planet') {
    throw new Error(`node is not a planet (line ${node.lineNumber})`);
  }
  const planet: Planet = {
    name: node.tokenOr(1),
    landscape: '',
    attributes: [],
    description: [],
    shipyards: [],
    outfitters: [],
  };

  for (const child of node.children) {
    const key = child.tokenOr(0);
    if (key === 'attributes') {
      for (let i = 1; i < child.getSize(); ++i) planet.attributes.push(child.token(i));
    } else if (key === 'landscape') {
      // The first value token is the sprite name (weighted-children form is
      // Milestone 2).
      planet.landscape = child.tokenOr(1);
    } else if (key === 'description') {
      const paragraph = loadDescription(child, conditions, onWarn);
      if (paragraph) planet.description.push(paragraph);
    } else if (key === 'shipyard') {
      const name = child.tokenOr(1);
      if (name && !planet.shipyards.includes(name)) planet.shipyards.push(name);
    } else if (key === 'outfitter') {
      const name = child.tokenOr(1);
      if (name && !planet.outfitters.includes(name)) planet.outfitters.push(name);
    } else if (key === 'spaceport' || key === 'security' || key === 'tribute' || key === 'to' || key === 'display name') {
      // Keys the reference parses but the planet menu does not show — skipped.
      continue;
    } else {
      onWarn?.(`planet "${planet.name}": unrecognized key "${key}" (line ${child.lineNumber})`);
    }
  }

  return planet;
}

// Load one description node: the text is the last token, and the paragraph
// carries the "to display" condition when present.
function loadDescription(node: DataNode, conditions: ConditionsStore, onWarn?: (message: string) => void): PlanetParagraph | null {
  const text = node.tokenOr(node.getSize() - 1).trim();
  if (!text) return null;
  for (const child of node.children) {
    if (child.getSize() === 2 && child.tokenOr(0) === 'to' && child.tokenOr(1) === 'display') {
      const set = parseConditionSet(child, conditions, onWarn);
      return { text, conditions: set };
    }
  }
  // Unconditional — an empty AND set matches everything, like the reference.
  return { text, conditions: new ConditionSet(conditions) };
}
