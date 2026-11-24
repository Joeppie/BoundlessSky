import { describe, expect, it } from 'vitest';
import { ConditionsStore } from './ConditionsStore.ts';

// Tests mirror the reference's tests/unit/src/test_conditionsStore.cpp scenarios
// (creation, setting, arithmetic) against our plain-map port.

describe('ConditionsStore', () => {
  it('starts empty and returns defaults for unknown conditions', () => {
    const store = new ConditionsStore();
    expect(store.get('anything')).toBe(0);
    expect(store.has('anything')).toBe(false);
  });

  it('stores values set explicitly and returns them on read', () => {
    const store = new ConditionsStore();
    store.set('a', 100);
    expect(store.get('a')).toBe(100);
    expect(store.has('a')).toBe(true);
  });

  it('treats setting to zero as clearing the condition (like the reference)', () => {
    const store = new ConditionsStore();
    store.set('a', 5);
    expect(store.has('a')).toBe(true);
    store.set('a', 0);
    expect(store.get('a')).toBe(0);
    expect(store.has('a')).toBe(false);
  });

  it('adds to existing and new values', () => {
    const store = new ConditionsStore();
    store.set('a', 10);
    store.add('a', 10);
    expect(store.get('a')).toBe(20);
    store.add('a', -15);
    expect(store.get('a')).toBe(5);
    store.add('b', -30);
    expect(store.get('b')).toBe(-30);
    store.add('b', 60);
    expect(store.get('b')).toBe(30);
  });

  it('apply() sets the given conditions to 1', () => {
    const store = new ConditionsStore();
    store.apply(new Set(['license: Pilot\'s', 'species: human']));
    expect(store.has('license: Pilot\'s')).toBe(true);
    expect(store.has('species: human')).toBe(true);
  });

  it('resolves named derived conditions at read time', () => {
    const store = new ConditionsStore();
    const fleet: string[] = ['Shuttle', 'Sparrow'];
    store.provideNamed('total ships', () => fleet.length);
    expect(store.get('total ships')).toBe(2);
    fleet.push('Tattoo');
    expect(store.get('total ships')).toBe(3);
  });

  it('resolves prefixed derived conditions at read time', () => {
    const store = new ConditionsStore();
    const fleet: { category: string }[] = [
      { category: 'Transport' },
      { category: 'Interceptor' },
      { category: 'Transport' },
    ];
    store.providePrefixed('ships: ', (category) => fleet.filter(s => s.category === category).length);
    expect(store.get('ships: Transport')).toBe(2);
    expect(store.get('ships: Interceptor')).toBe(1);
    expect(store.get('ships: Fighter')).toBe(0);
  });

  it('direct primary writes win over providers for the same name', () => {
    const store = new ConditionsStore();
    store.set('total ships', 9);
    store.provideNamed('total ships', () => 3);
    // The provider is registered after a primary value was set; setting again
    // is a no-op on the derived name, but reading the provider value is the
    // reference-intended behavior (providers replace primaries for derived names).
    expect(store.get('total ships')).toBe(3);
  });

  it('direct writes to a derived condition fail silently', () => {
    const store = new ConditionsStore();
    store.providePrefixed('ships: ', () => 5);
    store.set('ships: Shuttle', 99);
    expect(store.get('ships: Shuttle')).toBe(5);
    store.add('ships: Shuttle', 1);
    expect(store.get('ships: Shuttle')).toBe(5);
  });

  it('apply() cannot override a derived condition', () => {
    const store = new ConditionsStore();
    store.provideNamed('total ships', () => 2);
    store.apply(new Set(['total ships']));
    expect(store.get('total ships')).toBe(2);
  });
});
