// Table list + column defaults. Demo Mode uses the defaults to behave like Postgres;
// they mirror the DEFAULT clauses in supabase/migrations/0001_init.sql.

export const DATA_TABLES = [
  'items', 'item_votes', 'item_reactions', 'comments', 'subtasks', 'item_links',
  'item_photos', 'wishlist_entries', 'important_dates', 'journal_entries', 'backups',
];

export const DEFAULTS = {
  items: {
    added_by_both: false, description: null, category: 'Experiences', priority: 'Someday', status: 'Idea',
    timeframe: null, start_date: null, end_date: null, location_name: null, lat: null, lng: null,
    est_cost: null, currency: 'INR', owner_user_id: null, tags: [], cover_photo_id: null,
    is_surprise: false, reveal_date: null, revealed_at: null, savings_target: null, savings_saved: 0,
    reminder_at: null, reminder_done: false, completed_at: null, completion_note: null,
    would_do_again: null, actual_cost: null, is_deleted: false, deleted_at: null,
  },
  item_votes: {},
  item_reactions: {},
  comments: {},
  subtasks: { done: false, position: 0 },
  item_links: { label: null, kind: 'inspiration' },
  item_photos: { item_id: null, journal_entry_id: null, caption: null, position: 0, width: null, height: null },
  wishlist_entries: {
    item_id: null, for_user_id: null, url: null, price: null, currency: 'INR', notes: null,
    is_hidden: false, reveal_date: null, is_gifted: false, gifted_at: null,
  },
  important_dates: { kind: 'other', repeats_yearly: true, reminder_offset_days: 7, photo_path: null, notes: null },
  journal_entries: { item_id: null, note: null, rating: null, category: null, location_name: null, lat: null, lng: null, tags: [] },
  backups: { kind: 'manual', format: 'json', storage_path: null, size_bytes: null, item_count: null },
};

// Tables whose primary key is not `id`.
export const COMPOSITE_KEYS = { item_votes: ['item_id', 'user_id'] };

// Child tables that cascade when an item is permanently deleted.
export const ITEM_CHILDREN = ['item_votes', 'item_reactions', 'comments', 'subtasks', 'item_links', 'item_photos', 'wishlist_entries', 'journal_entries'];
