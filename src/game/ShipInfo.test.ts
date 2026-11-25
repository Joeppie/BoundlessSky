import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from '../data/DataParser.ts';
import { parseShip } from './Ship.ts';
import { parseOutfit } from './Outfit.ts';
import { computeShipInfo, resolveInstalledOutfits } from './ShipInfo.ts';

// Tests mirror the Star Barge's reference ship-info display: base attributes
// from ships.txt plus the installed outfits from the four outfit catalogs
// (outfits.txt, weapons.txt, engines.txt, power.txt).

function loadCatalog() {
  const catalog = new Map<string, ReturnType<typeof parseOutfit>>();
  for (const file of ['outfits.txt', 'weapons.txt', 'engines.txt', 'power.txt']) {
    const root = parseData(readFileSync(`endless-sky/data/human/${file}`, 'utf8'));
    for (const node of root.children) {
      if (node.tokenOr(0) !== 'outfit') continue;
      const outfit = parseOutfit(node);
      if (outfit.name && !catalog.has(outfit.name)) catalog.set(outfit.name, outfit);
    }
  }
  return catalog;
}

function loadShip(name: string) {
  const root = parseData(readFileSync('endless-sky/data/human/ships.txt', 'utf8'));
  for (const node of root.children) {
    if (node.tokenOr(0) === 'ship' && node.tokenOr(1) === name) return parseShip(node);
  }
  throw new Error(`ship "${name}" not found`);
}

describe('computeShipInfo (Star Barge)', () => {
  const catalog = loadCatalog();
  const ship = loadShip('Star Barge');
  const installed = resolveInstalledOutfits(ship, catalog);
  const info = computeShipInfo(ship, installed);

  it('resolves all installed outfits with no warnings', () => {
    const warnings: string[] = [];
    resolveInstalledOutfits(ship, catalog, (m) => warnings.push(m));
    expect(warnings).toEqual([]);
    expect(installed.map(i => i.outfit.name)).toEqual([
      'Anti-Missile Turret', 'nGVF-BB Fuel Cell', 'LP036a Battery Pack',
      'D14-RN Shield Generator', 'X1700 Ion Thruster', 'X1200 Ion Steering', 'Hyperdrive',
    ]);
  });

  it('computes mass with no cargo (base + outfit masses)', () => {
    // 80 base + 16 (turret) + 30 (fuel cell) + 10 (battery) + 15 (shield) + 20 (hyperdrive) + 16 (thruster) + 12 (steering)
    expect(info.emptyMass).toBe(199);
    expect(info.fullMass).toBe(249);
  });

  it('computes movement (60 × thrust / drag)', () => {
    expect(info.maxSpeed).toBeCloseTo(369.4, 1);
    expect(info.accelerationFull).toBeCloseTo(3600 * 13.545 / 249, 1);
    expect(info.accelerationEmpty).toBeCloseTo(3600 * 13.545 / 199, 1);
    expect(info.turnFull).toBeCloseTo(60 * 288 / 249, 1);
    expect(info.turnEmpty).toBeCloseTo(60 * 288 / 199, 1);
  });

  it('computes space free (base minus installed)', () => {
    expect(Math.round(info.outfitSpace)).toBe(11);   // 130 - 119
    expect(Math.round(info.weaponCapacity)).toBe(4);  // 20 - 16
    expect(Math.round(info.engineCapacity)).toBe(12); // 40 - 28
    expect(info.gunPortsFree).toBe(0);                 // 0 gun ports
    expect(Math.round(info.turretMountsFree)).toBe(0); // 1 - 1
  });

  it('computes the energy/heat table', () => {
    expect(info.energyIdle).toBeCloseTo(114);          // 60 × 1.9
    expect(info.heatIdle).toBeCloseTo(174);            // 60 × 2.9
    expect(info.energyMoving).toBeCloseTo(54);         // 60 × (0.3 + 0.6)
    expect(info.heatMoving).toBeCloseTo(90);           // 60 × (0.6 + 0.9)
    expect(info.energyFiring).toBeCloseTo(37.5);       // 60 × (5 / 8)
    expect(info.heatFiring).toBeCloseTo(22.5);         // 60 × (3 / 8)
    expect(info.energyCharging).toBeCloseTo(12);       // 60 × 0.2
    expect(info.heatCharging).toBe(0);
    expect(info.energyCapacity).toBe(4000);
    expect(info.heatCapacity).toBeCloseTo(60 * 0.77 * (100 * 199));
  });

  it('groups installed outfits by category in display order', () => {
    expect(info.outfitGroups.map(g => g.category)).toEqual(['Turrets', 'Systems', 'Power', 'Engines']);
    expect(info.outfitGroups[0].entries[0].outfit.name).toBe('Anti-Missile Turret');
    expect(info.outfitGroups[3].entries.map(e => e.outfit.name)).toEqual(['X1700 Ion Thruster', 'X1200 Ion Steering']);
  });
});

describe('computeShipInfo (Shuttle — no weapons, gun port count)', () => {
  const catalog = loadCatalog();
  const ship = loadShip('Shuttle');

  it('keeps the gun port free count honest', () => {
    const info = computeShipInfo(ship, resolveInstalledOutfits(ship, catalog));
    expect(info.gunPorts).toBe(1);
    expect(info.gunPortsFree).toBe(1);   // 1 gun hardpoint, no weapon installed
    expect(info.turretMounts).toBe(0);
    // 1 gun port is 0 turret mounts in the Shuttle — the outfits are thrusters/fuel.
    expect(info.outfitSpace).toBeLessThan(ship.outfitSpace);
  });
});
