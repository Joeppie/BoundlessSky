import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from './DataParser.ts';
import { parsePlanet } from '../game/Planet.ts';
import { ConditionsStore } from '../game/ConditionsStore.ts';

// Tests mirror the reference's New Boston planet (map planets.txt) — the
// default start's landing planet.

describe('PlanetData (from map planets.txt)', () => {
  const root = parseData(readFileSync('endless-sky/data/map planets.txt', 'utf8'));
  const boston = root.children.find(n => n.tokenOr(0) === 'planet' && n.tokenOr(1) === 'New Boston')!;

  it('parses the name, landscape, attributes and shops', () => {
    const conditions = new ConditionsStore();
    const planet = parsePlanet(boston, conditions);
    expect(planet.name).toBe('New Boston');
    expect(planet.landscape).toBe('land/water2');
    expect(planet.attributes).toEqual(['dirt belt', 'farming', 'textiles']);
    expect(planet.shipyards).toEqual(['Basic Ships']);
    expect(planet.outfitters).toEqual(['Basic Outfits', 'Ammo South']);
  });

  it('evaluates the description paragraphs against the live conditions', () => {
    // Non-default start: the first paragraph shows.
    const conditions = new ConditionsStore();
    const planet = parsePlanet(boston, conditions);
    const texts = planet.description.filter(p => p.conditions.test()).map(p => p.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('unremarkable');
    expect(texts[0]).toContain('textile mills');

    // Default start: the born-here paragraphs show instead.
    conditions.set('start: default', 1);
    const bostonDefault = parsePlanet(boston, conditions);
    const textsDefault = bostonDefault.description.filter(p => p.conditions.test()).map(p => p.text);
    expect(textsDefault).toHaveLength(2);
    expect(textsDefault[0]).toContain('born here');
    expect(textsDefault[1]).toContain('linen and burlap');
    expect(textsDefault.join(' ')).not.toContain('unremarkable world. Most');
  });

  it('throws a clear error for a non-planet node', () => {
    const notAPlanet = parseData('planet "x"\n\tlandscape land/water2\n').children[0] as any;
    notAPlanet.tokens[0] = 'start';
    expect(() => parsePlanet(notAPlanet, new ConditionsStore())).toThrow(/not a planet/);
  });

  it('warns about unrecognized keys but keeps the rest', () => {
    const root = parseData('planet "X"\n\tlandscape land/water2\n\tbogus_key "whatever"\n');
    const warnings: string[] = [];
    const planet = parsePlanet(root.children[0] as any, new ConditionsStore(), (m) => warnings.push(m));
    expect(planet.landscape).toBe('land/water2');
    expect(warnings.some(w => w.includes('bogus_key'))).toBe(true);
  });
});
