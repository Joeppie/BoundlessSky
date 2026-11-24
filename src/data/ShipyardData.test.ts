import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from './DataParser.ts';
import { parseShipyard } from './ShipyardData.ts';

// Tests mirror the reference's "Basic Ships" stock (New Boston shipyard) —
// the only stock this milestone serves.

describe('ShipyardData (from sales.txt + ships.txt)', () => {
  const sales = parseData(readFileSync('endless-sky/data/human/sales.txt', 'utf8'));
  const ships = parseData(readFileSync('endless-sky/data/human/ships.txt', 'utf8'));

  it('resolves the "Basic Ships" stock to three paid models', () => {
    const stock = parseShipyard(sales, ships, 'Basic Ships');
    expect(stock.name).toBe('Basic Ships');
    expect(stock.ships.map(s => s.name)).toEqual(['Shuttle', 'Sparrow', 'Star Barge']);
    expect(stock.ships.map(s => s.category)).toEqual(['Transport', 'Interceptor', 'Light Freighter']);
    expect(stock.ships.map(s => s.cost)).toEqual([180000, 225000, 190000]);
  });

  it('throws a clear error for an unknown shipyard', () => {
    expect(() => parseShipyard(sales, ships, 'No Such Shipyard')).toThrow(/No Such Shipyard/);
  });

  it('warns about a ship in the stock that ships.txt does not define', () => {
    // Synthesize a malformed stock entry — the loader must keep the rest.
    const bogus = parseData('shipyard "Bogus"\n\t"Shuttle"\n\t"Not A Real Ship"\n');
    const warnings: string[] = [];
    const stock = parseShipyard(bogus, ships, 'Bogus', (m) => warnings.push(m));
    expect(stock.ships.map(s => s.name)).toEqual(['Shuttle']);
    expect(warnings.some(w => w.includes('Not A Real Ship'))).toBe(true);
  });
});
