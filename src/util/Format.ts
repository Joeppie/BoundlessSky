// Text formatting helpers, a faithful subset of the reference's text/Format.h
// (endless-sky/source/text/Format.h): number formatting, unit strings and the
// <key> substitution loop used by conversations and log entries.

// Format an integer with thousands separators, e.g. 480000 → "480,000".
export function Number(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Abbreviated number, a faithful port of the reference's Format::AbbreviatedNumber
// (endless-sky/source/text/Format.cpp): values under 1M show with thousands
// separators, millions/billions/trillions show as "1.500M" style suffixes, and
// values above 1e15 use scientific notation.
export function AbbreviatedNumber(value: number): string {
  const isNegative = value < 0;
  const absolute = Math.abs(value);
  if (absolute > 1e15) {
    return value.toPrecision(3);
  }

  if (absolute > 1e12 || absolute > 1e9 || absolute > 1e6) {
    // The same threshold/suffix ladder as the reference, in the same order.
    let suffix = 'M';
    let threshold = 1e6;
    if (absolute > 1e12) { suffix = 'T'; threshold = 1e12; }
    else if (absolute > 1e9) { suffix = 'B'; threshold = 1e9; }

    let result = suffix;
    let decimals = Math.floor(absolute / (threshold / 1000)) % 1000;
    for (let d = 0; d < 3; ++d) {
      result += String(decimals % 10);
      decimals = Math.floor(decimals / 10);
    }
    result += '.';
    const scaled = Math.floor(absolute / threshold);
    result = formatIntegerReverse(scaled, isNegative, result);
    return result;
  }

  return formatInteger(absolute, isNegative);
}

// Build the digits backwards (like the reference, so reversed output matches),
// then reverse the whole string.
function formatInteger(value: number, isNegative: boolean): string {
  return formatIntegerReverse(value, isNegative, '');
}

function formatIntegerReverse(value: number, isNegative: boolean, prefix: string): string {
  let places = 0;
  let v = value;
  let result = prefix;
  do {
    if (places && !(places % 3)) result += ',';
    ++places;
    result += String(v % 10);
    v = Math.floor(v / 10);
  } while (v);
  if (isNegative) result += '-';
  return result.split('').reverse().join('');
}

// Format a value as a credit string, e.g. "1 credit", "2 credits", "480,000 credits".
export function CreditString(value: number): string {
  if (value === 1) return '1 credit';
  return `${Number(value)} credits`;
}

// Replace <key> substitutions in the source with the values in the given map.
// Unknown <key>s are left as-is, like the reference.
export function replace(source: string, keys: Map<string, string>): string {
  let target = '';
  let start = 0;
  let search = 0;
  while (search < source.length) {
    const left = source.indexOf('<', search);
    if (left === -1) break;
    const right = source.indexOf('>', left);
    if (right === -1) break;
    const key = source.slice(left, right + 1);
    const sub = keys.get(key);
    if (sub !== undefined) {
      target += source.slice(start, left) + sub;
      start = right + 1;
      search = start;
    } else {
      search = left + 1;
    }
  }
  target += source.slice(start);
  return target;
}

// Minimal "expansion" for <credits> / <raw> / <scaled> condition formatting,
// enough to render the start scenario's date/credits/debt strings.
export function AbbreviatedCredits(value: number): string {
  return `${AbbreviatedNumber(value)} credits`;
}
