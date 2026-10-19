// Privacy rules, mirrored from the SQL RLS policies so Demo Mode behaves the same.
// In Supabase mode the server already filters; running these again is harmless.
import { todayISO } from './utils.js';

/** Is a surprise item still hidden from `viewerId`? */
export function isSurpriseHidden(item, viewerId) {
  if (!item.is_surprise) return false;
  if (item.created_by === viewerId) return false;
  if (item.revealed_at) return false;
  if (item.reveal_date && item.reveal_date <= todayISO()) return false;
  return true;
}

/** Is a hidden gift still hidden from `viewerId`? */
export function isGiftHidden(gift, viewerId) {
  if (!gift.is_hidden) return false;
  if (gift.created_by === viewerId) return false;
  if (gift.reveal_date && gift.reveal_date <= todayISO()) return false;
  return true;
}

/** For the creator: is their surprise still a secret? (for "Surprise" badge copy) */
export const surpriseIsActive = (item) =>
  item.is_surprise && !item.revealed_at && !(item.reveal_date && item.reveal_date <= todayISO());

/** Apply all privacy filters to a full workspace snapshot for one viewer. */
export function filterForViewer(data, viewerId) {
  const items = data.items.filter((i) => !isSurpriseHidden(i, viewerId));
  const visible = new Set(items.map((i) => i.id));
  const byItem = (r) => !r.item_id || visible.has(r.item_id);
  return {
    ...data,
    items,
    item_votes: data.item_votes.filter(byItem),
    item_reactions: data.item_reactions.filter(byItem),
    comments: data.comments.filter(byItem),
    subtasks: data.subtasks.filter(byItem),
    item_links: data.item_links.filter(byItem),
    item_photos: data.item_photos.filter(byItem),
    journal_entries: data.journal_entries.filter(byItem),
    wishlist_entries: data.wishlist_entries.filter((g) => byItem(g) && !isGiftHidden(g, viewerId)),
  };
}
