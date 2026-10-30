// All calendar maths is done in UTC so results never depend on the machine's timezone.

export const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Returns the UTC midnight for a YYYY-MM-DD string, or null if it is not a real calendar date.
export function parseIsoDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || formatIsoDay(date) !== value ? null : date;
}

export function formatIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Monday of the ISO week containing `date`, as a YYYY-MM-DD string.
export function mondayOf(date: Date): string {
  const weekday = (date.getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  return formatIsoDay(addDays(date, -weekday));
}

export function currentWeekMonday(now: Date = new Date()): string {
  return mondayOf(now);
}

// The seven days of a week that starts on `monday`.
export function weekDays(monday: string): string[] {
  const start = parseIsoDay(monday);
  if (!start) throw new Error(`not a date: ${monday}`);
  return Array.from({ length: 7 }, (_, i) => formatIsoDay(addDays(start, i)));
}
