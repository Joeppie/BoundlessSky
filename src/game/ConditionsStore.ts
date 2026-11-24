// The condition store — named flags ("license: Pilot's", "species: human",
// "start: default", ...) and derived conditions ("total ships",
// "ships: Fighter", ...) that conditions read and assignments write.
//
// Faithful-enough subset of the reference's ConditionsStore (endless-sky/source/
// ConditionsStore.h): plain named primary entries plus derived providers —
// a named provider (exact name) and a prefixed provider (a prefix + suffix),
// resolved lazily at read time, exactly like the reference's get/set split.
// A direct primary write on a name that has a read-only provider fails
// silently, like the reference.

export class ConditionsStore {
  private entries = new Map<string, number>();
  private namedProviders = new Map<string, () => number>();
  // Insertion-ordered: the first prefix that matches the name wins, like the
  // reference's prefix-provider lookup (longest prefixes registered last
  // still match — the reference resolves by prefix match on the entry name).
  private prefixedProviders: { prefix: string; fn: (nameWithoutPrefix: string) => number }[] = [];

  // A condition is true when the store holds a non-zero value for it.
  has(name: string): boolean {
    return this.get(name) !== 0;
  }

  get(name: string): number {
    // Primary value wins over derived providers (the reference's storage
    // holds the exact-entry first, then falls back to prefix matching).
    if (this.entries.has(name)) return this.entries.get(name)!;

    const named = this.namedProviders.get(name);
    if (named) return named();

    for (const { prefix, fn } of this.prefixedProviders) {
      if (name.startsWith(prefix)) return fn(name.slice(prefix.length));
    }

    return 0;
  }

  set(name: string, value: number): void {
    if (this.isDerived(name)) return; // redundant: derived conditions are read-only
    if (value === 0) {
      this.entries.delete(name);
    } else {
      this.entries.set(name, value);
    }
  }

  add(name: string, value: number): void {
    if (this.isDerived(name)) return; // silent fail, like the reference
    this.set(name, this.get(name) + value);
  }

  // Register a named derived condition (exact-name match, e.g. "total ships").
  provideNamed(name: string, fn: () => number): void {
    this.namedProviders.set(name, fn);
    // A primary value registered before the provider would shadow it; clear it.
    this.entries.delete(name);
  }

  // Register a prefixed derived condition (e.g. "ships: " → "ships: Fighter").
  providePrefixed(prefix: string, fn: (nameWithoutPrefix: string) => number): void {
    this.prefixedProviders.push({ prefix, fn });
  }

  // Apply a set of "set" conditions (from a start scenario's conditions block).
  apply(set: Set<string>): void {
    for (const name of set) this.set(name, 1);
  }

  private isDerived(name: string): boolean {
    if (this.namedProviders.has(name)) return true;
    return this.prefixedProviders.some(p => name.startsWith(p.prefix));
  }
}
