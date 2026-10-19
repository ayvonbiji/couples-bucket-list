// Important-date maths: next occurrence of yearly dates, reminder windows, years count.
import { addYears, differenceInCalendarDays, format, getYear, setYear, startOfDay } from 'date-fns';
import { toDate } from './utils.js';

/** Next occurrence (today or later) of an important date. Non-repeating dates return the date itself. */
export function nextOccurrence(d, from = new Date()) {
  const base = toDate(d.date);
  if (!base) return null;
  const today = startOfDay(from);
  if (!d.repeats_yearly) return base;
  let next = safeSetYear(base, getYear(today));
  if (next < today) next = safeSetYear(base, getYear(today) + 1);
  return next;
}

// Feb 29 → Feb 28 on non-leap years.
function safeSetYear(date, year) {
  const r = setYear(date, year);
  return r.getMonth() !== date.getMonth() ? new Date(year, 1, 28) : r;
}

/** Number of years being celebrated at the next occurrence (e.g. "3rd anniversary"). */
export function yearsAt(d, occurrence) {
  const base = toDate(d.date);
  if (!base || !occurrence) return null;
  const n = getYear(occurrence) - getYear(base);
  return n > 0 ? n : null;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Our anniversary · 3rd" — adds the year count for anniversaries & milestones (not birthdays). */
export function occurrenceTitle(d, years) {
  return years && d.kind !== 'birthday' ? `${d.title} · ${ordinal(years)}` : d.title;
}

/** All occurrences of a date inside [start, end] (for calendar rendering). */
export function occurrencesBetween(d, start, end) {
  const base = toDate(d.date);
  if (!base) return [];
  if (!d.repeats_yearly) return base >= start && base <= end ? [base] : [];
  const out = [];
  for (let y = getYear(start); y <= getYear(end); y++) {
    const occ = safeSetYear(base, y);
    if (occ >= base && occ >= start && occ <= end) out.push(occ);
  }
  return out;
}

/** Upcoming important dates sorted by soonest, with countdown info. */
export function upcomingDates(dates, limit = 3, from = new Date()) {
  return dates
    .map((d) => {
      const occ = nextOccurrence(d, from);
      return occ ? { ...d, occurrence: format(occ, 'yyyy-MM-dd'), days: differenceInCalendarDays(occ, startOfDay(from)), years: yearsAt(d, occ) } : null;
    })
    .filter((d) => d && d.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}

/** Is today inside this date's reminder window (offset days before → the day itself)? */
export function inReminderWindow(d, from = new Date()) {
  const occ = nextOccurrence(d, from);
  if (!occ) return false;
  const days = differenceInCalendarDays(occ, startOfDay(from));
  return days >= 0 && days <= (d.reminder_offset_days ?? 0);
}

export { addYears };
