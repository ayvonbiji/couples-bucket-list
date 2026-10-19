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

export function validatePassword(p, { strict = false } = {}) {
  if (!p) return 'Enter your password';
  if (strict) {
    if (p.length < 8) return 'Use at least 8 characters';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letters and at least one number';
  }
  return null;
}

export const usernameToEmail = (u) => `${normalizeUsername(u)}@${USERNAME_DOMAIN}`;

/** PBKDF2-SHA256 (Demo Mode only — Supabase hashes passwords itself with bcrypt). */
export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 }, key, 256);
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return { salt: hex(salt), hash: hex(bits) };
}
