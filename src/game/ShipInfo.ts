// The ship info display — a faithful, milestone-scoped computation of the
// reference's ShipInfoDisplay (endless-sky/source/ShipInfoDisplay.cpp):
// movement stats, the energy/heat table, capacity free space and the
// installed outfits, all derived from the ship's base attributes plus the
// attributes of its installed outfits. Nothing is fabricated: any stat the
// milestone model does not track (combat, cargo) is omitted.

import type { Ship } from './Ship.ts';
import type { Outfit } from './Outfit.ts';

export interface InstalledOutfit {
  outfit: Outfit;
  count: number;
}

export interface ShipInfo {
  ship: Ship;
  // Installed outfits resolved from the catalog (name → outfit entry).
  outfits: InstalledOutfit[];
  // The display name of the ship (given name or model name).
  name: string;
  // Header.
  category: string;
  cost: number;
  // Capacities.
  shields: number;
  hull: number;
  shieldsPerSecond: number;         // 60 × shield generation
  shieldsChargeLabel: string;       // e.g. "600 (12/s)" or "600"
  // Mass.
  emptyMass: number;                // base mass + installed outfit masses (no cargo)
  fullMass: number;                 // empty mass + base cargo space
  hasCargoSpace: boolean;
  // Movement (full − no cargo).
  thrust: number;
  turn: number;
  drag: number;
  heatDissipation: number;
  maxSpeed: number;
  accelerationFull: number;         // 3600 × thrust / fullMass
  accelerationEmpty: number;        // 3600 × thrust / emptyMass
  turnFull: number;                 // 60 × turn / fullMass
  turnEmpty: number;                // 60 × turn / emptyMass
  // Space free.
  outfitSpace: number;              // base − used (negative = consumed)
  weaponCapacity: number;
  engineCapacity: number;
  gunPorts: number;                 // base
  turretMounts: number;             // base
  gunPortsFree: number;
  turretMountsFree: number;
  // Crew.
  requiredCrew: number;
  bunks: number;
  fuelCapacity: number;
  cargoSpace: number;
  // Energy/heat table.
  energyIdle: number;
  heatIdle: number;
  energyMoving: number;
  heatMoving: number;
  energyFiring: number;
  heatFiring: number;
  energyCharging: number;
  heatCharging: number;
  energyCapacity: number;
  heatCapacity: number;
  // Installed outfit names for the right column, grouped by category in
  // display order, with counts.
  outfitGroups: { category: string; entries: InstalledOutfit[] }[];
}

function sum(outfits: InstalledOutfit[], key: string): number {
  let total = 0;
  for (const { outfit, count } of outfits) {
    total += (outfit.attributes[key] ?? 0) * count;
  }
  return total;
}

function sumWeapon(outfits: InstalledOutfit[], key: string): number {
  let total = 0;
  for (const { outfit, count } of outfits) {
    total += (outfit.weapon[key] ?? 0) * count;
  }
  return total;
}

// Resolve the ship's outfit names against the catalog. Outfits the catalog
// does not define are reported via onWarn and skipped — the screen never shows
// a row for an outfit we cannot measure.
export function resolveInstalledOutfits(
  ship: Ship,
  catalog: Map<string, Outfit>,
  onWarn?: (message: string) => void,
): InstalledOutfit[] {
  const outfits: InstalledOutfit[] = [];
  for (const entry of ship.outfits) {
    const outfit = catalog.get(entry.name);
    if (!outfit) {
      onWarn?.(`ship "${ship.name}": outfit "${entry.name}" not in the catalog — skipped`);
      continue;
    }
    outfits.push({ outfit, count: entry.count });
  }
  return outfits;
}

// The display order for the outfits column (same order as the outfitter).
const OUTFIT_DISPLAY_ORDER = ['Guns', 'Turrets', 'Secondary Weapons', 'Ammunition', 'Systems', 'Power', 'Engines', 'Hand to Hand', 'Unique', 'Minerals', 'Special', 'Licenses'];

function groupOutfits(outfits: InstalledOutfit[]): { category: string; entries: InstalledOutfit[] }[] {
  const grouped = new Map<string, InstalledOutfit[]>();
  for (const installed of outfits) {
    const category = installed.outfit.category || 'Other';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(installed);
  }
  const ordered: { category: string; entries: InstalledOutfit[] }[] = [];
  for (const category of OUTFIT_DISPLAY_ORDER) {
    if (grouped.has(category)) ordered.push({ category, entries: grouped.get(category)! });
  }
  for (const [category, entries] of grouped) {
    if (!ordered.some(g => g.category === category)) ordered.push({ category, entries });
  }
  return ordered;
}

