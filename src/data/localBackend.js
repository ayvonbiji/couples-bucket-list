// Demo Mode backend: same interface as Supabase, stored in this browser.
// Tables live in localStorage; photo/backup files live in IndexedDB.
// Two demo partners share one workspace so you can try every feature (switch
// between them in Settings to see surprises & hidden gifts from the other side).
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { COMPOSITE_KEYS, DATA_TABLES, DEFAULTS, ITEM_CHILDREN } from './tables.js';
import { uid } from '../lib/utils.js';

const KEY = 'cbl:db:v1';
const USER_KEY = 'cbl:demoUser';

export const DEMO_USERS = [
  { id: '00000000-0000-4000-8000-00000000000a', email: 'me@demo.local', display_name: 'Me', avatar_color: '#e2555a' },
  { id: '00000000-0000-4000-8000-00000000000b', email: 'partner@demo.local', display_name: 'My Love', avatar_color: '#8b5cf6' },
];

function emptyDb() {
  const db = { users: [...DEMO_USERS], workspaces: [], workspace_members: [] };
  for (const t of DATA_TABLES) db[t] = [];
  return db;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    const db = JSON.parse(raw);
    for (const t of DATA_TABLES) db[t] ||= [];
    return db;
  } catch {
    return emptyDb();
  }
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
    if (e.key === USER_KEY) authListeners.forEach((fn) => fn(currentUser()));
  });

  const currentUser = () => {
    const id = localStorage.getItem(USER_KEY);
    return db.users.find((u) => u.id === id) || null;
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
    async signInDemo(userId) {
      localStorage.setItem(USER_KEY, userId);
      // Demo: make sure both partners share one workspace.
      if (!db.workspaces.length) {
        const ws = {
          id: uid(), name: 'Our Bucket List', invite_code: 'DEMO2026', currency: 'INR',
          share_enabled: false, share_token: uid().replace(/-/g, ''), last_backup_at: null,
          created_by: DEMO_USERS[0].id, created_at: now(), _needsSeed: true,
        };
        db.workspaces.push(ws);
        DEMO_USERS.forEach((u) => db.workspace_members.push({ workspace_id: ws.id, user_id: u.id, joined_at: now() }));
        save();
      }
      authListeners.forEach((fn) => fn(currentUser()));
    },
    async signInWithEmail() { throw new Error('Email sign-in needs Supabase. Use the demo buttons, or see the README.'); },
    async signOut() { localStorage.removeItem(USER_KEY); authListeners.forEach((fn) => fn(null)); },

    // ---------------- workspace ----------------
    async getMembership(userId) {
      const m = db.workspace_members.find((r) => r.user_id === userId);
      if (!m) return null;
      const workspace = db.workspaces.find((w) => w.id === m.workspace_id);
      const ids = db.workspace_members.filter((r) => r.workspace_id === workspace.id).map((r) => r.user_id);
      return { workspace: clone(workspace), members: clone(db.users.filter((u) => ids.includes(u.id))) };
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
      const full = { ...DEFAULTS[table], ...row, created_at: row.created_at || now() };
      if (!COMPOSITE_KEYS[table]) full.id ||= uid();
      if (table === 'items') full.updated_at = full.created_at;
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
      if (table === 'items') row.updated_at = now();
      save();
      return clone(row);
    },
    async remove(table, match) {
      const gone = db[table].filter((r) => matches(r, match));
      if (table === 'items') gone.forEach((i) => cascadeItem(i.id));
      if (table === 'journal_entries') gone.forEach((j) => (db.item_photos = db.item_photos.filter((p) => p.journal_entry_id !== j.id)));
      db[table] = db[table].filter((r) => !matches(r, match));
      save();
    },
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
