// Secret Fantasy rules — the client-side mirror of the triggers in 0003_upgrade.sql.
// The database enforces these in Supabase mode; here they give friendly messages early
// and make Demo Mode behave the same way.
//
// Visibility (who can see it) is separate from status (where it stands):
//   visibility: private | shared
//   status:     idea | saved | discuss | agreed | planned | in_progress | completed | archived

export const FANTASY_STATUSES = [
  { value: 'idea', label: 'Idea' },
  { value: 'saved', label: 'Saved' },
  { value: 'discuss', label: 'Want to discuss' },
  { value: 'agreed', label: 'Mutually agreed' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Not interested / Archived' },
];

export const REACTIONS = [
  { value: 'love', label: 'Interested' },
  { value: 'curious', label: 'Curious' },
  { value: 'discuss', label: "Let's discuss" },
  { value: 'not_comfortable', label: 'Not comfortable' },
];

/** Statuses that mean "we're doing this together" — they need both partners' consent once shared. */
export const CONSENT_STATUSES = ['agreed', 'planned', 'in_progress', 'completed'];

export const statusLabel = (s) => FANTASY_STATUSES.find((x) => x.value === s)?.label ?? s;
export const reactionLabel = (r) => REACTIONS.find((x) => x.value === r)?.label ?? '';

/** Can `viewerId` see this fantasy at all? */
export const canSeeFantasy = (f, viewerId) => f.created_by === viewerId || f.visibility === 'shared';

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

/** Are photos allowed? Private entries: the author. Shared: only if both partners agreed to keep photos. */
export function photosAllowed(fantasy, responses, memberIds, viewerId) {
  if (fantasy.visibility === 'private') return fantasy.created_by === viewerId;
  return memberIds.length === 2 && memberIds.every((id) => responses.some((r) => r.user_id === id && r.allow_photos));
}

/** Why a status can't be chosen right now (or null if it can). */
export function statusBlockedReason(fantasy, status, responses, memberIds) {
  if (status === fantasy.status) return null;
  if (fantasy.visibility === 'private' && status === 'agreed') return 'Share it first to agree together';
  if (fantasy.visibility === 'shared' && CONSENT_STATUSES.includes(status) && !hasConsent(responses, memberIds))
    return 'Both of you need to say you’re comfortable first';
  return null;
}

/**
 * Validate a change to a fantasy by `actorId`. Returns the (possibly adjusted) patch or throws.
 * Mirrors fantasy_guard() in SQL.
 */
export function guardFantasyUpdate(old, patch, { actorId, responses, memberIds }) {
  const next = { ...old, ...patch };
  const out = { ...patch };
  if (actorId !== old.created_by) {
    for (const k of ['title', 'description', 'category', 'category_id', 'interest_level', 'image_path', 'created_by', 'workspace_id'])
      if (k in patch && patch[k] !== old[k]) throw new Error('Only the author can edit this fantasy');
    if ('visibility' in patch && patch.visibility !== old.visibility) throw new Error('Only the author can change who sees this');
  }
  if (old.visibility === 'private' && next.visibility === 'shared') out.shared_at = new Date().toISOString();
  if (next.visibility === 'private') {
    out.on_wishlist = false;
    out.shared_at = null;
    if (old.visibility === 'shared' && ['discuss', 'agreed'].includes(next.status)) out.status = 'saved';
  }
  const status = out.status ?? next.status;
  if (status !== old.status) {
    const reason = statusBlockedReason({ ...old, visibility: next.visibility }, status, responses, memberIds);
    if (reason) throw new Error(reason);
    if (status === 'completed') out.completed_at = next.completed_at || new Date().toISOString().slice(0, 10);
    else if (old.status === 'completed') out.completed_at = null;
  }
  if (next.on_wishlist && !old.on_wishlist && (next.visibility !== 'shared' || !hasMutualInterest(old, responses)))
    throw new Error('Both of you need to be interested to add it to the wishlist');
  return out;
}

/**
 * After a response changes: what has to be withdrawn? Mirrors fantasy_after_response().
 * Returns a patch for the fantasy (possibly empty).
 */
export function effectsOfResponses(fantasy, responses, memberIds, changedReaction) {
  const patch = {};
  if (fantasy.visibility === 'shared' && ['agreed', 'planned', 'in_progress'].includes(fantasy.status) && !hasConsent(responses, memberIds)) patch.status = 'discuss';
  if (fantasy.on_wishlist && !hasMutualInterest(fantasy, responses)) patch.on_wishlist = false;
  if (changedReaction === 'discuss' && fantasy.visibility === 'shared' && ['idea', 'saved'].includes(fantasy.status)) patch.status = 'discuss';
  return patch;
}
