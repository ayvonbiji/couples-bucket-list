// Shared enums and their display metadata. Values match the CHECK constraints in the SQL migration.
// Colours are deliberately muted so categories read as quiet dots, not loud cards.

export const CATEGORIES = ['Travel', 'Food', 'Adventure', 'Relationship', 'Home', 'Experiences', 'Other'];
export const PRIORITIES = ['Must-do', 'Someday', 'Dream'];
export const STATUSES = ['Idea', 'Planned', 'In Progress', 'Completed'];
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

export const CATEGORY_META = {
  Travel:       { color: '#6E8FAF' },
  Food:         { color: '#C39A62' },
  Adventure:    { color: '#6F9884' },
  Relationship: { color: '#C65D70' },
  Home:         { color: '#8E7DA6' },
  Experiences:  { color: '#B0809A' },
  Other:        { color: '#8A8590' },
};

export const STATUS_META = {
  'Idea':        { color: '#A8A2AA', cls: 'text-ink-500' },
  'Planned':     { color: '#6E8FAF', cls: 'text-[#4F7192] dark:text-[#9DB8D2]' },
  'In Progress': { color: '#C39A62', cls: 'text-[#8C6A35] dark:text-[#D9BB8C]' },
  'Completed':   { color: '#6F9884', cls: 'text-[#4E7563] dark:text-[#9CC2AF]' },
};

export const PRIORITY_META = {
  'Must-do': { label: 'Must-do' },
  'Someday': { label: 'Someday' },
  'Dream':   { label: 'Dream' },
};

export const DATE_KINDS = {
  birthday:       { label: 'Birthday' },
  anniversary:    { label: 'Anniversary' },
  together_since: { label: 'Together since' },
  first_date:     { label: 'First date' },
  other:          { label: 'Special day' },
};

// Important dates on the calendar (distinct from every category).
export const IMPORTANT_DATE_COLOR = '#9B6B8E';

export const MUTUAL_THRESHOLD = 4; // both partners ≥ 4 stars → "We both want this"
export const TRASH_DAYS = 30;