// Build the full ship stats. `ship` is the ship model; `installed` is the
// resolved outfit list (from resolveInstalledOutfits).
export function computeShipInfo(ship: Ship, installed: InstalledOutfit[]): ShipInfo {
  const baseMass = ship.mass;
  const outfitMass = installed.reduce((sum, { outfit, count }) => sum + (outfit.attributes['mass'] ?? 0) * count, 0);
  const emptyMass = baseMass + outfitMass;
  const fullMass = emptyMass + ship.cargoSpace;

  const thrust = sum(installed, 'thrust');
  const turn = sum(installed, 'turn');
  const shieldGeneration = sum(installed, 'shield generation');
  const shieldEnergy = sum(installed, 'shield energy');
  const hullRepair = sum(installed, 'hull repair rate');
  const shieldEnergyPerSec = 60 * shieldEnergy;

  // Movement — the reference's full vs empty range.
  const maxSpeed = thrust > 0 ? (60 * thrust) / ship.drag : 0;
  const accelerationFull = thrust > 0 && fullMass > 0 ? (3600 * thrust) / fullMass : 0;
  const accelerationEmpty = thrust > 0 && emptyMass > 0 ? (3600 * thrust) / emptyMass : 0;
  const turnFull = turn > 0 && fullMass > 0 ? (60 * turn) / fullMass : 0;
  const turnEmpty = turn > 0 && emptyMass > 0 ? (60 * turn) / emptyMass : 0;

  // Capacities — base attributes plus installed outfit values (the outfit's
  // own values are negative and subtract from the base).
  const outfitSpace = ship.outfitSpace + sum(installed, 'outfit space');
  const weaponCapacity = ship.weaponCapacity + sum(installed, 'weapon capacity');
  const engineCapacity = ship.engineCapacity + sum(installed, 'engine capacity');
  const gunPortsFree = ship.gunPorts + sum(installed, 'gun ports');
  const turretMountsFree = ship.turretMounts + sum(installed, 'turret mounts');

  // Energy/heat — the reference's formulas, scoped to the outfits the milestone
  // models (energy generation, heat generation, thrusting/turning energy &
  // heat, shield energy, firing energy/heat).
  const energyGeneration = sum(installed, 'energy generation');
  const heatGeneration = sum(installed, 'heat generation');
  const turningEnergy = sum(installed, 'turning energy');
  const turningHeat = sum(installed, 'turning heat');
  const thrustingEnergy = sum(installed, 'thrusting energy');
  const thrustingHeat = sum(installed, 'thrusting heat');
  const shieldEnergyTable = sum(installed, 'shield energy');
  const energyCapacity = sum(installed, 'energy capacity');

  const energyIdle = 60 * energyGeneration;
  const heatIdle = 60 * heatGeneration;
  const energyMoving = 60 * (turningEnergy + thrustingEnergy);
  const heatMoving = 60 * (turningHeat + thrustingHeat);

  // Firing: weapons contribute count × firing energy / reload (per second).
  let firingEnergyPerFrame = 0;
  let firingHeatPerFrame = 0;
  for (const { outfit, count } of installed) {
    const reload = outfit.weapon['reload'];
    const firingEnergy = outfit.weapon['firing energy'];
    const firingHeat = outfit.weapon['firing heat'];
    if (!reload || !reload) continue;
    firingEnergyPerFrame += count * (firingEnergy ?? 0) / reload;
    firingHeatPerFrame += count * (firingHeat ?? 0) / reload;
  }
  const energyFiring = 60 * firingEnergyPerFrame;
  const heatFiring = 60 * firingHeatPerFrame;

  const energyCharging = 60 * shieldEnergyTable;
  const heatCharging = 0;

  // Heat capacity — the reference's formula (60 × dissipation × MaxHeat),
  // where MaxHeat = 100 × (mass with no cargo). No cargo is tracked, so the
  // cargo term is 0.
  const heatCapacity = ship.heatDissipation > 0 && emptyMass > 0
    ? 60 * ship.heatDissipation * (100 * emptyMass)
    : 0;

  const shieldsChargeLabel = shieldGeneration > 0
    ? `${ship.shields.toLocaleString('en-US')} (${Math.round(60 * shieldGeneration)}/s)`
    : `${ship.shields.toLocaleString('en-US')}`;

  return {
    ship,
    outfits: installed,
    name: '', // caller sets the given name — this is the model name used as fallback
    category: ship.category,
    cost: ship.cost,
    shields: ship.shields,
    hull: ship.hull,
    shieldsPerSecond: 60 * shieldGeneration,
    shieldsChargeLabel,
    emptyMass,
    fullMass,
    hasCargoSpace: ship.cargoSpace > 0,
    thrust,
    turn,
    drag: ship.drag,
    heatDissipation: ship.heatDissipation,
    maxSpeed,
    accelerationFull,
    accelerationEmpty,
    turnFull,
    turnEmpty,
    outfitSpace,
    weaponCapacity,
    engineCapacity,
    gunPorts: ship.gunPorts,
    turretMounts: ship.turretMounts,
    gunPortsFree,
    turretMountsFree,
    requiredCrew: ship.requiredCrew,
    bunks: ship.bunks,
    fuelCapacity: ship.fuelCapacity,
    cargoSpace: ship.cargoSpace,
    energyIdle,
    heatIdle,
    energyMoving,
    heatMoving,
    energyFiring,
    heatFiring,
    energyCharging,
    heatCharging,
    energyCapacity,
    heatCapacity,
    outfitGroups: groupOutfits(installed),
  };
}

// The installed outfits grouped by category, in the outfitter's display order.
export function groupInstalledOutfits(installed: InstalledOutfit[]): { category: string; entries: InstalledOutfit[] }[] {
  return groupOutfits(installed);
}
