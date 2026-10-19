// Unit tests for the pure logic (run: npm test). Uses Node's built-in test runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, format, subDays } from 'date-fns';
import { mutualScore, voteSummary } from './scoring.js';
import { isGiftHidden, isSurpriseHidden, filterForViewer } from './visibility.js';
import { nextOccurrence, upcomingDates, yearsAt } from './recurrence.js';
import { applyFilters, EMPTY_FILTERS, randomPick, summary, yearInReview } from './stats.js';
import { parseICS } from './ics.js';
import { validateItem, validateGift } from './validation.js';

const A = 'user-a', B = 'user-b';
const day = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd');

test('mutual badge needs both partners at 4+', () => {
  assert.equal(voteSummary([{ user_id: A, stars: 5 }, { user_id: B, stars: 4 }], A, B).mutual, true);
  assert.equal(voteSummary([{ user_id: A, stars: 5 }, { user_id: B, stars: 3 }], A, B).mutual, false);
  assert.equal(voteSummary([{ user_id: A, stars: 5 }], A, B).mutual, false);
});

test('mutual score rewards agreement and full votes', () => {
  assert.ok(mutualScore(5, 5) > mutualScore(5, 3));
  assert.ok(mutualScore(4, 4) > mutualScore(5, 2));
  assert.ok(mutualScore(4, 4) > mutualScore(4, null));
  assert.equal(mutualScore(null, null), 0);
  assert.equal(mutualScore(5, 5), 100);
});

test('surprises are hidden from the partner until revealed', () => {
  const item = { id: 'x', is_surprise: true, created_by: A, revealed_at: null, reveal_date: day(5) };
  assert.equal(isSurpriseHidden(item, A), false);
  assert.equal(isSurpriseHidden(item, B), true);
  assert.equal(isSurpriseHidden({ ...item, reveal_date: day(0) }, B), false);
  assert.equal(isSurpriseHidden({ ...item, revealed_at: new Date().toISOString() }, B), false);
});

test('hidden gifts appear on reveal date; children of hidden items are filtered', () => {
  const gift = { is_hidden: true, created_by: A, reveal_date: day(3) };
  assert.equal(isGiftHidden(gift, B), true);
  assert.equal(isGiftHidden({ ...gift, reveal_date: day(-1) }, B), false);
  const data = {
    items: [{ id: 's', is_surprise: true, created_by: A }, { id: 'n', is_surprise: false, created_by: A }],
    item_votes: [{ item_id: 's' }, { item_id: 'n' }], item_reactions: [], comments: [{ item_id: 's' }], subtasks: [], item_links: [],
    item_photos: [{ item_id: 's' }], journal_entries: [], wishlist_entries: [{ item_id: null, ...gift }],
  };
  const v = filterForViewer(data, B);
  assert.deepEqual(v.items.map((i) => i.id), ['n']);
  assert.equal(v.item_votes.length, 1);
  assert.equal(v.comments.length, 0);
  assert.equal(v.item_photos.length, 0);
  assert.equal(v.wishlist_entries.length, 0);
});

test('yearly dates roll over and count years', () => {
  const past = { date: format(subDays(new Date(), 400), 'yyyy-MM-dd'), repeats_yearly: true };
  const occ = nextOccurrence(past);
  assert.ok(occ >= new Date(new Date().setHours(0, 0, 0, 0)));
  assert.ok(yearsAt(past, occ) >= 1);
  const up = upcomingDates([{ ...past, id: 1 }, { id: 2, date: day(2), repeats_yearly: false }], 3);
  assert.equal(up[0].id, 2);
  assert.equal(up[0].days, 2);
});

test('Feb 29 falls back to Feb 28 on non-leap years', () => {
  const d = nextOccurrence({ date: '2024-02-29', repeats_yearly: true }, new Date(2025, 0, 1));
  assert.equal(format(d, 'yyyy-MM-dd'), '2025-02-28');
});

test('filters: cost, mutual, owner, search', () => {
  const items = [
    { id: 1, title: 'Cheap picnic', status: 'Idea', category: 'Food', priority: 'Someday', est_cost: 500, owner_user_id: null, tags: [], _votes: { mutual: true, score: 90 } },
    { id: 2, title: 'Paris trip', status: 'Planned', category: 'Travel', priority: 'Dream', est_cost: 200000, owner_user_id: A, tags: ['europe'], _votes: { mutual: false, score: 40 } },
  ];
  assert.deepEqual(applyFilters(items, { ...EMPTY_FILTERS, maxCost: '1000' }, A).map((i) => i.id), [1]);
  assert.deepEqual(applyFilters(items, { ...EMPTY_FILTERS, mutualOnly: true }, A).map((i) => i.id), [1]);
  assert.deepEqual(applyFilters(items, { ...EMPTY_FILTERS, owner: 'me' }, A).map((i) => i.id), [2]);
  assert.deepEqual(applyFilters(items, { ...EMPTY_FILTERS, owner: 'both' }, A).map((i) => i.id), [1]);
  assert.deepEqual(applyFilters(items, { ...EMPTY_FILTERS, q: 'europe' }, A).map((i) => i.id), [2]);
  assert.ok([1, 2].includes(randomPick(items).id));
  assert.equal(randomPick(items, 1).id, 2);
});

test('summary and year in review', () => {
  const y = new Date().getFullYear();
  const items = [
    { status: 'Completed', category: 'Food', completed_at: `${y}-01-05`, location_name: 'Kochi', actual_cost: 1000 },
    { status: 'Completed', category: 'Food', completed_at: `${y}-02-05`, location_name: 'kochi ', est_cost: 500 },
    { status: 'Idea', category: 'Travel' },
  ];
  const s = summary(items);
  assert.equal(s.pct, 67);
  const r = yearInReview({ items, journal_entries: [], item_photos: [{ created_at: `${y}-01-05T00:00:00Z` }] }, y);
  assert.equal(r.completed, 2);
  assert.equal(r.places, 1);
  assert.equal(r.spent, 1500);
  assert.equal(r.photos, 1);
});

test('ICS parser handles folding and all-day events', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART;VALUE=DATE:20261024\r\nSUMMARY:Dinner with\r\n  friends\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const [e] = parseICS(ics);
  assert.equal(e.start, '2026-10-24');
  assert.equal(e.title, 'Dinner with friends');
});

test('validation', () => {
  assert.ok(validateItem({ title: '', category: 'Food', priority: 'Low', status: 'Idea' }).title);
  assert.deepEqual(validateItem({ title: 'Ok', category: 'Food', priority: 'Low', status: 'Idea', est_cost: '10' }), {});
  assert.ok(validateItem({ title: 'Ok', category: 'Food', priority: 'Low', status: 'Idea', start_date: '2026-05-02', end_date: '2026-05-01' }).end_date);
  assert.ok(validateItem({ title: 'Ok', category: 'Food', priority: 'Low', status: 'Idea' }, { requireCreator: true }).creator_id);
  assert.deepEqual(validateItem({ title: 'Ok', category: 'Food', priority: 'Low', status: 'Idea', creator_id: A }, { requireCreator: true }), {});
  assert.ok(validateGift({ name: 'x', is_hidden: true }).reveal_date);
  assert.ok(validateGift({ name: 'x', url: 'ftp://nope' }).url);
});
