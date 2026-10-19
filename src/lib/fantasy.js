// Secret Fantasy rules — the client-side mirror of the triggers in 0002_secret_fantasy.sql.
// In Supabase mode the database enforces these; here they give friendly messages early
// and make Demo Mode behave the same way.

export const FANTASY_CATEGORIES = ['Romance', 'Intimacy', 'Sensual', 'Adventure', 'Getaway', 'Roleplay', 'Other'];

export const FANTASY_STATUSES = [
  { value: 'private', label: 'Private' },
  { value: 'shared', label: 'Shared' },
  { value: 'discussing', label: 'Discussing' },
  { value: 'agreed', label: 'Agreed' },
  { value: 'completed', label: 'Completed' },
];

export const REACTIONS = [
  { value: 'love', label: 'Love this' },
  { value: 'curious', label: 'Curious' },
  { value: 'discuss', label: "Let's discuss" },
  { value: 'not_comfortable', label: 'Not comfortable' },
];

export const statusLabel = (s) => FANTASY_STATUSES.find((x) => x.value === s)?.label ?? s;
export const reactionLabel = (r) => REACTIONS.find((x) => x.value === r)?.label ?? '';

/** Can `viewerId` see this fantasy at all? */
export const canSeeFantasy = (f, viewerId) => f.created_by === viewerId || f.status !== 'private';

/** Both partners present, both explicitly comfortable, nobody "not comfortable". */
export function hasConsent(responses, memberIds) {
  if (memberIds.length !== 2) return false;
  if (responses.some((r) => r.reaction === 'not_comfortable')) return false;
  return memberIds.every((id) => responses.some((r) => r.user_id === id && r.comfortable));
}

/** The partner (not the author) showed interest, and nobody objected. */
export function hasMutualInterest(fantasy, responses) {
  if (responses.some((r) => r.reaction === 'not_comfortable')) return false;
  return responses.some((r) => r.user_id !== fantasy.created_by && ['love', 'curious'].includes(r.reaction));
}

/**
 * Validate a change to a fantasy by `actorId`. Returns the (possibly adjusted) patch or throws.
 * Mirrors fantasy_guard() in SQL.
 */
export function guardFantasyUpdate(old, patch, { actorId, responses, memberIds }) {
  const next = { ...old, ...patch };
  const out = { ...patch };
  if (actorId !== old.created_by) {
    for (const k of ['title', 'description', 'category', 'interest_level', 'image_path', 'created_by', 'workspace_id'])
      if (k in patch && patch[k] !== old[k]) throw new Error('Only the author can edit this fantasy');
    if (next.status === 'private') throw new Error('Only the author can make it private again');
  }
  if (old.status === 'private' && !['private', 'shared'].includes(next.status)) throw new Error('Share it first');
  if (old.status === 'private' && next.status === 'shared') out.shared_at = new Date().toISOString();
  if (next.status === 'private') { out.on_wishlist = false; out.shared_at = null; }
  if (['agreed', 'completed'].includes(next.status) && next.status !== old.status && !hasConsent(responses, memberIds))
    throw new Error('Both of you need to say you are comfortable first');
  if (next.on_wishlist && !old.on_wishlist && !hasMutualInterest(old, responses))
    throw new Error('Both of you need to be interested to add it to the wishlist');
  return out;
}

/**
 * After a response changes: what has to be withdrawn? Mirrors fantasy_after_response().
 * Returns a patch for the fantasy (possibly empty).
 */
export function effectsOfResponses(fantasy, responses, memberIds, changedReaction) {
  const patch = {};
  if (fantasy.status === 'agreed' && !hasConsent(responses, memberIds)) patch.status = 'discussing';
  if (fantasy.on_wishlist && !hasMutualInterest(fantasy, responses)) patch.on_wishlist = false;
  if (changedReaction === 'discuss' && fantasy.status === 'shared') patch.status = 'discussing';
  return patch;
}
