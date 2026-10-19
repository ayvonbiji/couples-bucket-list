// Small, dependency-light helpers used across the app.
import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';

/** Join class names, skipping falsy values. */
export const cn = (...xs) => xs.filter(Boolean).join(' ');

/** RFC4122 v4 id (crypto.randomUUID where available). */
export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

/** Today's date as yyyy-MM-dd in local time. */
export const todayISO = () => format(new Date(), 'yyyy-MM-dd');

/** Parse a yyyy-MM-dd (or full ISO) string safely; returns null if invalid. */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isValid(v) ? v : null;
  const d = parseISO(String(v));
  return isValid(d) ? d : null;
}

export function fmtDate(v, pattern = 'd MMM yyyy') {
  const d = toDate(v);
  return d ? format(d, pattern) : '';
}

/** Whole days from today until the given date (negative = past). */
export function daysUntil(v) {
  const d = toDate(v);
  return d ? differenceInCalendarDays(d, new Date()) : null;
}

/** Friendly countdown label: "Today", "Tomorrow", "in 12 days", "3 days ago". */
export function countdownLabel(v) {
  const n = daysUntil(v);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function fmtMoney(amount, currency = 'INR') {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (Number.isNaN(n)) return '';
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, {
      style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

/** Relative "time ago" for activity feeds. */
export function timeAgo(v) {
  const d = toDate(v);
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return format(d, 'd MMM');
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Stable sort by a key function. */
export const sortBy = (arr, fn, dir = 1) =>
  [...arr].sort((a, b) => {
    const x = fn(a), y = fn(b);
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return x > y ? dir : -dir;
  });

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Turn an error of any shape into a short human message. */
export function errMsg(e) {
  if (!e) return 'Something went wrong';
  if (typeof e === 'string') return e;
  return e.message || e.error_description || e.msg || 'Something went wrong';
}
