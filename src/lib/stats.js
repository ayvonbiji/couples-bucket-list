// Aggregates for the Dashboard, Year-in-review, filters and the "Surprise me" picker.
import { endOfWeek, isWeekend, nextSaturday, nextSunday, startOfDay, format, addDays } from 'date-fns';
import { STATUSES } from './constants.js';
import { voteSummary } from './scoring.js';
import { sortBy, toDate, todayISO } from './utils.js';

/** Index helpers: group rows by item_id once per render. */
export function groupByItem(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r.item_id) continue;
    if (!m.has(r.item_id)) m.set(r.item_id, []);
    m.get(r.item_id).push(r);
  }
  return m;
}

/** Status / category counts and completion percentage. */
export function summary(items) {
  const year = new Date().getFullYear();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byCategory = {};
  let completedThisYear = 0;
  for (const i of items) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    const c = byCategory[i.category] || (byCategory[i.category] = { total: 0, done: 0 });
    c.total++;
    if (i.status === 'Completed') {
      c.done++;
      if (toDate(i.completed_at)?.getFullYear() === year) completedThisYear++;
    }
  }
  const total = items.length;
  const completed = byStatus.Completed || 0;
  return { total, completed, byStatus, byCategory, completedThisYear, pct: total ? Math.round((completed / total) * 100) : 0 };
}

