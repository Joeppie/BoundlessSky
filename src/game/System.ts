// The system — a milestone-scoped subset of the reference's System (endless-sky/
// source/System.h/.cpp): the name, government, the star sprite, the jump
// neighbors, and the objects the system contains (the star, the named planets
// and the scenery). Planet specs themselves come from map planets.txt via the
// existing Planet parser — this module only maps what the system carries.

import type { DataNode } from '../data/DataNode';

export interface SystemPlanet {
  // The name from the system file (null = scenery — not a landable planet).
  name: string | null;
  sprite: string;
  // Orbital distance from the system center (unscaled, as in the file).
  distance: number;
}

export interface System {
  name: string;
  government: string;
  attributes: string[];
  // The star's sprite name, e.g. "star/g5" (empty when unset).
  sprite: string;
  // Jump-neighbor system names (the system's `link` lines).
  links: string[];
  // The planets in the system, in file order. The star is not a planet.
  planets: SystemPlanet[];
}

// Pure parse: read a `system` node into a System. Sub-objects (moons) are not
// listed as planets — they are scenery, and the reference does not treat them
// as landable either.
export function parseSystem(node: DataNode, onWarn?: (message: string) => void): System {
  if (node.tokenOr(0) !== 'system') {
    throw new Error(`node is not a system (line ${node.lineNumber})`);
  }
  const system: System = {
    name: node.tokenOr(1),
    government: '',
    attributes: [],
    sprite: '',
    links: [],
    planets: [],
  };

  for (const child of node.children) {
    const key = child.tokenOr(0);
    if (key === 'government') {
      system.government = child.tokenOr(1);
    } else if (key === 'attributes') {
      for (let i = 1; i < child.getSize(); ++i) system.attributes.push(child.token(i));
    } else if (key === 'link') {
      const name = child.tokenOr(1);
      if (name && !system.links.includes(name)) system.links.push(name);
    } else if (key === 'object') {
      // An object is a node with a quoted name (or none) and children for the
      // sprite/distance lines — e.g. `object "New Boston"` carrying
      // `sprite planet/cloud6` and `distance 513.86`. Sub-objects (moons) are
      // nested inside the planet object and never appear here.
      const objectName = child.tokenOr(1) || null;
      let sprite = '';
      let distance = 0;
      for (const grand of child.children) {
        const key0 = grand.tokenOr(0);
        if (key0 === 'sprite') {
          sprite = grand.tokenOr(1);
        } else if (key0 === 'distance') {
          const n = Number(grand.tokenOr(1));
          distance = Number.isFinite(n) ? n : 0;
        }
        // `offset`, `angle`, `rotation` etc. are render variations — not used by the flight view.
      }
      if (sprite === '') continue;
      // The star is the unnamed object at distance 0 (the system's center).
      if (sprite.startsWith('star/') && distance === 0 && !objectName) {
        system.sprite = sprite;
        continue;
      }
      if (distance <= 0) continue;
      system.planets.push({
        name: objectName,
        sprite,
        distance,
      });
    } else if (key === 'asteroids' || key === 'minables' || key === 'trade' || key === 'fleet' || key === 'speed' || key === 'hidden' || key === 'shrouded' || key === '"jump range"' || key === 'haze' || key === 'belt' || key === 'pos' || key === 'hazard') {
      // System-level facts the flight view does not show — skipped deliberately.
      continue;
    } else if (key === 'description') {
      continue;
    } else {
      onWarn?.(`system "${system.name}": unrecognized key "${key}" (line ${child.lineNumber})`);
    }
  }

  return system;
}
