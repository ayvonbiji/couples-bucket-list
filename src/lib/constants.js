// Shared enums and their display metadata. Values match the CHECK constraints in the SQL migration.

export const CATEGORIES = ['Travel', 'Food', 'Adventure', 'Relationship', 'Home', 'Experiences', 'Other'];
export const PRIORITIES = ['Must-do', 'Someday', 'Dream'];
export const STATUSES = ['Idea', 'Planned', 'In Progress', 'Completed'];
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

export const CATEGORY_META = {
  Travel:       { emoji: '✈️', color: '#3b82f6' },
  Food:         { emoji: '🍜', color: '#f59e0b' },
  Adventure:    { emoji: '🏔️', color: '#10b981' },
  Relationship: { emoji: '💞', color: '#e2555a' },
  Home:         { emoji: '🏡', color: '#8b5cf6' },
  Experiences:  { emoji: '🎟️', color: '#ec4899' },
  Other:        { emoji: '✨', color: '#64748b' },
};

export const STATUS_META = {
  'Idea':        { color: '#94a3b8', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  'Planned':     { color: '#3b82f6', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  'In Progress': { color: '#f59e0b', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  'Completed':   { color: '#10b981', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
};

export const PRIORITY_META = {
  'Must-do': { emoji: '🔥', cls: 'text-rose-700 dark:text-rose-300' },
  'Someday': { emoji: '🌤️', cls: 'text-amber-700 dark:text-amber-300' },
  'Dream':   { emoji: '🌙', cls: 'text-violet-700 dark:text-violet-300' },
};

export const DATE_KINDS = {
  birthday:       { label: 'Birthday',       emoji: '🎂' },
  anniversary:    { label: 'Anniversary',    emoji: '💍' },
  together_since: { label: 'Together since', emoji: '💑' },
  first_date:     { label: 'First date',     emoji: '🌹' },
  other:          { label: 'Special day',    emoji: '⭐' },
};

// Colour used for important dates on the calendar (distinct from every category).
export const IMPORTANT_DATE_COLOR = '#c026d3';

export const MUTUAL_THRESHOLD = 4; // both partners ≥ 4 stars → "We both want this"
export const TRASH_DAYS = 30;
