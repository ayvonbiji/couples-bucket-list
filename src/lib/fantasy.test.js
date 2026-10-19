import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeFantasy, effectsOfResponses, guardFantasyUpdate, hasConsent, hasMutualInterest } from './fantasy.js';

const A = 'a', B = 'b', members = [A, B];
const f = { id: 'f', created_by: A, status: 'shared', on_wishlist: false, title: 't' };

test('private fantasies are visible only to the author', () => {
  assert.equal(canSeeFantasy({ ...f, status: 'private' }, A), true);
  assert.equal(canSeeFantasy({ ...f, status: 'private' }, B), false);
  assert.equal(canSeeFantasy(f, B), true);
});

test('consent needs both partners comfortable and no objection', () => {
  assert.equal(hasConsent([{ user_id: A, comfortable: true }], members), false);
  assert.equal(hasConsent([{ user_id: A, comfortable: true }, { user_id: B, comfortable: true }], members), true);
  assert.equal(hasConsent([{ user_id: A, comfortable: true }, { user_id: B, comfortable: true, reaction: 'not_comfortable' }], members), false);
  assert.equal(hasConsent([{ user_id: A, comfortable: true }], [A]), false);
});

test('partner cannot edit content or hide it; agreed needs consent', () => {
  const ctx = { actorId: B, responses: [], memberIds: members };
  assert.throws(() => guardFantasyUpdate(f, { title: 'x' }, ctx), /author/);
  assert.throws(() => guardFantasyUpdate(f, { status: 'private' }, ctx), /author/);
  assert.throws(() => guardFantasyUpdate(f, { status: 'agreed' }, ctx), /comfortable/);
  assert.throws(() => guardFantasyUpdate(f, { on_wishlist: true }, ctx), /interested/);
  assert.throws(() => guardFantasyUpdate({ ...f, status: 'private' }, { status: 'agreed' }, { ...ctx, actorId: A }), /Share it first/);
  const ok = guardFantasyUpdate(f, { status: 'agreed' }, { ...ctx, responses: [{ user_id: A, comfortable: true }, { user_id: B, comfortable: true }] });
  assert.equal(ok.status, 'agreed');
  assert.ok(guardFantasyUpdate({ ...f, status: 'private' }, { status: 'shared' }, { ...ctx, actorId: A }).shared_at);
});

test('withdrawing consent removes agreed and wishlist', () => {
  const agreed = { ...f, status: 'agreed', on_wishlist: true };
  const r = [{ user_id: A, comfortable: true }, { user_id: B, comfortable: false, reaction: 'not_comfortable' }];
  assert.deepEqual(effectsOfResponses(agreed, r, members), { status: 'discussing', on_wishlist: false });
  assert.equal(hasMutualInterest(f, [{ user_id: B, reaction: 'love' }]), true);
  assert.equal(hasMutualInterest(f, [{ user_id: A, reaction: 'love' }]), false);
  assert.deepEqual(effectsOfResponses(f, [{ user_id: B, reaction: 'discuss' }], members, 'discuss'), { status: 'discussing' });
});
