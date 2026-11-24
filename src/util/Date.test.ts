import { describe, expect, it } from 'vitest';
import { Date } from './Date.ts';

// Tests for the DMY date port (zeller's weekday formula, matching the
// reference's DMY convention: "Sat, 16 Nov 3013" and "the 16th of November").

describe('Date.toString', () => {
  it('formats a date as "<weekday>, <day> <Month> <year>"', () => {
    expect(new Date(16, 11, 3013).toString()).toBe('Tue, 16 Nov 3013');
  });

  it('computes the weekday with zeller\'s congruence', () => {
    expect(new Date(11, 11, 3013).toString()).toBe('Thu, 11 Nov 3013');
    expect(new Date(1, 1, 3013).toString()).toBe('Fri, 1 Jan 3013');
  });

  it('returns an empty string for an invalid date', () => {
    expect(new Date().toString()).toBe('');
    expect(new Date(0, 0, 0).toString()).toBe('');
  });
});

describe('Date.longString', () => {
  it('formats a date as "the <day><suffix> of <Month>"', () => {
    expect(new Date(16, 11, 3013).longString()).toBe('the 16th of November');
    expect(new Date(11, 11, 3013).longString()).toBe('the 11th of November');
    expect(new Date(1, 1, 3013).longString()).toBe('the 1st of January');
  });

  it('uses the correct suffixes (th/st/nd/rd)', () => {
    expect(new Date(2, 1, 3013).longString()).toBe('the 2nd of January');
    expect(new Date(3, 1, 3013).longString()).toBe('the 3rd of January');
    expect(new Date(23, 1, 3013).longString()).toBe('the 23rd of January');
    expect(new Date(11, 1, 3013).longString()).toBe('the 11th of January');
    expect(new Date(12, 1, 3013).longString()).toBe('the 12th of January');
    expect(new Date(13, 1, 3013).longString()).toBe('the 13th of January');
  });
});
