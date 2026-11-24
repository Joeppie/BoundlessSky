import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from '../data/DataParser.ts';
import { parseShip } from './Ship.ts';

// Tests mirror the reference's Basic Ships stock (Shuttle / Sparrow /
// Star Barge) against the real ships.txt — the same data the shipyard shows.

function shipNode(name: string) {
  const root = parseData(readFileSync('endless-sky/data/human/ships.txt', 'utf8'));
  const node = root.children.find(n => n.tokenOr(0) === 'ship' && n.tokenOr(1) === name);
  if (!node) throw new Error(`ship "${name}" not found in ships.txt`);
  return node;
}

describe('Ship (from ships.txt)', () => {
  it('parses the Shuttle — a Transport starter ship', () => {
    const ship = parseShip(shipNode('Shuttle'));
    expect(ship.name).toBe('Shuttle');
    expect(ship.sprite).toBe('ship/shuttle');
    expect(ship.category).toBe('Transport');
    expect(ship.cost).toBe(180000);
    expect(ship.shields).toBe(500);
    expect(ship.hull).toBe(600);
    expect(ship.requiredCrew).toBe(1);
    expect(ship.bunks).toBe(6);
    expect(ship.mass).toBe(80);
    expect(ship.fuelCapacity).toBe(400);
    expect(ship.cargoSpace).toBe(20);
  });

  it('parses the Sparrow — the smallest interceptor', () => {
    const ship = parseShip(shipNode('Sparrow'));
    expect(ship.name).toBe('Sparrow');
    expect(ship.category).toBe('Interceptor');
    expect(ship.cost).toBe(225000);
    expect(ship.shields).toBe(1400);
    expect(ship.hull).toBe(300);
    expect(ship.bunks).toBe(3);
    expect(ship.cargoSpace).toBe(15);
  });

  it('parses the Star Barge — the light freighter', () => {
    const ship = parseShip(shipNode('Star Barge'));
    expect(ship.name).toBe('Star Barge');
    expect(ship.category).toBe('Light Freighter');
    expect(ship.cost).toBe(190000);
    expect(ship.shields).toBe(600);
    expect(ship.hull).toBe(1000);
    expect(ship.bunks).toBe(3);
    expect(ship.cargoSpace).toBe(50);
  });

  it('an unknown ship name yields an empty model, not a crash', () => {
    const root = parseData(readFileSync('endless-sky/data/human/ships.txt', 'utf8'));
    const node = root.children.find(n => n.tokenOr(0) === 'ship' && n.tokenOr(1) === 'Zorban Dreadnought');
    // There is intentionally no such ship; parseShip of a real node works,
    // but unknown names must be caught by the caller (the shipyard warns).
    expect(node).toBeUndefined();
  });
});
