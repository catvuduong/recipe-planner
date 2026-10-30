// Week maths in UTC, matching the API, so the planner and the server agree on which days belong to a week.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string | null | undefined): value is string {
  return !!value && ISO_DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return toIsoDay(new Date());
}

export function mondayOf(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return toIsoDay(date);
}

export function shiftWeek(monday: string, weeks: number): string {
  const date = new Date(`${monday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return toIsoDay(date);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${monday}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return toIsoDay(date);
  });
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const longDayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatDayShort(isoDay: string): string {
  return dayFormat.format(new Date(`${isoDay}T00:00:00Z`));
}

export function formatDayLong(isoDay: string): string {
  return longDayFormat.format(new Date(`${isoDay}T00:00:00Z`));
}

export function formatWeekRange(monday: string): string {
  const sunday = weekDays(monday)[6];
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(`${sunday}T00:00:00Z`);
  const year = end.getUTCFullYear();
  return `${monthFormat.format(start)} – ${monthFormat.format(end)} ${year}`;
}
