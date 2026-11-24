import { describe, expect, it } from 'vitest';
import { Number, AbbreviatedNumber, CreditString, replace } from './Format.ts';

// Tests mirror the reference's text/test_format.cpp class of coverage:
// number formatting and <key> substitution (the pieces the start flow uses).

describe('Number', () => {
  it('formats integers with thousands separators', () => {
    expect(Number(480000)).toBe('480,000');
    expect(Number(1000000)).toBe('1,000,000');
    expect(Number(999)).toBe('999');
  });

  it('formats zero and rounds fractional values', () => {
    expect(Number(0)).toBe('0');
    expect(Number(1234.7)).toBe('1,235');
  });
});

describe('AbbreviatedNumber', () => {
  it('shows sub-million values with thousands separators (like the reference)', () => {
    expect(AbbreviatedNumber(480000)).toBe('480,000');
    expect(AbbreviatedNumber(999999)).toBe('999,999');
    expect(AbbreviatedNumber(999)).toBe('999');
  });

  it('shows millions/billions/trillions as three-decimal suffixes', () => {
    expect(AbbreviatedNumber(1500000)).toBe('1.500M');
    expect(AbbreviatedNumber(2000000)).toBe('2.000M');
    expect(AbbreviatedNumber(12345678901)).toBe('12.345B');
  });

  it('shows values at the tier boundary without abbreviation (strict >)', () => {
    expect(AbbreviatedNumber(1000000)).toBe('1,000,000');
  });

  it('shows the sign for negative values', () => {
    expect(AbbreviatedNumber(-1500000)).toBe('-1.500M');
    expect(AbbreviatedNumber(-480000)).toBe('-480,000');
  });

  it('uses scientific notation above 1e15', () => {
    expect(AbbreviatedNumber(1e16)).toBe('1.00e+16');
  });
});

describe('CreditString', () => {
  it('uses "credit" for a single value and "credits" otherwise', () => {
    expect(CreditString(1)).toBe('1 credit');
    expect(CreditString(2)).toBe('2 credits');
    expect(CreditString(480000)).toBe('480,000 credits');
  });
});

describe('replace', () => {
  it('replaces known keys and leaves unknown keys as-is (like the reference)', () => {
    const subs = new Map([['<system>', 'Rutilicus'], ['<planet>', 'New Boston']]);
    expect(replace('System <system>, planet <planet>', subs)).toBe('System Rutilicus, planet New Boston');
    expect(replace('<missing> stays', subs)).toBe('<missing> stays');
  });

  it('replaces multiple occurrences of the same key', () => {
    const subs = new Map([['<n>', '7']]);
    expect(replace('<n> and <n>', subs)).toBe('7 and 7');
  });

  it('leaves text without angle brackets untouched', () => {
    expect(replace('plain text', new Map())).toBe('plain text');
  });
});
