// Secret Fantasy shell: optional device lock + its own data provider.
// Data is loaded only while this section is open and is dropped from memory as soon
// as you leave or lock it — it never enters the main app state, search, feeds,
// notifications, exports or backups.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Fingerprint, Lock } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { compressImage } from '../lib/image.js';
import { effectsOfResponses, guardFantasyUpdate } from '../lib/fantasy.js';
import { uid } from '../lib/utils.js';
import { Spinner } from '../components/ui.jsx';
import { checkPin, getLock, unlockWithBiometrics } from './lock.js';

const Ctx = createContext(null);
export const useFantasy = () => useContext(Ctx);

const AUTO_LOCK_MS = 60 * 1000; // relock after a minute in the background

export default function FantasyLayout() {
  const { me } = useApp();
  const [unlocked, setUnlocked] = useState(() => !getLock(me.id));
  const hiddenAt = useRef(null);

  // Auto-lock when the app goes to the background for a while.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > AUTO_LOCK_MS && getLock(me.id)) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [me.id]);

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return (
    <FantasyProvider lock={() => setUnlocked(false)}>
      <Outlet />
    </FantasyProvider>
  );
}

function LockScreen({ onUnlock }) {
  const { me } = useApp();
  const lock = getLock(me.id);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const tryBio = useCallback(async () => { if (await unlockWithBiometrics(me.id)) onUnlock(); }, [me.id, onUnlock]);
  useEffect(() => { if (lock?.credentialId) tryBio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    if (await checkPin(me.id, pin)) onUnlock();
    else { setError('That PIN isn’t right'); setPin(''); }
  }

  return (
    <div className="grid min-h-[80dvh] place-items-center px-8">
      <form onSubmit={submit} className="w-full max-w-[260px] text-center animate-fade-up">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-line text-rose-500 dark:border-line-dark"><Lock size={18} strokeWidth={1.5} /></span>
        <h1 className="title-serif text-[30px]">Secret Fantasy</h1>
        <p className="muted mt-1 text-[14px]">Enter your PIN to open</p>
        {lock?.pinHash && (
          <>
            <input className="input mt-6 text-center text-[22px] tracking-[0.6em]" type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus
              value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} aria-label="PIN" />
            {error && <p className="err mt-2">{error}</p>}
            <button className="btn-dark mt-4 w-full" disabled={pin.length < 4}>Unlock</button>
          </>
        )}
        {lock?.credentialId && <button type="button" className="btn-ghost mt-2 w-full" onClick={tryBio}><Fingerprint size={18} strokeWidth={1.5} /> Use Face ID or fingerprint</button>}
      </form>
    </div>
  );
}

const EMPTY = { fantasies: [], fantasy_responses: [], fantasy_notes: [], fantasy_comments: [], fantasy_photos: [] };

