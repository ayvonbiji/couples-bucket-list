import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeFantasy, effectsOfResponses, guardFantasyUpdate, hasConsent, hasMutualInterest, photosAllowed, statusBlockedReason } from './fantasy.js';

const A = 'a', B = 'b', members = [A, B];
const f = { id: 'f', created_by: A, visibility: 'shared', status: 'saved', on_wishlist: false, title: 't' };
const both = [{ user_id: A, comfortable: true }, { user_id: B, comfortable: true }];

test('private fantasies are visible only to the author', () => {
  assert.equal(canSeeFantasy({ ...f, visibility: 'private' }, A), true);
  assert.equal(canSeeFantasy({ ...f, visibility: 'private' }, B), false);
  assert.equal(canSeeFantasy(f, B), true);
});

test('consent needs both partners comfortable and no objection', () => {
  assert.equal(hasConsent([{ user_id: A, comfortable: true }], members), false);
  assert.equal(hasConsent(both, members), true);
  assert.equal(hasConsent([...both.slice(0, 1), { user_id: B, comfortable: true, reaction: 'not_comfortable' }], members), false);
});

test('sharing never implies agreement; statuses can be chosen directly', () => {
  const shared = guardFantasyUpdate({ ...f, visibility: 'private', status: 'idea' }, { visibility: 'shared' }, { actorId: A, responses: [], memberIds: members });
  assert.ok(shared.shared_at);
  assert.equal(shared.status, undefined);
  for (const s of ['agreed', 'planned', 'in_progress', 'completed']) assert.match(statusBlockedReason(f, s, [], members), /comfortable/);
  for (const s of ['idea', 'discuss', 'archived']) assert.equal(statusBlockedReason(f, s, [], members), null);
  assert.match(statusBlockedReason({ ...f, visibility: 'private' }, 'agreed', [], members), /Share it first/);
  assert.equal(statusBlockedReason({ ...f, visibility: 'private' }, 'completed', [], members), null); // personal wish
});

test('partner cannot edit content or change visibility', () => {
  const ctx = { actorId: B, responses: [], memberIds: members };
  assert.throws(() => guardFantasyUpdate(f, { title: 'x' }, ctx), /author/);
  assert.throws(() => guardFantasyUpdate(f, { visibility: 'private' }, ctx), /author/);
  assert.throws(() => guardFantasyUpdate(f, { on_wishlist: true }, ctx), /interested/);
});

test('completion records and clears the date', () => {
  const ctx = { actorId: B, responses: both, memberIds: members };
  const done = guardFantasyUpdate(f, { status: 'completed' }, ctx);
  assert.ok(done.completed_at);
  const reopened = guardFantasyUpdate({ ...f, status: 'completed', completed_at: '2026-01-01' }, { status: 'planned' }, ctx);
  assert.equal(reopened.completed_at, null);
});

test('withdrawing consent unwinds agreement and wishlist', () => {
  const agreed = { ...f, status: 'planned', on_wishlist: true };
  const r = [{ user_id: A, comfortable: true }, { user_id: B, reaction: 'not_comfortable' }];
  assert.deepEqual(effectsOfResponses(agreed, r, members), { status: 'discuss', on_wishlist: false });
  assert.equal(hasMutualInterest(f, [{ user_id: B, reaction: 'love' }]), true);
  assert.deepEqual(effectsOfResponses(f, [{ user_id: B, reaction: 'discuss' }], members, 'discuss'), { status: 'discuss' });
  assert.deepEqual(effectsOfResponses({ ...f, status: 'completed' }, r, members), {}); // history is kept
});

test('photos need both partners to agree on shared entries', () => {
  assert.equal(photosAllowed(f, [{ user_id: A, allow_photos: true }], members, A), false);
  assert.equal(photosAllowed(f, [{ user_id: A, allow_photos: true }, { user_id: B, allow_photos: true }], members, B), true);
  assert.equal(photosAllowed({ ...f, visibility: 'private' }, [], members, A), true);
  assert.equal(photosAllowed({ ...f, visibility: 'private' }, [], members, B), false);
});
