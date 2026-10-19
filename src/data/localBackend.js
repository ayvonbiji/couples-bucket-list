// Demo Mode backend: same interface as Supabase, stored in this browser.
// Tables live in localStorage; photo/backup files live in IndexedDB.
// On first run a setup screen creates the two accounts (username + password,
// stored only as PBKDF2 hashes). Both share one workspace.
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { COMPOSITE_KEYS, DATA_TABLES, DEFAULTS, DEFAULT_CATEGORIES, FANTASY_DEFAULTS, FANTASY_TABLES, ITEM_CHILDREN, LEGACY_CATEGORY, LEGACY_FANTASY_CATEGORY, LEGACY_PRIORITY } from './tables.js';
import { hashPassword, normalizeUsername } from '../lib/auth.js';

const ALL_TABLES = [...DATA_TABLES, ...FANTASY_TABLES];
import { uid } from '../lib/utils.js';

const KEY = 'cbl:db:v1';
const SESSION_KEY = 'cbl:session';
const SESSION_DAYS = 30;

// Ids of the original demo partners (kept so earlier demo data stays attached).
const LEGACY_IDS = [
  '00000000-0000-4000-8000-00000000000a',
  '00000000-0000-4000-8000-00000000000b',
];
const COLORS = ['#C65D70', '#7D6B91'];

function emptyDb() {
  const db = { users: [], accounts: [], workspaces: [], workspace_members: [] };
  for (const t of ALL_TABLES) db[t] = [];
  return db;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    const db = JSON.parse(raw);
    for (const t of ALL_TABLES) db[t] ||= [];
    db.accounts ||= [];
    return migrate(db);
  } catch {
    return emptyDb();
  }
}

/** Bring older demo data up to the 0003 model (mirrors the SQL migration). */
function migrate(db) {
  for (const ws of db.workspaces) seedCategories(db, ws.id);
  const cat = (ws, kind, name) => db.categories.find((c) => c.workspace_id === ws && c.kind === kind && c.name === name);
  for (const i of db.items) {
    if (LEGACY_PRIORITY[i.priority]) i.priority = LEGACY_PRIORITY[i.priority];
    if (!i.category_id) {
      const c = cat(i.workspace_id, 'bucket', LEGACY_CATEGORY[i.category] || i.category) || cat(i.workspace_id, 'bucket', 'General');
      if (c) { i.legacy_category ??= i.category; i.category_id = c.id; i.category = c.name; }
    }
  }
  for (const f of db.fantasies) {
    if (!f.visibility) {
      f.visibility = f.status === 'private' ? 'private' : 'shared';
      f.status = { private: 'idea', shared: 'saved', discussing: 'discuss' }[f.status] || f.status;
    }
    if (!f.category_id) {
      const c = cat(f.workspace_id, 'fantasy', LEGACY_FANTASY_CATEGORY[f.category] || f.category) || cat(f.workspace_id, 'fantasy', 'Other');
      if (c) { f.legacy_category ??= f.category; f.category_id = c.id; f.category = c.name; }
    }
  }
  return db;
}

function seedCategories(db, wsId) {
  DEFAULT_CATEGORIES.forEach(([kind, name, color], k) => {
    if (!db.categories.some((c) => c.workspace_id === wsId && c.kind === kind && c.name === name))
      db.categories.push({ id: uid(), workspace_id: wsId, kind, name, color, position: k % 8, created_at: new Date().toISOString() });
  });
}

