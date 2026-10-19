// Completion details: date, rating, favourite memory, short note, optional reflection,
// would-do-again, final cost and photos. `edit` mode updates an already-completed item.
import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { Field, Modal, Spinner, Stars } from './ui.jsx';
import { todayISO } from '../lib/utils.js';
import { toNum } from '../lib/validation.js';

export default function CompleteDialog({ item, open, onClose, edit = false }) {
  const { completeItem, updateCompletion } = useApp();
  const [v, setV] = useState(() => ({
    completed_at: item.completed_at || todayISO(),
    satisfaction: item.satisfaction || 0,
    favourite_memory: item.favourite_memory || '',
    completion_note: item.completion_note || '',
    reflection: item.reflection || '',
    would_do_again: item.would_do_again || 0,
    actual_cost: item.actual_cost ?? item.est_cost ?? '',
  }));
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (p) => setV((x) => ({ ...x, ...p }));

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach(URL.revokeObjectURL);
  }, [files]);

  async function save() {
    if (!v.completed_at) return setError('When did you do it?');
    if (v.completed_at > todayISO()) return setError('That date is in the future');
    setBusy(true);
    const row = {
      completed_at: v.completed_at, satisfaction: v.satisfaction || null, favourite_memory: v.favourite_memory.trim() || null,
      completion_note: v.completion_note.trim() || null, reflection: v.reflection.trim() || null,
      would_do_again: v.would_do_again || null, actual_cost: toNum(v.actual_cost),
    };
    const r = edit ? await updateCompletion(item.id, row) : await completeItem(item.id, { ...row, files });
    setBusy(false);
    if (r) onClose(true);
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title={edit ? 'Edit memory' : 'How was the experience?'}
      footer={<><button className="btn-ghost flex-1" onClick={() => onClose(false)}>{edit ? 'Cancel' : 'Not yet'}</button>
        <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : edit ? 'Save' : 'Mark as completed'}</button></>}>
      <div className="space-y-5">
        {!edit && <p className="muted text-[14px]">“{item.title}” moves to your Memories and timeline. Everything here is optional and you can edit it later.</p>}
        <Field label="Completed on" error={error}><input type="date" className="input" max={todayISO()} value={v.completed_at} onChange={(e) => set({ completed_at: e.target.value })} /></Field>
        <div><span className="label">Rating</span><Stars value={v.satisfaction} onChange={(n) => set({ satisfaction: n })} size={22} label="How was it" /></div>
        <Field label="Favourite memory"><input className="input" maxLength={1000} placeholder="The moment you’ll remember" value={v.favourite_memory} onChange={(e) => set({ favourite_memory: e.target.value })} /></Field>
        <Field label="Short note"><textarea className="input min-h-[80px] resize-none" maxLength={5000} placeholder="What made it special?" value={v.completion_note} onChange={(e) => set({ completion_note: e.target.value })} /></Field>
        <details className="group">
          <summary className="btn-link cursor-pointer text-[14px]">More — reflection, would do again, cost{!edit && ', photos'}</summary>
          <div className="mt-4 space-y-5">
            <Field label="Reflection"><textarea className="input min-h-[110px] resize-none" maxLength={10000} placeholder="A longer look back, if you like" value={v.reflection} onChange={(e) => set({ reflection: e.target.value })} /></Field>
            <div><span className="label">Would we do it again?</span><Stars value={v.would_do_again} onChange={(n) => set({ would_do_again: n })} size={20} label="Would do again" /></div>
            <Field label={`Final cost (${item.currency || ''})`}><input type="number" min="0" inputMode="decimal" className="input" value={v.actual_cost ?? ''} onChange={(e) => set({ actual_cost: e.target.value })} /></Field>
            {!edit && (
              <div>
                <span className="label">Photos</span>
                <div className="flex flex-wrap gap-2">
                  {urls.map((u, k) => (
                    <div key={u} className="relative h-16 w-16 overflow-hidden rounded-lg">
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      <button className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== k))} aria-label="Remove"><X size={12} /></button>
                    </div>
                  ))}
                  <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-ink-500/30 text-ink-500">
                    <ImagePlus size={20} strokeWidth={1.5} />
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { setFiles([...files, ...e.target.files]); e.target.value = ''; }} aria-label="Add photos" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </Modal>
  );
}
