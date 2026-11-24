// Date (day, month, year) — a faithful subset of the reference's Date class
// (endless-sky/source/Date.h): display strings only; the date is stored as a
// day counter internally so arithmetic is exact for whole days.
//
// Format strings match the reference's DMY convention (default):
// "Sat, 16 Nov 3013" and long-form "the 16th of November".

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export class Date {
  day = 0;
  month = 0;
  year = 0;

  constructor(day = 0, month = 0, year = 0) {
    this.day = day;
    this.month = month;
    this.year = year;
  }

  // Whether this date is initialized (any of the three fields is set).
  valid(): boolean {
    return this.day !== 0 || this.month !== 0 || this.year !== 0;
  }

  // "Sat, 16 Nov 3013"
  toString(): string {
    if (!this.valid()) return '';
    const month = MONTHS[this.month - 1] ?? `?${this.month}`;
    return `${this.weekday()}, ${this.day} ${month} ${this.year}`;
  }

  private weekday(): string {
    let day = this.day;
    let month = this.month;
    let year = this.year;
    if (month < 3) {
      year -= 1;
      month += 12;
    }
    const offset = (day + Math.floor((13 * (month + 1)) / 5) + year + Math.floor(year / 4) + 6 * Math.floor(year / 100) + Math.floor(year / 400)) % 7;
    const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return DAYS[offset];
  }

  // "the 16th of November"
  longString(): string {
    if (!this.valid()) return '';
    const month = MONTHS_LONG[this.month - 1] ?? `?${this.month}`;
    return `the ${this.day}${daySuffix(this.day)} of ${month}`;
  }
}

function daySuffix(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