function FantasyProvider({ children, lock }) {
  const { backend, workspace: ws, me, membership, toast } = useApp();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const memberIds = useMemo(() => membership.members.map((m) => m.id), [membership]);

  const reload = useCallback(async () => {
    try { setData(await backend.loadFantasies(ws.id, me.id)); } catch (e) { toast(e.message, 'error'); }
    setLoading(false);
  }, [backend, ws.id, me.id, toast]);

  useEffect(() => {
    reload();
    let t;
    const unsub = backend.subscribeFantasies(ws.id, () => { clearTimeout(t); t = setTimeout(reload, 300); });
    // Drop everything from memory (and any cached image URLs) on exit or lock.
    return () => { unsub?.(); clearTimeout(t); setData(EMPTY); backend.forgetUrls?.('fantasy'); };
  }, [backend, ws.id, reload]);

  const run = useCallback(async (fn, msg) => {
    try { const r = await fn(); if (msg) toast(msg, 'success'); return r ?? true; } catch (e) { toast(e.message, 'error'); return undefined; }
  }, [toast]);

  const responsesFor = (fid, d = data) => d.fantasy_responses.filter((r) => r.fantasy_id === fid);

  const actions = useMemo(() => {
    const base = { workspace_id: ws.id };
    const find = (id) => data.fantasies.find((f) => f.id === id);

    /** Update a fantasy, validating with the same rules the database enforces. */
    async function updateFantasy(id, patch) {
      const old = find(id);
      const safe = guardFantasyUpdate(old, patch, { actorId: me.id, responses: responsesFor(id), memberIds });
      await backend.update('fantasies', { id }, safe);
      await reload();
    }

    async function uploadImage(fid, file) {
      const { blob } = await compressImage(file);
      const path = `${ws.id}/${fid}/${uid()}.jpg`;
      await backend.uploadFile('fantasy', path, blob);
      return path;
    }

    return {
      reload,
      create: (values, { notes, file } = {}) => run(async () => {
        const f = await backend.insert('fantasies', { ...base, ...values, visibility: 'private', status: values.status === 'agreed' ? 'saved' : values.status || 'idea', created_by: me.id });
        if (file) await backend.update('fantasies', { id: f.id }, { image_path: await uploadImage(f.id, file) });
        if (notes?.trim()) await backend.upsert('fantasy_notes', { ...base, fantasy_id: f.id, user_id: me.id, notes: notes.trim(), updated_at: new Date().toISOString() }, 'fantasy_id,user_id');
        await reload();
        return f;
      }, 'Saved privately'),

      edit: (id, values, { file, removeImage } = {}) => run(async () => {
        const old = find(id);
        let image_path = old.image_path;
        if (file) image_path = await uploadImage(id, file);
        if ((file || removeImage) && old.image_path) await backend.removeFiles('fantasy', [old.image_path]).catch(() => {});
        if (removeImage && !file) image_path = null;
        await updateFantasy(id, { ...values, image_path });
      }, 'Saved'),

      share: (id) => run(() => updateFantasy(id, { visibility: 'shared' }), 'Shared with your partner'),
      unshare: (id) => run(() => updateFantasy(id, { visibility: 'private' }), 'Private again'),
      /** Any status can be chosen directly; consent rules still apply. */
      setStatus: (id, status) => run(() => updateFantasy(id, { status })),
      saveExperience: (id, experience_note, experience_rating) => run(() => updateFantasy(id, { experience_note: experience_note?.trim() || null, experience_rating: experience_rating || null }), 'Saved'),
      /** Hide from my own lists (or bring back) — "remove my participation". */
      setHiddenForMe: (id, hidden) => run(async () => {
        const mine = responsesFor(id).find((r) => r.user_id === me.id) || {};
        await backend.upsert('fantasy_responses', { ...base, fantasy_id: id, user_id: me.id, reaction: mine.reaction ?? null, comfortable: mine.comfortable ?? false, boundaries: mine.boundaries ?? null, allow_photos: mine.allow_photos ?? false, hidden, updated_at: new Date().toISOString() }, 'fantasy_id,user_id');
        await reload();
      }, hidden ? 'Hidden from your list' : 'Back on your list'),

      addPhotos: (id, files) => run(async () => {
        for (const file of files) {
          const path = await uploadImage(id, file);
          await backend.insert('fantasy_photos', { ...base, fantasy_id: id, uploaded_by: me.id, storage_path: path });
        }
        await reload();
      }, 'Photos saved'),
      deletePhoto: (photo) => run(async () => {
        await backend.removeFiles('fantasy', [photo.storage_path]).catch(() => {});
        await backend.remove('fantasy_photos', { id: photo.id });
        await reload();
      }),
      setWishlist: (id, on) => run(() => updateFantasy(id, { on_wishlist: on }), on ? 'Added to your wishlist' : 'Removed from your wishlist'),
      setPlannedDate: (id, planned_date) => run(() => updateFantasy(id, { planned_date: planned_date || null })),

      /** My reaction / comfort / boundaries. Withdrawing consent unwinds "agreed" and the wishlist. */
      respond: (id, patch) => run(async () => {
        const mine = responsesFor(id).find((r) => r.user_id === me.id) || {};
        const row = { ...base, fantasy_id: id, user_id: me.id, reaction: mine.reaction ?? null, comfortable: mine.comfortable ?? false, boundaries: mine.boundaries ?? null,
          hidden: mine.hidden ?? false, allow_photos: mine.allow_photos ?? false, ...patch, updated_at: new Date().toISOString() };
        await backend.upsert('fantasy_responses', row, 'fantasy_id,user_id');
        if (backend.mode === 'local') {
          // Demo Mode: mirror the database trigger.
          const next = [...responsesFor(id).filter((r) => r.user_id !== me.id), row];
          const eff = effectsOfResponses(find(id), next, memberIds, patch.reaction);
          if (Object.keys(eff).length) await backend.update('fantasies', { id }, eff);
        }
        await reload();
      }),

      saveNotes: (id, notes) => run(async () => {
        await backend.upsert('fantasy_notes', { ...base, fantasy_id: id, user_id: me.id, notes: notes.trim() || null, updated_at: new Date().toISOString() }, 'fantasy_id,user_id');
        await reload();
      }, 'Note saved'),

      addComment: (id, body) => run(async () => { await backend.insert('fantasy_comments', { ...base, fantasy_id: id, user_id: me.id, body: body.trim() }); await reload(); }),
      deleteComment: (cid) => run(async () => { await backend.remove('fantasy_comments', { id: cid }); await reload(); }),

      remove: (id) => run(async () => {
        const f = find(id);
        const paths = [f?.image_path, ...data.fantasy_photos.filter((p) => p.fantasy_id === id).map((p) => p.storage_path)].filter(Boolean);
        if (paths.length) await backend.removeFiles('fantasy', paths).catch(() => {});
        await backend.remove('fantasies', { id });
        await reload();
      }, 'Deleted'),
    };
  }, [backend, ws.id, me.id, memberIds, data, reload, run]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = { data, loading, memberIds, responsesFor, lock, hasLock: Boolean(getLock(me.id)), ...actions };
  return (
    <Ctx.Provider value={value}>
      {loading ? <div className="grid min-h-[60dvh] place-items-center text-rose-500"><Spinner /></div> : children}
    </Ctx.Provider>
  );
}
