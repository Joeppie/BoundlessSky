import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from './DataParser.ts';
import { parseSystem } from '../game/System.ts';

function loadSystem(name: string) {
  const root = parseData(readFileSync('endless-sky/data/map systems.txt', 'utf8'));
  for (const node of root.children) {
    if (node.tokenOr(0) === 'system' && node.tokenOr(1) === name) {
      return parseSystem(node);
    }
  }
  throw new Error(`system "${name}" not found`);
}

describe('parseSystem (the real Rutilicus system)', () => {
  const system = loadSystem('Rutilicus');

  it('reads the name, government, and star', () => {
    expect(system.name).toBe('Rutilicus');
    expect(system.government).toBe('Republic');
    expect(system.sprite).toBe('star/g5');
  });

  it('reads the jump neighbors', () => {
    expect(system.links).toEqual(['Arcturus', 'Cebalrai', 'Holeb', 'Menkent']);
  });

  it('lists the planets — named New Boston, with scenery', () => {
    expect(system.planets.length).toBe(5);
    const newBoston = system.planets.find(p => p.name === 'New Boston')!;
    expect(newBoston.sprite).toBe('planet/cloud6');
    expect(newBoston.distance).toBeCloseTo(513.86, 2);
    expect(system.planets.filter(p => p.name === null).length).toBe(4);
  });
});

describe('parseSystem (jump neighbors — warp destinations)', () => {
  it('Arcturus and Menkent carry a named, landable planet', () => {
    expect(loadSystem('Arcturus').planets.filter(p => p.name).map(p => p.name)).toEqual(['New Greenland']);
    expect(loadSystem('Menkent').planets.filter(p => p.name).map(p => p.name)).toEqual(['New Austria']);
  });

  it('Cebalrai carries a named planet too (Tundra)', () => {
    const tundra = loadSystem('Cebalrai').planets.filter(p => p.name).map(p => p.name);
    expect(tundra).toEqual(['Tundra']);
  });

  it('Holeb has no named planet — not landable here', () => {
    expect(loadSystem('Holeb').planets.filter(p => p.name).length).toBe(0);
  });
});