export function createLocalBackend() {
  let db = load();
  const authListeners = new Set();
  const changeListeners = new Set();
  const urlCache = new Map();

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      throw new Error('Browser storage is full. Export a backup and delete old items, or connect Supabase.');
    }
    changeListeners.forEach((fn) => fn());
  };
  const now = () => new Date().toISOString();
  const matches = (row, match) => Object.entries(match).every(([k, v]) => row[k] === v);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Other tabs: reload when localStorage changes.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { db = load(); changeListeners.forEach((fn) => fn()); }
    if (e.key === SESSION_KEY) authListeners.forEach((fn) => fn(currentUser()));
  });

  /** Current session (expires after SESSION_DAYS). */
  const currentUser = () => {
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!sess || sess.exp < Date.now()) return null;
      return db.users.find((u) => u.id === sess.userId) || null;
    } catch { return null; }
  };

  /** Mimic Postgres ON DELETE CASCADE for items. */
  function cascadeItem(itemId) {
    for (const t of ITEM_CHILDREN) {
      const gone = db[t].filter((r) => r.item_id === itemId);
      if (t === 'item_photos') gone.forEach((p) => idbDel(`photos/${p.storage_path}`));
      if (t === 'journal_entries') gone.forEach((j) => (db.item_photos = db.item_photos.filter((p) => p.journal_entry_id !== j.id)));
      db[t] = db[t].filter((r) => r.item_id !== itemId);
    }
  }

  const api = {
    mode: 'local',

    // ---------------- auth ----------------
    async getUser() { return currentUser(); },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
    /** Demo only: are the two accounts configured yet? */
    needsSetup() { return db.accounts.length < 2; },

    /** Demo only: create both accounts + the shared workspace (first run). */
    async setupAccounts(accounts) {
      if (db.accounts.length >= 2) throw new Error('Accounts are already set up');
      const names = accounts.map((a) => normalizeUsername(a.username));
      if (new Set(names).size !== 2) throw new Error('Choose two different usernames');
      const existing = db.users.filter((u) => LEGACY_IDS.includes(u.id));
      const users = [];
      for (const [k, a] of accounts.entries()) {
        const id = existing[k]?.id || LEGACY_IDS[k] || uid();
        const { salt, hash } = await hashPassword(a.password);
        db.accounts.push({ user_id: id, username: names[k], salt, hash });
        const u = { id, email: null, username: names[k], display_name: a.display_name?.trim() || a.username, avatar_color: COLORS[k] };
        db.users = db.users.filter((x) => x.id !== id).concat(u);
        users.push(u);
      }
      let ws = db.workspaces[0];
      if (!ws) {
        ws = {
          id: uid(), name: 'Our Bucket List', invite_code: 'LOCAL000', currency: 'INR', share_enabled: false,
          share_token: uid().replace(/-/g, ''), last_backup_at: null, created_by: users[0].id, created_at: now(), _needsSeed: true,
        };
        db.workspaces.push(ws);
      }
      for (const u of users) if (!db.workspace_members.some((m) => m.user_id === u.id)) db.workspace_members.push({ workspace_id: ws.id, user_id: u.id, joined_at: now() });
      seedCategories(db, ws.id);
      save();
    },

    async signInWithPassword(username, password) {
      await new Promise((r) => setTimeout(r, 250)); // small, constant delay
      const acc = db.accounts.find((a) => a.username === normalizeUsername(username));
      const check = await hashPassword(password, acc?.salt || '00'.repeat(16));
      if (!acc || check.hash !== acc.hash) throw new Error('Incorrect username or password');
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: acc.user_id, exp: Date.now() + SESSION_DAYS * 86400000 }));
      authListeners.forEach((fn) => fn(currentUser()));
    },

    async changePassword(current, next) {
      const me = currentUser();
      const acc = db.accounts.find((a) => a.user_id === me?.id);
      if (!acc || (await hashPassword(current, acc.salt)).hash !== acc.hash) throw new Error('Your current password is incorrect');
      Object.assign(acc, await hashPassword(next));
      save();
    },
    async signOut() { localStorage.removeItem(SESSION_KEY); authListeners.forEach((fn) => fn(null)); },

    // ---------------- workspace ----------------
    async getMembership(userId) {
      const m = db.workspace_members.find((r) => r.user_id === userId);
      if (!m) return null;
      const workspace = db.workspaces.find((w) => w.id === m.workspace_id);
      const ids = db.workspace_members.filter((r) => r.workspace_id === workspace.id).map((r) => r.user_id);
      return { workspace: clone(workspace), members: clone(db.users.filter((u) => ids.includes(u.id))) };
    },
    /** Rename a category everywhere (mirrors rename_category()). */
    async renameCategory(id, name) {
      const c = db.categories.find((x) => x.id === id);
      if (!c) throw new Error('Category not found');
      c.name = name.trim();
      for (const r of c.kind === 'bucket' ? db.items : db.fantasies) if (r.category_id === id) r.category = c.name;
      save();
    },
    /** Remove a category, moving its entries to `fallbackId` (mirrors delete_category()). */
    async deleteCategory(id, fallbackId) {
      const c = db.categories.find((x) => x.id === id), f = db.categories.find((x) => x.id === fallbackId);
      if (!c || !f || f.id === c.id || f.kind !== c.kind) throw new Error('Choose another category to move entries into');
      for (const r of c.kind === 'bucket' ? db.items : db.fantasies) if (r.category_id === id) { r.category_id = f.id; r.category = f.name; }
      db.categories = db.categories.filter((x) => x.id !== id);
      save();
    },
    async createWorkspace() { throw new Error('Not needed in Demo Mode'); },
    async joinWorkspace() { throw new Error('Not needed in Demo Mode'); },
    async updateWorkspace(id, patch) {
      const w = db.workspaces.find((x) => x.id === id);
      Object.assign(w, patch);
      save();
      return clone(w);
    },
    async updateProfile(id, patch) {
      const u = db.users.find((x) => x.id === id);
      Object.assign(u, patch);
      save();
      return clone(u);
    },

    // ---------------- data ----------------
    async loadAll(wsId) {
      return Object.fromEntries(DATA_TABLES.map((t) => [t, clone(db[t].filter((r) => r.workspace_id === wsId))]));
    },
    async insert(table, row) {
      const full = { ...(DEFAULTS[table] || FANTASY_DEFAULTS[table]), ...row, created_at: row.created_at || now() };
      if (!COMPOSITE_KEYS[table]) full.id ||= uid();
      if (table === 'items' || FANTASY_TABLES.includes(table)) full.updated_at ||= full.created_at;
      if (table === 'journal_entries' && full.item_id && db.journal_entries.some((j) => j.item_id === full.item_id))
        throw new Error('This item already has a journal entry');
      db[table].push(full);
      save();
      return clone(full);
    },
    async insertMany(table, rows) {
      const out = [];
      for (const r of rows) out.push(await api.insert(table, r));
      return out;
    },
    async importRows(table, rows) { await api.insertMany(table, rows); },
    async upsert(table, row, onConflict) {
      const keys = onConflict.split(',');
      const existing = db[table].find((r) => keys.every((k) => r[k] === row[k]));
      if (existing) { Object.assign(existing, row); save(); return clone(existing); }
      return api.insert(table, row);
    },
    async update(table, match, patch) {
      const row = db[table].find((r) => matches(r, match));
      if (!row) throw new Error('Not found — it may have been deleted');
      Object.assign(row, patch);
      if (table === 'items' || FANTASY_TABLES.includes(table)) row.updated_at = now();
      save();
      return clone(row);
    },
    async remove(table, match) {
      const gone = db[table].filter((r) => matches(r, match));
      if (table === 'items') gone.forEach((i) => cascadeItem(i.id));
      if (table === 'fantasies') gone.forEach((f) => {
        for (const t of FANTASY_TABLES.slice(1)) db[t] = db[t].filter((r) => r.fantasy_id !== f.id);
        if (f.image_path) idbDel(`fantasy/${f.image_path}`);
        db.fantasy_photos.filter((p) => p.fantasy_id === f.id).forEach((p) => idbDel(`fantasy/${p.storage_path}`));
      });
      if (table === 'journal_entries') gone.forEach((j) => (db.item_photos = db.item_photos.filter((p) => p.journal_entry_id !== j.id)));
      db[table] = db[table].filter((r) => !matches(r, match));
      save();
    },
    /**
     * Secret Fantasy rows the viewer may see — mirrors the RLS policies in 0002_secret_fantasy.sql.
     * (Demo Mode keeps everything in this one browser, so this is a simulation of the server rules.)
     */
    async loadFantasies(wsId, viewerId) {
      const visible = db.fantasies.filter((f) => f.workspace_id === wsId && (f.created_by === viewerId || f.visibility === 'shared'));
      const ids = new Set(visible.map((f) => f.id));
      return {
        fantasies: clone(visible),
        fantasy_responses: clone(db.fantasy_responses.filter((r) => ids.has(r.fantasy_id))),
        fantasy_notes: clone(db.fantasy_notes.filter((r) => ids.has(r.fantasy_id) && r.user_id === viewerId)),
        fantasy_comments: clone(db.fantasy_comments.filter((r) => ids.has(r.fantasy_id))),
        fantasy_photos: clone(db.fantasy_photos.filter((r) => ids.has(r.fantasy_id))),
      };
    },
    subscribeFantasies(_wsId, onChange) { changeListeners.add(onChange); return () => changeListeners.delete(onChange); },
    async dashboardSummary() { return null; }, // computed client-side in demo mode
    async sharedList(token) {
      const w = db.workspaces.find((x) => x.share_token === token && x.share_enabled);
      if (!w) return null;
      return {
        name: w.name,
        items: db.items.filter((i) => i.workspace_id === w.id && !i.is_deleted && !i.is_surprise),
      };
    },
    /** Demo only: clear everything. */
    async resetAll() {
      localStorage.removeItem(KEY);
      localStorage.removeItem(SESSION_KEY);
      db = emptyDb();
      changeListeners.forEach((fn) => fn());
    },
    markSeeded(wsId) {
      const w = db.workspaces.find((x) => x.id === wsId);
      if (w) { delete w._needsSeed; save(); }
    },

    // ---------------- storage (IndexedDB) ----------------
    async uploadFile(bucket, path, blob) {
      await idbSet(`${bucket}/${path}`, blob);
      return path;
    },
    forgetUrls(bucket) {
      for (const [k, u] of [...urlCache.entries()]) if (k.startsWith(`${bucket}/`)) { URL.revokeObjectURL(u); urlCache.delete(k); }
    },
    async fileUrl(bucket, path) {
      const key = `${bucket}/${path}`;
      if (urlCache.has(key)) return urlCache.get(key);
      const blob = await idbGet(key);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(key, url);
      return url;
    },
    async downloadFile(bucket, path) {
      const blob = await idbGet(`${bucket}/${path}`);
      if (!blob) throw new Error('File not found');
      return blob;
    },
    async removeFiles(bucket, paths) {
      await Promise.all(paths.map((p) => idbDel(`${bucket}/${p}`)));
    },

    subscribe(_wsId, onChange) { changeListeners.add(onChange); return () => changeListeners.delete(onChange); },

    async fetchIcal(icalUrl) {
      // Browsers block most cross-origin calendar feeds; Supabase mode proxies them.
      const res = await fetch(icalUrl).catch(() => null);
      if (!res || !res.ok) throw new Error('Your browser blocked this calendar feed (CORS). Google Calendar sync works once Supabase + the ical-proxy function are set up.');
      return res.text();
    },
  };
  return api;
}
