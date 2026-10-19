// Personal links: there is no login screen. Each partner opens their own private link once
// (https://…/#key=<username>.<secret>); the app signs that device in and remembers it.
// The key sits in the URL fragment, which browsers never send to any server.

const STORE = 'cbl:device-key';

/** Read a key from the address bar (and remove it from the URL and history). */
export function takeKeyFromUrl() {
  const m = window.location.hash.match(/[#&]key=([a-z0-9._-]+)/i);
  if (!m) return null;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return parseKey(m[1]);
}

/** "<username>.<secret>" → { username, secret }. Usernames may contain dots, so split on the last one. */
export function parseKey(raw) {
  const k = String(raw || '').trim();
  const dot = k.lastIndexOf('.');
  if (dot <= 0) return { username: k.toLowerCase(), secret: '' };
  return { username: k.slice(0, dot).toLowerCase(), secret: k.slice(dot + 1) };
}

export function savedKey() {
  try { const k = localStorage.getItem(STORE); return k ? JSON.parse(k) : null; } catch { return null; }
}
export function saveKey(key) {
  try { localStorage.setItem(STORE, JSON.stringify(key)); } catch { /* private mode: the session still works */ }
}
export function forgetKey() {
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}
