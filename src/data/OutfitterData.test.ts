import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from './DataParser.ts';
import { parseOutfit, parseOutfits } from '../game/Outfit.ts';
import { parseOutfitterStockSet, groupStockByCategory } from './OutfitterData.ts';

// Tests mirror the reference's New Boston outfitter stock (Basic Outfits +
// Ammo South) — the only one this milestone serves.

describe('OutfitterData (from outfits.txt + weapons.txt)', () => {
  const outfits = parseData(readFileSync('endless-sky/data/human/outfits.txt', 'utf8'));
  const weapons = parseData(readFileSync('endless-sky/data/human/weapons.txt', 'utf8'));

  it('parses the outfits file', () => {
    const parsed = parseOutfits(outfits);
    expect(parsed.length).toBeGreaterThan(0);
    const cooling = parsed.find(o => o.name === 'Cooling Ducts')!;
    expect(cooling.category).toBe('Systems');
    expect(cooling.cost).toBe(10000);
    expect(cooling.thumbnail).toBe('outfit/cooling ducts');
    expect(cooling.description).toContain('high-powered outfits');
    expect(cooling.attributes['mass']).toBe(5);
    expect(cooling.attributes['outfit space']).toBe(-5);
    expect(cooling.attributes['cooling']).toBe(5);
  });

  it('parses weapon outfits with their weapon attributes', () => {
    const parsed = parseOutfits(weapons);
    const blaster = parsed.find(o => o.name === 'Energy Blaster')!;
    expect(blaster.category).toBe('Guns');
    expect(blaster.cost).toBe(16000);
    expect(blaster.thumbnail).toBe('outfit/blaster');
    expect(blaster.attributes['mass']).toBe(5);
    expect(blaster.attributes['weapon capacity']).toBe(-5);
    expect(blaster.weapon['velocity']).toBeCloseTo(10.625);
    expect(blaster.weapon['shield damage']).toBeCloseTo(10.6);
    expect(blaster.weapon['hull damage']).toBeCloseTo(6.6);
  });

  it("resolves New Boston's full outfitter stock (Basic Outfits + Ammo South) across all four catalogs", () => {
    const warnings: string[] = [];
    const catalog = new Map<string, ReturnType<typeof parseOutfit>>();
    for (const file of ['outfits.txt', 'weapons.txt', 'engines.txt', 'power.txt']) {
      const root = parseData(readFileSync(`endless-sky/data/human/${file}`, 'utf8'), { onWarn: (m) => warnings.push(m) });
      for (const node of root.children) {
        if (node.tokenOr(0) !== 'outfit') continue;
        const outfit = parseOutfit(node, (m) => warnings.push(m));
        if (outfit.name && !catalog.has(outfit.name)) catalog.set(outfit.name, outfit);
      }
    }
    const sales = parseData(readFileSync('endless-sky/data/human/sales.txt', 'utf8'));
    const stock = parseOutfitterStockSet(sales, ['Basic Outfits', 'Ammo South']);
    const grouped = groupStockByCategory(catalog, stock);

    // Every stocked outfit resolves — 18 unique names across the union
    // (16 Basic Outfits + Javelin/Heavy Rocket from Ammo South).
    const all = [...grouped.values()].flat();
    expect(stock.size).toBe(18);
    expect(all.length).toBe(18);
    expect(all.map(o => o.name).sort()).toEqual([
      'Cargo Scanner', 'Cooling Ducts', 'D14-RN Shield Generator', 'Energy Blaster',
      'Heavy Rocket', 'Hyperdrive', 'Javelin', 'LP036a Battery Pack',
      'LP072a Battery Pack', 'Local Map', 'Meteor Missile', 'nGVF-AA Fuel Cell',
      'nGVF-BB Fuel Cell', 'Pilot\'s License', 'X1200 Ion Steering', 'X1700 Ion Thruster',
      'X2200 Ion Steering', 'X2700 Ion Thruster',
    ].sort());

    // Engines and Power are in their own categories.
    expect((grouped.get('Engines') ?? []).map(o => o.name).sort()).toEqual([
      'X1200 Ion Steering', 'X1700 Ion Thruster', 'X2200 Ion Steering', 'X2700 Ion Thruster',
    ].sort());
    expect((grouped.get('Power') ?? []).map(o => o.name).sort()).toEqual([
      'LP036a Battery Pack', 'LP072a Battery Pack', 'nGVF-AA Fuel Cell', 'nGVF-BB Fuel Cell',
    ].sort());

    // No null categories.
    for (const [category] of grouped) {
      expect(category.length).toBeGreaterThan(0);
    }
  });

  it('warns on an unrecognized flat key but keeps the outfit', () => {
    const root = parseData('outfit "Test"\n\tcategory "Systems"\n\tsomekey 5\n\tbogus\n');
    const warnings: string[] = [];
    const [outfit] = parseOutfits(root, (m) => warnings.push(m));
    expect(outfit.name).toBe('Test');
    expect(warnings.some(w => w.includes('bogus'))).toBe(true);
  });
});
