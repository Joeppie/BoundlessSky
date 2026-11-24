// A ship model — a faithful, milestone-scoped subset of the reference's Ship
// (endless-sky/source/Ship.h/.cpp): identity, category, and the base attributes
// the shipyard shows and the mission conditions read. Outfits, sprites beyond
// a name and economy mechanics are Milestone 2+.

import type { DataNode } from '../data/DataNode.ts';

export class Ship {
  // The model name as it appears in ships.txt, e.g. "Shuttle".
  name = '';
  sprite: string | null = null;
  thumbnail: string | null = null;
  category = '';
  cost = 0;
  shields = 0;
  hull = 0;
  requiredCrew = 0;
  bunks = 0;
  mass = 0;
  drag = 0;
  fuelCapacity = 0;
  cargoSpace = 0;
  outfitSpace = 0;
  weaponCapacity = 0;
  engineCapacity = 0;

  get isValid(): boolean {
    return this.name.length > 0;
  }
}

function numericStat(node: DataNode, key: string): number {
  const child = node.children.find(n => n.tokenOr(0) === key);
  if (!child) return 0;
  const n = Number(child.tokenOr(1));
  return Number.isFinite(n) ? n : 0;
}

function stringStat(node: DataNode, key: string): string {
  const child = node.children.find(n => n.tokenOr(0) === key);
  if (!child || child.getSize() < 2) return '';
  return child.token(1);
}

// Parse one `ship "<name>"` node from a ships.txt file.
export function parseShip(node: DataNode): Ship {
  const ship = new Ship();
  ship.name = node.getSize() >= 2 ? node.token(1) : '';

  for (const child of node.children) {
    const key = child.tokenOr(0);
    if (key === 'sprite' && child.getSize() >= 2) {
      ship.sprite = child.token(1);
    } else if (key === 'thumbnail' && child.getSize() >= 2) {
      ship.thumbnail = child.token(1);
    } else if (key === 'attributes') {
      ship.category = stringStat(child, 'category');
      ship.cost = numericStat(child, 'cost');
      ship.shields = numericStat(child, 'shields');
      ship.hull = numericStat(child, 'hull');
      ship.requiredCrew = numericStat(child, 'required crew');
      ship.bunks = numericStat(child, 'bunks');
      ship.mass = numericStat(child, 'mass');
      ship.drag = numericStat(child, 'drag');
      ship.fuelCapacity = numericStat(child, 'fuel capacity');
      ship.cargoSpace = numericStat(child, 'cargo space');
      ship.outfitSpace = numericStat(child, 'outfit space');
      ship.weaponCapacity = numericStat(child, 'weapon capacity');
      ship.engineCapacity = numericStat(child, 'engine capacity');
    }
  }
  // Ship blocks carry no children beyond attributes that we read; the rest
  // (weapon, outfits, engines, guns, leaks, descriptions) are Milestone 2+.
  return ship;
}

// Read a fresh copy of the ships a shipyard sells. The caller owns the file.
export function parseShips(root: DataNode): Ship[] {
  const ships: Ship[] = [];
  for (const node of root.children) {
    if (node.tokenOr(0) === 'ship') ships.push(parseShip(node));
  }
  return ships;
}