/** Year in review: items completed, photos added, places visited, total spent. */
export function yearInReview(data, year = new Date().getFullYear()) {
  const inYear = (v) => toDate(v)?.getFullYear() === year;
  const done = data.items.filter((i) => i.status === 'Completed' && inYear(i.completed_at));
  const manual = data.journal_entries.filter((j) => !j.item_id && inYear(j.entry_date));
  const places = new Set(
    [...done.map((i) => i.location_name), ...manual.map((j) => j.location_name)]
      .filter(Boolean).map((s) => s.trim().toLowerCase())
  );
  const spent = done.reduce((s, i) => s + Number(i.actual_cost ?? i.est_cost ?? 0), 0);
  const photos = data.item_photos.filter((p) => inYear(p.created_at)).length;
  const topCategory = Object.entries(
    done.reduce((m, i) => ((m[i.category] = (m[i.category] || 0) + 1), m), {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const ratings = done.map((i) => i.would_do_again).filter(Boolean);
  return {
    year,
    completed: done.length,
    journalEntries: manual.length,
    photos,
    places: places.size,
    spent,
    topCategory,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}

/** Items with vote summaries attached. */
export function withVotes(items, votes, meId, partnerId) {
  const g = groupByItem(votes);
  return items.map((i) => ({ ...i, _votes: voteSummary(g.get(i.id) || [], meId, partnerId) }));
}

/** Top picks: open items ranked by mutual score. */
export function topPicks(items, votes, meId, partnerId, n = 5) {
  return sortBy(
    withVotes(items.filter((i) => i.status !== 'Completed'), votes, meId, partnerId).filter((i) => i._votes.score > 0),
    (i) => i._votes.score * 10 + (i._votes.mutual ? 1000 : 0),
    -1
  ).slice(0, n);
}

/** Upcoming planned items with a start date (today or later). */
export function upcomingItems(items, n = 5) {
  const t = todayISO();
  return sortBy(items.filter((i) => i.status !== 'Completed' && i.start_date && i.start_date >= t), (i) => i.start_date).slice(0, n);
}

/** Recent activity across tables, newest first. */
export function activityFeed(data, n = 12) {
  const title = new Map(data.items.map((i) => [i.id, i.title]));
  const ev = [];
  for (const i of data.items) {
    ev.push({ kind: 'added', at: i.created_at, user: i.created_by, itemId: i.id, text: `added “${i.title}”` });
    if (i.status === 'Completed' && i.completed_at)
      ev.push({ kind: 'completed', at: i.updated_at || i.completed_at, user: null, itemId: i.id, text: `completed “${i.title}”` });
  }
  for (const c of data.comments) ev.push({ kind: 'comment', at: c.created_at, user: c.user_id, itemId: c.item_id, text: `commented on “${title.get(c.item_id) ?? 'an item'}”` });
  for (const v of data.item_votes) ev.push({ kind: 'vote', at: v.updated_at, user: v.user_id, itemId: v.item_id, text: `rated “${title.get(v.item_id) ?? 'an item'}” ${''.repeat(v.stars)}` });
  for (const p of data.item_photos) if (p.item_id) ev.push({ kind: 'photo', at: p.created_at, user: p.uploaded_by, itemId: p.item_id, text: `added a photo to “${title.get(p.item_id) ?? 'an item'}”` });
  return sortBy(ev.filter((e) => e.at), (e) => e.at, -1).slice(0, n);
}

/** Per-partner light stats. */
export function partnerSnapshot(data, userId) {
  return {
    added: data.items.filter((i) => i.created_by === userId).length,
    completedOwned: data.items.filter((i) => i.status === 'Completed' && (i.owner_user_id === userId || !i.owner_user_id)).length,
    votes: data.item_votes.filter((v) => v.user_id === userId).length,
    comments: data.comments.filter((c) => c.user_id === userId).length,
  };
}

// ---------------------------------------------------------------------------
// Filtering & sorting (List view, Surprise me)
// ---------------------------------------------------------------------------
export const EMPTY_FILTERS = {
  q: '', categories: [], statuses: [], priorities: [], owner: 'any', createdBy: 'any', minScore: 0,
  mutualOnly: false, minCost: '', maxCost: '', when: 'any', hideCompleted: false, timeRequired: [],
  targetFrom: '', targetTo: '', completedFrom: '', completedTo: '',
};

/** Is the item's date (or timeframe) inside the "when" window? */
function matchesWhen(item, when) {
  if (when === 'any') return true;
  const today = startOfDay(new Date());
  const d = toDate(item.start_date);
  if (when === 'undated') return !d;
  if (!d) return false;
  let from = today, to;
  if (when === 'weekend') {
    from = isWeekend(today) ? today : nextSaturday(today);
    to = isWeekend(today) && today.getDay() === 0 ? today : nextSunday(from);
  } else if (when === 'week') to = endOfWeek(today, { weekStartsOn: 1 });
  else if (when === 'month') to = addDays(today, 30);
  else if (when === 'year') to = addDays(today, 365);
  return d >= from && d <= to;
}

/**
 * Filter items. `owner` is 'any' | 'me' | 'partner' | 'both'.
 * Items must already carry `_votes` (see withVotes) for score filters.
 */
export function applyFilters(items, f, meId) {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) => {
    if (f.hideCompleted && i.status === 'Completed') return false;
    if (q && ![i.title, i.description, i.notes, i.subcategory, i.location_name, i.category, ...(i.tags || [])].some((s) => s?.toLowerCase().includes(q))) return false;
    if (f.categories.length && !f.categories.includes(i.category)) return false;
    if (f.statuses.length && !f.statuses.includes(i.status)) return false;
    if (f.priorities.length && !f.priorities.includes(i.priority)) return false;
    if (f.owner === 'both' && i.owner_user_id) return false;
    if (f.owner === 'me' && i.owner_user_id !== meId) return false;
    if (f.owner === 'partner' && (!i.owner_user_id || i.owner_user_id === meId)) return false;
    if (f.mutualOnly && !i._votes?.mutual) return false;
    if (f.minScore && (i._votes?.score ?? 0) < f.minScore) return false;
    if (f.maxCost !== '' && f.maxCost !== null && f.maxCost !== undefined && Number(i.est_cost || 0) > Number(f.maxCost)) return false;
    if (f.minCost && Number(i.est_cost || 0) < Number(f.minCost)) return false;
    // "Created by" = the creator chosen on the item (creator_id), not who typed it in.
    if (f.createdBy === 'me' && i.creator_id !== meId) return false;
    if (f.createdBy === 'partner' && (!i.creator_id || i.creator_id === meId)) return false;
    if (f.createdBy === 'both' && !i.added_by_both) return false;
    if (f.timeRequired?.length && !f.timeRequired.includes(i.time_required)) return false;
    if (f.targetFrom && (!i.start_date || i.start_date < f.targetFrom)) return false;
    if (f.targetTo && (!i.start_date || i.start_date > f.targetTo)) return false;
    if (f.completedFrom && (!i.completed_at || i.completed_at < f.completedFrom)) return false;
    if (f.completedTo && (!i.completed_at || i.completed_at > f.completedTo)) return false;
    if (!matchesWhen(i, f.when)) return false;
    return true;
  });
}

export const SORTS = {
  mutual:   { label: 'Mutual priority', fn: (i) => (i._votes?.mutual ? 1000 : 0) + (i._votes?.score ?? 0), dir: -1 },
  newest:   { label: 'Newest',          fn: (i) => i.created_at, dir: -1 },
  date:     { label: 'Soonest date',    fn: (i) => i.start_date || null, dir: 1 },
  priority: { label: 'Priority',        fn: (i) => ({ High: 0, Medium: 1, Low: 2 })[i.priority] ?? 3, dir: 1 },
  cost:     { label: 'Cheapest',        fn: (i) => (i.est_cost === null || i.est_cost === undefined ? null : Number(i.est_cost)), dir: 1 },
  title:    { label: 'A → Z',           fn: (i) => i.title.toLowerCase(), dir: 1 },
};

export const applySort = (items, key) => {
  const s = SORTS[key] || SORTS.mutual;
  return sortBy(items, s.fn, s.dir);
};

/** Weighted random pick — mutual favourites are a little more likely. */
export function randomPick(items, excludeId = null) {
  const pool = items.filter((i) => i.id !== excludeId);
  const list = pool.length ? pool : items;
  if (!list.length) return null;
  const weights = list.map((i) => 1 + (i._votes?.score ?? 0) / 25 + (i._votes?.mutual ? 2 : 0));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < list.length; k++) if ((r -= weights[k]) <= 0) return list[k];
  return list[list.length - 1];
}

export const isoDay = (d) => format(d, 'yyyy-MM-dd');
