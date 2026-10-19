// Shared photo album: multi-upload (compressed), grid, reorder, captions, delete, set cover,
// and a full-screen swipeable lightbox. Used by items and manual journal entries.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ImagePlus, Pencil, Star, Trash2, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useFileUrl, ConfirmDialog, StoredImage, Spinner } from './ui.jsx';
import { cn } from '../lib/utils.js';

/** target: { item_id } | { journal_entry_id }. coverId highlights the cover. */
export default function PhotoAlbum({ target, coverId, canSetCover = true, title = 'Photo album' }) {
  const { data, uploadPhotos, updatePhoto, reorderPhotos, deletePhoto, setCover } = useApp();
  const photos = useMemo(() => data.item_photos
    .filter((p) => (target.item_id ? p.item_id === target.item_id : p.journal_entry_id === target.journal_entry_id))
    .sort((a, b) => a.position - b.position), [data.item_photos, target.item_id, target.journal_entry_id]);
  const [progress, setProgress] = useState(null);
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  async function onFiles(list) {
    const files = [...list];
    if (!files.length) return;
    setProgress({ done: 0, total: files.length });
    await uploadPhotos(target, files, (done, total) => setProgress({ done, total }));
    setProgress(null);
  }

  const move = (k, dir) => {
    const next = [...photos];
    const j = k + dir;
    if (j < 0 || j >= next.length) return;
    [next[k], next[j]] = [next[j], next[k]];
    reorderPhotos(next);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="section-title">{title} <span className="muted text-sm font-normal">· {photos.length}</span></h2>
        {photos.length > 0 && <button className="text-sm font-bold text-rose-600" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p, k) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-rose-50 dark:bg-white/5">
            <button className="h-full w-full" onClick={() => !editing && setLightbox(k)} aria-label={p.caption || `Photo ${k + 1}`}>
              <StoredImage path={p.storage_path} alt={p.caption || ''} className="h-full w-full" />
            </button>
            {p.id === coverId && <span className="absolute left-1 top-1 chip bg-black/55 px-1.5 py-0.5 text-[10px] text-white"><Star size={10} className="fill-gold-400 text-gold-400" />Cover</span>}
            {p.caption && !editing && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 px-1.5 pb-1 pt-3 text-[10px] text-white">{p.caption}</span>}
            {editing && (
              <div className="absolute inset-0 flex flex-col justify-between bg-black/40 p-1">
                <div className="flex justify-between">
                  <button className="rounded-full bg-white/90 p-1 text-ink-900" onClick={() => move(k, -1)} disabled={k === 0} aria-label="Move earlier"><ArrowLeft size={14} /></button>
                  <button className="rounded-full bg-white/90 p-1 text-ink-900" onClick={() => move(k, 1)} disabled={k === photos.length - 1} aria-label="Move later"><ArrowRight size={14} /></button>
                </div>
                <div className="flex justify-between">
                  {canSetCover && target.item_id ? <button className="rounded-full bg-white/90 p-1 text-ink-900" onClick={() => setCover(target.item_id, p.id)} aria-label="Set as cover"><Star size={14} /></button> : <span />}
                  <button className="rounded-full bg-red-600 p-1 text-white" onClick={() => setConfirmDel(p)} aria-label="Delete photo"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        <label className={cn('flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-rose-200 text-xs font-bold text-rose-600 dark:border-rose-900', progress && 'pointer-events-none opacity-70')}>
          {progress ? <><Spinner /> {progress.done}/{progress.total}</> : <><ImagePlus size={22} /> Add photos</>}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {editing && <p className="muted mt-1.5 text-xs">Use arrows to reorder · ★ sets the cover · open a photo to edit its caption.</p>}

      {lightbox !== null && photos[lightbox] && (
        <Lightbox photos={photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)}
          onCaption={(p, caption) => updatePhoto(p.id, { caption: caption.trim() || null })}
          onDelete={(p) => setConfirmDel(p)} />
      )}
      <ConfirmDialog open={!!confirmDel} title="Delete this photo?" message="It will be removed for both of you." danger confirmLabel="Delete"
        onClose={() => setConfirmDel(null)} onConfirm={async () => { await deletePhoto(confirmDel); setLightbox(null); }} />
    </section>
  );
}

/** Full-screen viewer with swipe/arrow-key navigation and inline caption editing. */
export function Lightbox({ photos, index, onIndex, onClose, onCaption, onDelete }) {
  const p = photos[index];
  const url = useFileUrl(p.storage_path);
  const [cap, setCap] = useState(p.caption || '');
  const [editCap, setEditCap] = useState(false);
  const touch = useRef(null);
  useEffect(() => { setCap(p.caption || ''); setEditCap(false); }, [p.id, p.caption]);
  useEffect(() => {
    const onKey = (e) => {
      if (editCap) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose, editCap]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Photo viewer"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (dx < -50) onIndex(Math.min(photos.length - 1, index + 1));
        if (dx > 50) onIndex(Math.max(0, index - 1));
      }}>
      <div className="flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <span className="text-sm opacity-80">{index + 1} / {photos.length}</span>
        <div className="flex gap-1">
          {onDelete && <button className="icon-btn hover:bg-white/10" onClick={() => onDelete(p)} aria-label="Delete photo"><Trash2 size={20} /></button>}
          <button className="icon-btn hover:bg-white/10" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {url ? <img src={url} alt={p.caption || ''} className="max-h-full max-w-full object-contain animate-fade-up" key={p.id} /> : <Spinner />}
        {index > 0 && <button className="absolute left-2 hidden rounded-full bg-white/10 p-2 sm:block" onClick={() => onIndex(index - 1)} aria-label="Previous"><ChevronLeft /></button>}
        {index < photos.length - 1 && <button className="absolute right-2 hidden rounded-full bg-white/10 p-2 sm:block" onClick={() => onIndex(index + 1)} aria-label="Next"><ChevronRight /></button>}
      </div>
      <div className="p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {onCaption && editCap ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onCaption(p, cap); setEditCap(false); }}>
            <input autoFocus className="input bg-white/10 text-white" maxLength={300} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Write a caption…" />
            <button className="btn-primary">Save</button>
          </form>
        ) : (
          <button className="flex w-full items-center justify-center gap-2 text-center text-[15px]" onClick={() => onCaption && setEditCap(true)} disabled={!onCaption}>
            {p.caption || <span className="opacity-60">{onCaption ? 'Add a caption' : ''}</span>}
            {onCaption && <Pencil size={14} className="opacity-60" />}
          </button>
        )}
      </div>
    </div>
  );
}
