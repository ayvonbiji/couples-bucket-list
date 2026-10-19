// "Mark complete": date, photos, journal note, would-do-again rating, actual cost.
import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { Field, Modal, Spinner, Stars } from './ui.jsx';
import { todayISO } from '../lib/utils.js';
import { toNum } from '../lib/validation.js';

export default function CompleteDialog({ item, open, onClose }) {
  const { completeItem } = useApp();
  const [v, setV] = useState({ completed_at: todayISO(), completion_note: '', would_do_again: 0, actual_cost: item.est_cost ?? '' });
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach(URL.revokeObjectURL);
  }, [files]);

  async function save() {
    if (!v.completed_at) return setError('When did you do it?');
    if (v.completed_at > todayISO()) return setError('That date is in the future');
    setBusy(true);
    const r = await completeItem(item.id, { ...v, would_do_again: v.would_do_again || null, actual_cost: toNum(v.actual_cost), completion_note: v.completion_note.trim() || null, files });
    setBusy(false);
    if (r) onClose(true);
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title="Mark as completed"
      footer={<><button className="btn-ghost flex-1" onClick={() => onClose(false)}>Not yet</button>
        <button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save memory'}</button></>}>
      <div className="space-y-4">
        <p className="muted text-[14px]">“{item.title}” moves to your Memories and timeline.</p>
        <Field label="Date" error={error}><input type="date" className="input" max={todayISO()} value={v.completed_at} onChange={(e) => setV({ ...v, completed_at: e.target.value })} /></Field>
        <Field label="Journal note"><textarea className="input min-h-[100px]" placeholder="What made it special?" value={v.completion_note} onChange={(e) => setV({ ...v, completion_note: e.target.value })} /></Field>
        <div><span className="label">Would we do it again?</span><Stars value={v.would_do_again} onChange={(n) => setV({ ...v, would_do_again: n })} size={24} label="Would do again" /></div>
        <Field label={`What it actually cost (${item.currency || ''})`}><input type="number" min="0" className="input" value={v.actual_cost ?? ''} onChange={(e) => setV({ ...v, actual_cost: e.target.value })} /></Field>
        <div>
          <span className="label">Photos</span>
          <div className="flex flex-wrap gap-2">
            {urls.map((u, k) => (
              <div key={u} className="relative h-16 w-16 overflow-hidden rounded-lg">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== k))} aria-label="Remove"><X size={12} /></button>
              </div>
            ))}
            <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-ink-500/30 text-ink-500">
              <ImagePlus size={20} />
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { setFiles([...files, ...e.target.files]); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
