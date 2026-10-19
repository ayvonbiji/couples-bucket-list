// Central app state: session, workspace, all shared data, and every mutation.
// Components read from `useApp()` and call actions; actions talk to the backend
// and patch local state immediately, then realtime reloads reconcile with the server.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBackend } from '../data/backend.js';
import { DATA_TABLES, DEFAULTS } from '../data/tables.js';
import { filterForViewer } from '../lib/visibility.js';
import { seedDates, seedItems } from '../lib/seed.js';
import { compressImage } from '../lib/image.js';
import { TRASH_DAYS } from '../lib/constants.js';
import { errMsg, todayISO, uid } from '../lib/utils.js';
import { dueReminders, fireDueNotifications } from '../lib/notifications.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const emptyData = () => Object.fromEntries(DATA_TABLES.map((t) => [t, []]));
const keyOf = (table, row) => (table === 'item_votes' ? `${row.item_id}:${row.user_id}` : row.id);

export function AppProvider({ children }) {
  const [backend, setBackend] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [membership, setMembership] = useState(undefined); // { workspace, members } | null
  const [raw, setRaw] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // true once the workspace snapshot has loaded
  const [toasts, setToasts] = useState([]);
  const reloadTimer = useRef();

  // ---------------- toasts ----------------
  const toast = useCallback((message, type = 'info', action = null) => {
    const id = uid();
    setToasts((t) => [...t, { id, message, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3200);
  }, []);
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  /** Run an async action, surfacing errors as a toast. Returns the result or undefined. */
  const run = useCallback(async (fn, success) => {
    try {
      const r = await fn();
      if (success) toast(success, 'success');
      return r;
    } catch (e) {
      console.error(e);
      toast(errMsg(e), 'error');
      return undefined;
    }
  }, [toast]);

  // ---------------- boot ----------------
  useEffect(() => {
    let unsub;
    getBackend().then(async (b) => {
      setBackend(b);
      setUser(await b.getUser());
      unsub = b.onAuthChange((u) => setUser(u));
    });
    return () => unsub?.();
  }, []);

  // Load membership whenever the user changes.
  useEffect(() => {
    if (!backend || user === undefined) return;
    if (!user) { setMembership(null); setLoading(false); return; }
    setLoading(true);
    backend.getMembership(user.id)
      .then(setMembership)
      .catch((e) => { toast(errMsg(e), 'error'); setMembership(null); })
      .finally(() => setLoading(false));
  }, [backend, user, toast]);

  const ws = membership?.workspace;
  const me = useMemo(() => membership?.members.find((m) => m.id === user?.id) || (user ? { id: user.id, email: user.email, display_name: 'Me' } : null), [membership, user]);
  const partner = useMemo(() => membership?.members.find((m) => m.id !== user?.id) || null, [membership, user]);

  const reload = useCallback(async () => {
    if (!backend || !ws) return;
    try {
      setRaw(await backend.loadAll(ws.id));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }, [backend, ws, toast]);

  // Initial data load + seeding + realtime.
  useEffect(() => {
    if (!backend || !ws) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let data = await backend.loadAll(ws.id);
      const needsSeed = ws._needsSeed || (backend.mode === 'supabase' && !localStorage.getItem(`cbl:seeded:${ws.id}`) && data.items.length === 0 && ws.created_by === user.id);
      if (needsSeed) {
        await seedWorkspace(backend, ws, user.id, membership.members.find((m) => m.id !== user.id)?.id);
        backend.markSeeded?.(ws.id);
        localStorage.setItem(`cbl:seeded:${ws.id}`, '1');
        data = await backend.loadAll(ws.id);
      }
      if (!cancelled) { setRaw(data); setDataLoaded(true); setLoading(false); }
    })().catch((e) => { toast(errMsg(e), 'error'); setLoading(false); });

    const unsub = backend.subscribe(ws.id, () => {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(reload, 350);
    });
    return () => { cancelled = true; unsub?.(); };
  }, [backend, ws?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Privacy filtering for the current viewer (surprises, hidden gifts).
  const data = useMemo(() => (me ? filterForViewer(raw, me.id) : raw), [raw, me]);
  const items = useMemo(() => data.items.filter((i) => !i.is_deleted), [data.items]);
  const trash = useMemo(() => data.items.filter((i) => i.is_deleted), [data.items]);

  // ---------------- local state patch helpers ----------------
  const putRow = (table, row) =>
    row && setRaw((d) => {
      const k = keyOf(table, row);
      const exists = d[table].some((r) => keyOf(table, r) === k);
      return { ...d, [table]: exists ? d[table].map((r) => (keyOf(table, r) === k ? { ...r, ...row } : r)) : [...d[table], row] };
    });
  const dropRows = (table, pred) => setRaw((d) => ({ ...d, [table]: d[table].filter((r) => !pred(r)) }));

  // =========================================================================
  // ACTIONS
  // =========================================================================
  const actions = useMemo(() => {
    if (!backend || !ws || !me) return {};
    const base = { workspace_id: ws.id };

    const insert = async (table, row) => { const r = await backend.insert(table, { ...base, ...row }); putRow(table, r); return r; };
    const update = async (table, id, patch) => { const r = await backend.update(table, { id }, patch); putRow(table, r ?? { id, ...patch }); return r; };
    const remove = async (table, id) => { await backend.remove(table, { id }); dropRows(table, (r) => r.id === id); };

    // ---------- photos ----------
    /** Compress + upload files, creating item_photos rows. `target` = { item_id } or { journal_entry_id }. */
    async function uploadPhotos(target, files, onProgress) {
      const existing = raw.item_photos.filter((p) => (target.item_id ? p.item_id === target.item_id : p.journal_entry_id === target.journal_entry_id));
      let pos = existing.reduce((m, p) => Math.max(m, p.position), -1) + 1;
      const rows = [];
      let done = 0;
      for (const file of files) {
        const { blob, width, height } = await compressImage(file);
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${ws.id}/${uid()}.${ext}`;
        await backend.uploadFile('photos', path, blob);
        rows.push(await insert('item_photos', { ...target, storage_path: path, width, height, position: pos++, uploaded_by: me.id }));
        onProgress?.(++done, files.length);
      }
      return rows;
    }

    async function deletePhotoRows(photos) {
      await backend.removeFiles('photos', photos.map((p) => p.storage_path));
      for (const p of photos) await remove('item_photos', p.id);
    }

    /** Permanently delete items + all children + their photo files. */
    async function hardDeleteItems(ids) {
      for (const id of ids) {
        const journalIds = raw.journal_entries.filter((j) => j.item_id === id).map((j) => j.id);
        const photos = raw.item_photos.filter((p) => p.item_id === id || journalIds.includes(p.journal_entry_id));
        await backend.removeFiles('photos', photos.map((p) => p.storage_path)).catch(() => {});
        await backend.remove('items', { id });
      }
      const set = new Set(ids);
      setRaw((d) => {
        const jIds = new Set(d.journal_entries.filter((j) => set.has(j.item_id)).map((j) => j.id));
        const next = { ...d, items: d.items.filter((i) => !set.has(i.id)) };
        for (const t of ['item_votes', 'item_reactions', 'comments', 'subtasks', 'item_links', 'wishlist_entries', 'journal_entries'])
          next[t] = d[t].filter((r) => !set.has(r.item_id));
        next.item_photos = d.item_photos.filter((p) => !set.has(p.item_id) && !jIds.has(p.journal_entry_id));
        return next;
      });
    }

    /** Create or update the journal entry that mirrors a completed item. */
    async function syncJournalForItem(item) {
      const existing = raw.journal_entries.find((j) => j.item_id === item.id);
      const row = {
        title: item.title, entry_date: item.completed_at || todayISO(), note: item.completion_note,
        rating: item.would_do_again, category: item.category, location_name: item.location_name,
        lat: item.lat, lng: item.lng, tags: item.tags || [],
      };
      return existing ? update('journal_entries', existing.id, row) : insert('journal_entries', { ...row, item_id: item.id, created_by: me.id });
    }

    return {
      reload,

      // ---------- items ----------
      createItem: (values, { subtasks = [], files = [] } = {}) => run(async () => {
        const item = await insert('items', { ...values, created_by: me.id });
        for (const [k, title] of subtasks.entries()) await insert('subtasks', { item_id: item.id, title, position: k });
        if (files.length) {
          const photos = await uploadPhotos({ item_id: item.id }, files);
          if (photos[0]) await update('items', item.id, { cover_photo_id: photos[0].id });
        }
        return item;
      }, 'Added to your list'),

      updateItem: (id, patch, msg) => run(async () => {
        const r = await update('items', id, patch);
        if (r?.status === 'Completed') await syncJournalForItem(r);
        return r;
      }, msg),

      /** Mark complete with memory details; creates the timeline journal entry. */
      completeItem: (id, { completed_at, completion_note, would_do_again, actual_cost, files = [] }) => run(async () => {
        const r = await update('items', id, { status: 'Completed', completed_at, completion_note, would_do_again, actual_cost });
        if (files.length) await uploadPhotos({ item_id: id }, files);
        await syncJournalForItem({ ...raw.items.find((i) => i.id === id), ...r });
        return r;
      }, 'Completed! Saved to your Memories'),

      reopenItem: (id) => run(async () => {
        await update('items', id, { status: 'In Progress', completed_at: null });
        const j = raw.journal_entries.find((x) => x.item_id === id);
        if (j) await remove('journal_entries', j.id);
      }, 'Moved back to In Progress'),

      revealSurprise: (id) => run(() => update('items', id, { revealed_at: new Date().toISOString() }), 'Surprise revealed!'),

      softDelete: (ids) => run(async () => {
        const at = new Date().toISOString();
        for (const id of ids) await update('items', id, { is_deleted: true, deleted_at: at });
      }),
      restoreItems: (ids) => run(async () => {
        for (const id of ids) await update('items', id, { is_deleted: false, deleted_at: null });
      }, ids.length > 1 ? `Restored ${ids.length} items` : 'Restored'),
      permanentDelete: (ids) => run(() => hardDeleteItems(ids), 'Deleted forever'),
      emptyTrash: () => run(() => hardDeleteItems(raw.items.filter((i) => i.is_deleted).map((i) => i.id)), 'Trash emptied'),

      /** Auto-purge: trash older than 30 days. Called once on load. */
      purgeOldTrash: async () => {
        const cutoff = Date.now() - TRASH_DAYS * 86400000;
        const old = raw.items.filter((i) => i.is_deleted && i.deleted_at && new Date(i.deleted_at).getTime() < cutoff);
        if (old.length) await hardDeleteItems(old.map((i) => i.id)).catch(console.error);
      },

      // ---------- votes & reactions ----------
      vote: (itemId, stars) => run(async () => {
        if (!stars) {
          await backend.remove('item_votes', { item_id: itemId, user_id: me.id });
          dropRows('item_votes', (v) => v.item_id === itemId && v.user_id === me.id);
          return;
        }
        const r = await backend.upsert('item_votes', { ...base, item_id: itemId, user_id: me.id, stars, updated_at: new Date().toISOString() }, 'item_id,user_id');
        putRow('item_votes', r);
      }),
      toggleReaction: (itemId, emoji) => run(async () => {
        const mine = raw.item_reactions.find((r) => r.item_id === itemId && r.user_id === me.id && r.emoji === emoji);
        if (mine) await remove('item_reactions', mine.id);
        else await insert('item_reactions', { item_id: itemId, user_id: me.id, emoji });
      }),

      // ---------- comments ----------
      addComment: (itemId, body) => run(() => insert('comments', { item_id: itemId, user_id: me.id, body: body.trim() })),
      deleteComment: (id) => run(() => remove('comments', id)),

      // ---------- subtasks ----------
      addSubtask: (itemId, title) => run(() => {
        const pos = raw.subtasks.filter((s) => s.item_id === itemId).length;
        return insert('subtasks', { item_id: itemId, title: title.trim(), position: pos });
      }),
      toggleSubtask: (s) => run(() => update('subtasks', s.id, { done: !s.done })),
      deleteSubtask: (id) => run(() => remove('subtasks', id)),

      // ---------- links ----------
      addLink: (itemId, url, label, kind) => run(() => insert('item_links', { item_id: itemId, url, label: label || null, kind, created_by: me.id })),
      deleteLink: (id) => run(() => remove('item_links', id)),

      // ---------- photos ----------
      uploadPhotos: (target, files, onProgress) => run(() => uploadPhotos(target, files, onProgress), files.length > 1 ? `${files.length} photos added` : 'Photo added'),
      updatePhoto: (id, patch) => run(() => update('item_photos', id, patch)),
      reorderPhotos: (ordered) => run(async () => {
        for (const [k, p] of ordered.entries()) if (p.position !== k) await update('item_photos', p.id, { position: k });
      }),
      deletePhoto: (photo) => run(async () => {
        await deletePhotoRows([photo]);
        const item = raw.items.find((i) => i.cover_photo_id === photo.id);
        if (item) await update('items', item.id, { cover_photo_id: null });
      }, 'Photo deleted'),
      setCover: (itemId, photoId) => run(() => update('items', itemId, { cover_photo_id: photoId }), 'Cover photo set'),
      /** Upload a single standalone image (e.g. important-date photo); returns storage path. */
      uploadSingle: (file) => run(async () => {
        const { blob } = await compressImage(file);
        const path = `${ws.id}/${uid()}.jpg`;
        await backend.uploadFile('photos', path, blob);
        return path;
      }),

      // ---------- wishlist ----------
      addGift: (values) => run(() => insert('wishlist_entries', { ...values, created_by: me.id }), values.is_hidden ? 'Gift idea hidden until reveal' : 'Gift idea added'),
      updateGift: (id, patch) => run(() => update('wishlist_entries', id, patch)),
      deleteGift: (id) => run(() => remove('wishlist_entries', id), 'Gift idea removed'),

      // ---------- important dates ----------
      addDate: (values) => run(() => insert('important_dates', { ...values, created_by: me.id }), 'Date saved'),
      updateDate: (id, patch) => run(() => update('important_dates', id, patch), 'Saved'),
      deleteDate: (id) => run(async () => {
        const d = raw.important_dates.find((x) => x.id === id);
        if (d?.photo_path) await backend.removeFiles('photos', [d.photo_path]).catch(() => {});
        await remove('important_dates', id);
      }, 'Date removed'),

      // ---------- journal ----------
      addJournal: (values, files = []) => run(async () => {
        const j = await insert('journal_entries', { ...values, created_by: me.id });
        if (files.length) await uploadPhotos({ journal_entry_id: j.id }, files);
        return j;
      }, 'Memory saved'),
      updateJournal: (id, patch) => run(() => update('journal_entries', id, patch), 'Saved'),
      deleteJournal: (id) => run(async () => {
        await deletePhotoRows(raw.item_photos.filter((p) => p.journal_entry_id === id));
        await remove('journal_entries', id);
      }, 'Memory deleted'),

      // ---------- workspace & profile ----------
      updateWorkspace: (patch, msg) => run(async () => {
        const w = await backend.updateWorkspace(ws.id, patch);
        setMembership((m) => ({ ...m, workspace: { ...m.workspace, ...w } }));
        return w;
      }, msg),
      updateProfile: (patch) => run(async () => {
        const u = await backend.updateProfile(me.id, patch);
        setMembership((m) => ({ ...m, members: m.members.map((x) => (x.id === me.id ? { ...x, ...u } : x)) }));
      }, 'Profile saved'),

      // ---------- backups ----------
      /** Upload a JSON snapshot to cloud storage and record it in `backups`. */
      backupNow: (kind = 'manual') => run(async () => {
        const { buildJsonBackup } = await import('../lib/export.js');
        const blob = buildJsonBackup({ workspace: ws, members: membership.members, data: raw });
        const path = `${ws.id}/backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        await backend.uploadFile('backups', path, blob);
        await insert('backups', { created_by: me.id, kind, format: 'json', storage_path: path, size_bytes: blob.size, item_count: raw.items.length });
        const w = await backend.updateWorkspace(ws.id, { last_backup_at: new Date().toISOString() });
        setMembership((m) => ({ ...m, workspace: { ...m.workspace, ...w } }));
      }, kind === 'auto' ? null : 'Backed up to the cloud'),

      downloadBackup: (b) => run(async () => {
        const blob = await backend.downloadFile('backups', b.storage_path);
        return JSON.parse(await blob.text());
      }),

      /** Restore from a JSON backup. mode 'merge' adds alongside; 'replace' wipes current data first. */
      restoreBackup: (backup, mode = 'merge') => run(async () => {
        const { restorePlan } = await import('../lib/export.js');
        if (mode === 'replace') {
          for (const i of raw.items) await backend.remove('items', { id: i.id });
          for (const t of ['important_dates', 'journal_entries', 'wishlist_entries'])
            for (const r of raw[t]) await backend.remove(t, { id: r.id }).catch(() => {});
        }
        const plan = restorePlan(backup, { workspaceId: ws.id, meId: me.id, partnerId: partner?.id ?? null });
        const now = new Date().toISOString();
        for (const [table, rows] of plan) {
          if (!rows.length) continue;
          // Fill every column so Postgres NOT NULL defaults are satisfied (jsonb_populate_recordset).
          const full = rows.map((r) => ({ ...DEFAULTS[table], created_at: now, ...(table === 'items' || table === 'item_votes' ? { updated_at: now } : {}), ...r }));
          await backend.importRows(table, full);
        }
        await reload();
      }, 'Backup restored'),

      // ---------- demo helpers ----------
      switchDemoUser: (userId) => backend.signInDemo?.(userId),
    };
  }, [backend, ws, me, partner, raw, membership, reload, run]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time housekeeping after data loads: purge old trash, weekly auto-backup, reminders.
  const housekeepingDone = useRef(false);
  useEffect(() => {
    if (!dataLoaded || loading || !ws || !actions.purgeOldTrash || housekeepingDone.current) return;
    housekeepingDone.current = true;
    actions.purgeOldTrash();
    const last = ws.last_backup_at ? new Date(ws.last_backup_at).getTime() : 0;
    if (raw.items.length && Date.now() - last > 7 * 86400000) actions.backupNow('auto');
  }, [dataLoaded, loading, ws, actions, raw.items.length]);

  const reminders = useMemo(() => dueReminders(items, data.important_dates), [items, data.important_dates]);
  useEffect(() => {
    fireDueNotifications(reminders);
    const t = setInterval(() => fireDueNotifications(dueReminders(items, data.important_dates)), 60000);
    return () => clearInterval(t);
  }, [reminders, items, data.important_dates]);

  /** "Me" / partner's name / "Both" relative to the viewer. */
  const personLabel = useCallback((userId, { both = 'Both' } = {}) => {
    if (!userId) return both;
    if (userId === me?.id) return 'Me';
    return partner?.display_name || 'Partner';
  }, [me, partner]);

  const value = {
    backend, mode: backend?.mode, user, me, partner, workspace: ws, membership,
    data, items, trash, loading: loading || user === undefined || (user && membership === undefined),
    toasts, toast, dismissToast, reminders, personLabel,
    setMembership,
    ...actions,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Insert the 5 sample items, their subtasks, a vote or two and important dates. */
async function seedWorkspace(backend, ws, meId, partnerId) {
  const base = { workspace_id: ws.id };
  const items = seedItems(meId, ws.currency);
  for (const [k, raw] of items.entries()) {
    const { _subtasks = [], ...values } = raw;
    const item = await backend.insert('items', { ...base, ...values });
    for (const [p, title] of _subtasks.entries()) await backend.insert('subtasks', { ...base, item_id: item.id, title, position: p, done: p === 0 });
    if (k < 4) await backend.upsert('item_votes', { ...base, item_id: item.id, user_id: meId, stars: [5, 3, 4, 5][k], updated_at: new Date().toISOString() }, 'item_id,user_id');
    // Demo Mode has both partners present, so seed their votes too (shows the "We both want this" badge).
    if (partnerId && k < 4) await backend.upsert('item_votes', { ...base, item_id: item.id, user_id: partnerId, stars: [5, 4, 3, 4][k], updated_at: new Date().toISOString() }, 'item_id,user_id');
    if (partnerId && k === 0) await backend.insert('comments', { ...base, item_id: item.id, user_id: partnerId, body: 'Can we pick a boat with a top deck?' });
    if (item.status === 'Completed') {
      await backend.insert('journal_entries', {
        ...base, item_id: item.id, created_by: meId, title: item.title, entry_date: item.completed_at,
        note: item.completion_note, rating: item.would_do_again, category: item.category,
        location_name: item.location_name, lat: item.lat, lng: item.lng, tags: item.tags,
      });
    }
  }
  for (const d of seedDates(meId)) await backend.insert('important_dates', { ...base, ...d });
  if (partnerId) {
    // A secret gift idea from the partner, hidden from "Me" until the reveal date.
    await backend.insert('wishlist_entries', {
      ...base, created_by: partnerId, for_user_id: meId, name: 'Engraved compass', price: 2400, currency: ws.currency,
      notes: 'For the anniversary', is_hidden: true,
      reveal_date: new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10),
    });
  }
}
