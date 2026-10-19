// Client-side validation. The database CHECK constraints are the final authority;
// these give friendly messages before a round-trip.
import { PRIORITIES, STATUSES } from './constants.js';

const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);
const num = (v) => v === '' || v === null || v === undefined || (!Number.isNaN(Number(v)) && Number(v) >= 0);

/**
 * Returns { field: message } — empty object means valid.
 * `requireCreator`: new items must say explicitly who created the dream (Ayvon or Aksa).
 */
export function validateItem(v, { requireCreator = false } = {}) {
  const e = {};
  if (requireCreator && !v.creator_id) e.creator_id = 'Choose who created this dream';
  if (!v.title || !v.title.trim()) e.title = 'Give it a name';
  else if (v.title.length > 140) e.title = 'Keep the title under 140 characters';
  if (!v.category && !v.category_id) e.category = 'Pick a category';
  if (!PRIORITIES.includes(v.priority)) e.priority = 'Pick a priority';
  if (!STATUSES.includes(v.status)) e.status = 'Pick a status';
  if (!num(v.est_cost)) e.est_cost = 'Cost must be a positive number';
  if (!num(v.savings_target)) e.savings_target = 'Must be a positive number';
  if (!num(v.savings_saved)) e.savings_saved = 'Must be a positive number';
  if (v.start_date && v.end_date && v.end_date < v.start_date) e.end_date = 'End date is before the start date';
  if (v.lat !== null && v.lat !== undefined && v.lat !== '' && (v.lat < -90 || v.lat > 90)) e.location = 'Invalid map pin';
  if (v.is_surprise && v.reveal_date === '') delete e.reveal_date;
  return e;
}

export function validateGift(v) {
  const e = {};
  if (!v.name?.trim()) e.name = 'What is the gift?';
  if (v.url && !isUrl(v.url)) e.url = 'Links must start with http:// or https://';
  if (!num(v.price)) e.price = 'Price must be a positive number';
  if (v.is_hidden && !v.reveal_date) e.reveal_date = 'Pick when it should be revealed';
  return e;
}

export function validateDate(v) {
  const e = {};
  if (!v.title?.trim()) e.title = 'Give this day a name';
  if (!v.date) e.date = 'Pick the date';
  const off = Number(v.reminder_offset_days);
  if (Number.isNaN(off) || off < 0 || off > 365) e.reminder_offset_days = '0–365 days';
  return e;
}

export function validateLink(url) {
  return isUrl(url) ? null : 'Links must start with http:// or https://';
}

export function validateJournal(v) {
  const e = {};
  if (!v.title?.trim()) e.title = 'Give this memory a title';
  if (!v.entry_date) e.entry_date = 'When did it happen?';
  return e;
}

/** Normalise numeric form fields ('' → null). */
export const toNum = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
