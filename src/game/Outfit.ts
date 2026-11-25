// The outfit — a milestone-scoped subset of the reference's Outfit
// (endless-sky/source/Outfit.cpp): name, category, cost, thumbnail, description
// and the flat attributes the outfitter displays. Weapon blocks carry the same
// attributes as a ship's weapon (velocity, inaccuracy, shield/hull damage, ...);
// the full damage model is Milestone 3+.

import type { DataNode } from '../data/DataNode';

export interface Outfit {
  // The name as it appears in the outfits/weapons file, e.g. "Energy Blaster".
  name: string;
  // Display category from categories.txt: "Guns", "Turrets", "Ammunition",
  // "Systems", "Power", ...
  category: string;
  cost: number;
  thumbnail: string;          // e.g. "outfit/blaster"
  description: string;
  // Flat attributes ("mass", "outfit space", "weapon capacity", ...).
  attributes: Record<string, number>;
  // Weapon attributes ("velocity", "inaccuracy", "shield damage", ...), for the
  // weapon outfits only.
  weapon: Record<string, number>;
}

// Pure parse: read an outfit node into an Outfit. Exported so tests can feed
// the real data in.
export function parseOutfit(node: DataNode, onWarn?: (message: string) => void): Outfit {
  const outfit: Outfit = {
    name: node.tokenOr(1),
    category: '',
    cost: 0,
    thumbnail: '',
    description: '',
    attributes: {},
    weapon: {},
  };

  for (const child of node.children) {
    const key = child.tokenOr(0);
    if (key === 'category') {
      outfit.category = child.tokenOr(1);
    } else if (key === 'series' || key === 'index' || key === 'plural') {
      // Parsed-but-unused here — the reference uses it for ordering; harmless
      // to skip (a duplicate name is still fine for our milestone display).
      continue;
    } else if (key === 'cost') {
      const n = Number(child.tokenOr(1));
      outfit.cost = Number.isFinite(n) ? n : 0;
    } else if (key === 'thumbnail') {
      outfit.thumbnail = child.tokenOr(1);
    } else if (key === 'description') {
      outfit.description = child.tokenOr(child.getSize() - 1).trim();
    } else if (key === 'weapon') {
      // Flat weapon attributes — scalar children only ("velocity" 12).
      for (const wChild of child.children) {
        const wk = wChild.tokenOr(0);
        if (wChild.getSize() < 2) continue;
        const n = Number(wChild.tokenOr(1));
        if (Number.isFinite(n)) outfit.weapon[wk] = n;
      }
    } else if (child.getSize() >= 2) {
      // Top-level numeric attribute — e.g. "mass" 5. Non-numeric children
      // (sprite/sound references, sub-blocks) are skipped.
      const n = Number(child.tokenOr(1));
      if (Number.isFinite(n)) outfit.attributes[key] = n;
    } else if (!child.hasChildren()) {
      onWarn?.(`outfit "${outfit.name}": unrecognized key "${key}" (line ${child.lineNumber})`);
    }
  }

  // The weapon child's attributes are already stored flat; the weapons file's
  // "weapon" sub-block wraps numeric attributes in quotes — handled above.
  return outfit;
}

// Read a fresh list of outfits from one parsed file's root node.
export function parseOutfits(root: DataNode, onWarn?: (message: string) => void): Outfit[] {
  const outfits: Outfit[] = [];
  for (const node of root.children) {
    if (node.tokenOr(0) === 'outfit') outfits.push(parseOutfit(node, onWarn));
  }
  return outfits;
}
