// Table list + column defaults. Demo Mode uses the defaults to behave like Postgres;
// they mirror the DEFAULT clauses in supabase/migrations/0001_init.sql.

export const DATA_TABLES = [
  'categories', 'items', 'item_votes', 'item_reactions', 'comments', 'subtasks', 'item_links',
  'item_photos', 'wishlist_entries', 'important_dates', 'journal_entries', 'backups',
];

export const DEFAULTS = {
  categories: { kind: 'bucket', color: '#8A8590', position: 0 },
  items: {
    added_by_both: false, description: null, category: 'General', category_id: null, subcategory: null, notes: null, priority: 'Medium', status: 'Idea',
    time_required: null, satisfaction: null, favourite_memory: null, reflection: null, legacy_category: null,
    timeframe: null, start_date: null, end_date: null, location_name: null, lat: null, lng: null,
    est_cost: null, currency: 'INR', owner_user_id: null, tags: [], cover_photo_id: null, creator_id: null, updated_by: null,
    is_surprise: false, reveal_date: null, revealed_at: null, savings_target: null, savings_saved: 0,
    reminder_at: null, reminder_done: false, completed_at: null, completion_note: null,
    would_do_again: null, actual_cost: null, is_deleted: false, deleted_at: null,
  },
  item_votes: {},
  item_reactions: {},
  comments: {},
  subtasks: { done: false, position: 0, due_date: null },
  item_links: { label: null, kind: 'inspiration' },
  item_photos: { item_id: null, journal_entry_id: null, caption: null, position: 0, width: null, height: null },
  wishlist_entries: {
    item_id: null, for_user_id: null, url: null, price: null, currency: 'INR', notes: null,
    is_hidden: false, reveal_date: null, is_gifted: false, gifted_at: null,
  },
  important_dates: { kind: 'other', repeats_yearly: true, reminder_offset_days: 7, photo_path: null, notes: null },
  journal_entries: { item_id: null, note: null, rating: null, category: null, location_name: null, lat: null, lng: null, tags: [], favourite_moment: null },
  backups: { kind: 'manual', format: 'json', storage_path: null, size_bytes: null, item_count: null },
};

// Secret Fantasy tables are deliberately NOT in DATA_TABLES: they are never part of the
// normal workspace load, exports, backups, search or the activity feed.
export const FANTASY_TABLES = ['fantasies', 'fantasy_responses', 'fantasy_notes', 'fantasy_comments', 'fantasy_photos'];

export const FANTASY_DEFAULTS = {
  fantasies: { description: null, category: 'Other', category_id: null, interest_level: null, visibility: 'private', status: 'idea', on_wishlist: false, planned_date: null, completed_at: null, image_path: null, shared_at: null, experience_note: null, experience_rating: null },
  fantasy_responses: { reaction: null, comfortable: false, boundaries: null, hidden: false, allow_photos: false },
  fantasy_photos: { caption: null },
  fantasy_notes: { notes: null },
  fantasy_comments: {},
};

// Tables whose primary key is not `id`.
export const COMPOSITE_KEYS = {
  item_votes: ['item_id', 'user_id'],
  fantasy_responses: ['fantasy_id', 'user_id'],
  fantasy_notes: ['fantasy_id', 'user_id'],
};

// Default categories (mirrors seed_default_categories() in 0003_upgrade.sql).
export const DEFAULT_CATEGORIES = [
  ['bucket', 'General', '#8A8590'], ['bucket', 'Travel & Adventures', '#6E8FAF'], ['bucket', 'Romantic Dates', '#C65D70'],
  ['bucket', 'Dream Home', '#8E7DA6'], ['bucket', 'Food & Experiences', '#C39A62'], ['bucket', 'Personal Goals', '#6F9884'],
  ['bucket', 'Special Occasions', '#B0809A'],
  ['fantasy', 'Romantic Fantasies', '#C65D70'], ['fantasy', 'Date Night Fantasies', '#B0809A'], ['fantasy', 'Travel & Adventure Fantasies', '#6E8FAF'],
  ['fantasy', 'Special Experiences', '#C39A62'], ['fantasy', 'Intimacy & Connection', '#9B6B8E'], ['fantasy', 'Roleplay & Imagination', '#8E7DA6'],
  ['fantasy', 'Personal Wishes', '#6F9884'], ['fantasy', 'Other', '#8A8590'],
];

// Legacy → new value maps (same as the SQL migration).
export const LEGACY_PRIORITY = { 'Must-do': 'High', Someday: 'Medium', Dream: 'Low' };
export const LEGACY_CATEGORY = { Travel: 'Travel & Adventures', Adventure: 'Travel & Adventures', Food: 'Food & Experiences', Experiences: 'Food & Experiences', Relationship: 'Romantic Dates', Home: 'Dream Home', Other: 'General' };
export const LEGACY_FANTASY_CATEGORY = { Romance: 'Romantic Fantasies', Intimacy: 'Intimacy & Connection', Sensual: 'Intimacy & Connection', Adventure: 'Travel & Adventure Fantasies', Getaway: 'Travel & Adventure Fantasies', Roleplay: 'Roleplay & Imagination' };

// Child tables that cascade when an item is permanently deleted.
export const ITEM_CHILDREN = ['item_votes', 'item_reactions', 'comments', 'subtasks', 'item_links', 'item_photos', 'wishlist_entries', 'journal_entries'];
