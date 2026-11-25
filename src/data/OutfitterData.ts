// The outfitter loader — fetches and parses the outfit/shop data for the
// given outfitters (whatever the landing planet names — the planet's own
// `outfitters` list is the source of truth, never a hardcoded shop).
//
// Milestone-1 scoped: the outfit catalog (outfits.txt, weapons.txt,
// engines.txt, power.txt — the files the reference's outfitter sells), the
// outfitter's stock (from sales.txt), and the category order (categories.txt).
// Outfits are not installed yet — the screen is a read-only preview
// (installation is Milestone 3).

import { parseData } from './DataParser';
import type { DataNode } from './DataNode';
import { fetchText } from './fetchText';
import { parseOutfit, type Outfit } from '../game/Outfit';

export const OUTFIT_CATEGORIES = ['Guns', 'Turrets', 'Secondary Weapons', 'Ammunition', 'Systems', 'Power', 'Engines', 'Hand to Hand', 'Unique', 'Minerals', 'Special', 'Licenses'];

// Parse one sales.txt root node into a stock set of bare outfit names for the
// outfitters named in `names`. Throws a clear error when a name is missing.
export function parseOutfitterStockSet(salesNode: DataNode, names: string[]): Set<string> {
  const stockSet = new Set<string>();
  for (const name of names) {
    const node = salesNode.children.find(n => n.tokenOr(0) === 'outfitter' && n.tokenOr(1) === name);
    if (!node) throw new Error(`outfitter "${name}" not found in sales.txt`);
    for (const entry of node.children) {
      if (entry.getSize() !== 1) continue;
      stockSet.add(entry.tokens[0]);
    }
  }
  return stockSet;
}

// Group a catalog by category for the given stock names, in the categories.txt
// display order (Guns → Licenses), with unlisted categories after.
export function groupStockByCategory(catalog: Map<string, Outfit>, stockSet: Set<string>): Map<string, Outfit[]> {
  const grouped = new Map<string, Outfit[]>();
  for (const outfit of catalog.values()) {
    if (!stockSet.has(outfit.name)) continue;
    const category = outfit.category || 'Other';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(outfit);
  }
  const ordered = new Map<string, Outfit[]>();
  for (const category of OUTFIT_CATEGORIES) {
    if (grouped.has(category)) ordered.set(category, grouped.get(category)!);
  }
  for (const [category, outfits] of grouped) {
    if (!ordered.has(category)) ordered.set(category, outfits);
  }
  return ordered;
}

const OUTFIT_URLS = [
  '/content/data/human/outfits.txt',
  '/content/data/human/weapons.txt',
  '/content/data/human/engines.txt',
  '/content/data/human/power.txt',
];
const SALES_URL = '/content/data/human/sales.txt';

let catalogPromise: Promise<Map<string, Outfit>> | null = null;

// The same memoized catalog the outfitter loads (all four outfit files).
export function loadOutfitCatalog(onWarn?: (message: string) => void): Promise<Map<string, Outfit>> {
  return loadCatalog(onWarn);
}

async function loadCatalog(onWarn?: (message: string) => void): Promise<Map<string, Outfit>> {
  if (!catalogPromise) {
    const promise = (async () => {
      const texts = await Promise.all(OUTFIT_URLS.map(u => fetchText(u)));
      const catalog = new Map<string, Outfit>();
      for (const [text, url] of texts.map((t, i) => [t, OUTFIT_URLS[i]] as const)) {
        const root = parseData(text, { onWarn });
        for (const node of root.children) {
          if (node.tokenOr(0) !== 'outfit') continue;
          const outfit = parseOutfit(node, onWarn);
          if (!outfit.name) continue;
          if (catalog.has(outfit.name)) {
            onWarn?.(`duplicate outfit "${outfit.name}" in ${url} — skipped`);
            continue;
          }
          catalog.set(outfit.name, outfit);
        }
      }
      return catalog;
    })();
    promise.catch(() => { if (catalogPromise === promise) catalogPromise = null; });
    catalogPromise = promise;
  }
  return catalogPromise;
}

async function loadSales(onWarn?: (message: string) => void): Promise<DataNode> {
  const text = await fetchText(SALES_URL);
  return parseData(text, { onWarn });
}

// Resolve the outfitters named in `names` to their outfits (union, in
// category order, deduped). Throws a clear error when a name is missing.
export async function loadOutfitterStock(
  outfitterNames: string[],
  onWarn?: (message: string) => void,
): Promise<Map<string, Outfit[]>> {
  const [catalog, salesNode] = await Promise.all([loadCatalog(onWarn), loadSales(onWarn)]);
  const stockSet = parseOutfitterStockSet(salesNode, outfitterNames);
  return groupStockByCategory(catalog, stockSet);
}
