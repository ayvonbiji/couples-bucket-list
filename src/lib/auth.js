// Username helpers shared by the app and the account-setup script.
//
// Supabase Auth identifies people by email, so each username maps to a fixed
// internal address (never shown, never emailed): ayvon → ayvon@users.ourbucketlist.app
export const USERNAME_DOMAIN = 'users.ourbucketlist.app';

export const normalizeUsername = (u) => String(u || '').trim().toLowerCase();

export function validateUsername(u) {
  const v = normalizeUsername(u);
  if (!v) return 'Enter your username';
  if (!/^[a-z0-9._-]{3,32}$/.test(v)) return 'Usernames are 3–32 letters, numbers, dots, dashes or underscores';
  return null;
}

export const usernameToEmail = (u) => `${normalizeUsername(u)}@${USERNAME_DOMAIN}`;
