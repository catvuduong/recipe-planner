import { currentWeekMonday, mondayOf, parseIsoDay, weekDays } from './dates.js';

describe('UTC week helpers', () => {
  it('parses a YYYY-MM-DD string as UTC midnight', () => {
    expect(parseIsoDay('2026-10-30')?.toISOString()).toBe('2026-10-30T00:00:00.000Z');
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseIsoDay('2026-02-30')).toBeNull();
    expect(parseIsoDay('30/10/2026')).toBeNull();
    expect(parseIsoDay(undefined)).toBeNull();
  });

  it('finds the Monday of the week for every weekday', () => {
    // 2026-10-26 is a Monday.
    for (const day of [
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]) {
      expect(mondayOf(parseIsoDay(day)!)).toBe('2026-10-26');
    }
  });

  it('moves to the next week exactly at UTC midnight on Monday', () => {
    expect(mondayOf(new Date('2026-11-01T23:59:59.999Z'))).toBe('2026-10-26');
    expect(mondayOf(new Date('2026-11-02T00:00:00.000Z'))).toBe('2026-11-02');
  });

  it('defaults to the current week in UTC', () => {
    expect(currentWeekMonday(new Date('2026-10-30T12:00:00.000Z'))).toBe('2026-10-26');
  });

  it('lists the seven days from a Monday', () => {
    expect(weekDays('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });
});
