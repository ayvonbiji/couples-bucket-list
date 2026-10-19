// Write or edit a fantasy. New entries are always private.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, Lock, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useFantasy } from './FantasyLayout.jsx';
import { cn } from '../lib/utils.js';
import { EmptyState, Field, PageHeader, Segmented, Spinner, StoredImage } from '../components/ui.jsx';

export default function FantasyEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, fantasyCategories } = useApp();
  const { data, create, edit } = useFantasy();
  const existing = id ? data.fantasies.find((f) => f.id === id) : null;
  const myNotes = existing ? data.fantasy_notes.find((n) => n.fantasy_id === id && n.user_id === me.id)?.notes : '';

  const [v, setV] = useState(() => ({
    title: existing?.title || '', description: existing?.description || '',
    category_id: existing?.category_id || fantasyCategories[0]?.id || null,
    interest_level: existing?.interest_level || 0, planned_date: existing?.planned_date || '', status: existing?.status || 'idea',
  }));
  const [notes, setNotes] = useState(myNotes || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (id && !existing) return <><PageHeader back="/fantasy" /><EmptyState icon={Lock} title="Not available" body="It may have been deleted or made private." /></>;
  if (existing && existing.created_by !== me.id) return <><PageHeader back /><EmptyState icon={Lock} title="Only the author can edit this" /></>;

  async function save(e) {
    e.preventDefault();
    if (!v.title.trim()) return setError('Give it a title');
    setBusy(true);
    const c = fantasyCategories.find((x) => x.id === v.category_id);
    const values = { title: v.title.trim(), description: v.description.trim() || null, category_id: c?.id ?? null, category: c?.name ?? 'Other',
      interest_level: v.interest_level || null, planned_date: v.planned_date || null, ...(existing ? {} : { status: v.status }) };
    const r = existing ? await edit(existing.id, values, { file, removeImage }) : await create(values, { notes, file });
    setBusy(false);
    if (r) nav(existing ? `/fantasy/${existing.id}` : `/fantasy/${r.id}`, { replace: true });
  }

  const showImage = preview || (!removeImage && existing?.image_path);

  return (
    <form onSubmit={save} noValidate>
      <PageHeader title={existing ? 'Edit' : 'New fantasy'} compact back actions={
        <button className="btn-primary min-h-[38px] px-4 text-[14px]" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      } />
      <div className="space-y-6 px-5 pb-12">
        {!existing && (
          <p className="muted flex items-center gap-2 text-[13px]"><Lock size={13} strokeWidth={1.75} /> Saved privately. Only you can see it until you choose to share.</p>
        )}
        <Field error={error}>
          <input className="title-serif w-full border-0 border-b border-line bg-transparent px-0 pb-2 text-[28px] placeholder:text-ink-500/50 focus:border-ink-500 focus:outline-none focus-visible:ring-0 dark:border-line-dark"
            autoFocus={!existing} maxLength={140} placeholder="Title" value={v.title} onChange={(e) => { setV({ ...v, title: e.target.value }); setError(''); }} aria-label="Title" />
        </Field>
        <textarea className="input min-h-[160px] resize-none leading-relaxed" maxLength={5000} placeholder="Describe it, in your own words…"
          value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} aria-label="Description" />

        <div>
          <span className="label">Category</span>
          <Segmented value={v.category_id} onChange={(category_id) => setV({ ...v, category_id })} options={fantasyCategories.map((c) => ({ value: c.id, label: c.name }))} />
        </div>

        {!existing && (
          <div>
            <span className="label">Start as</span>
            <Segmented value={v.status} onChange={(status) => setV({ ...v, status })} options={[{ value: 'idea', label: 'Idea' }, { value: 'saved', label: 'Saved' }]} />
          </div>
        )}
        <Field label="Target date (optional)"><input type="date" className="input" value={v.planned_date || ''} onChange={(e) => setV({ ...v, planned_date: e.target.value })} /></Field>
        <div>
          <span className="label">How much do you want this?</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Interest level">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={v.interest_level === n} aria-label={`${n} of 5`}
                onClick={() => setV({ ...v, interest_level: v.interest_level === n ? 0 : n })}
                className={cn('h-9 flex-1 rounded-full border transition', n <= v.interest_level ? 'border-rose-400 bg-rose-100 dark:border-rose-700 dark:bg-rose-900/30' : 'border-line dark:border-line-dark')} />
            ))}
          </div>
          <p className="muted mt-1.5 text-[13px]">{['Not set', 'A passing thought', 'Curious', 'I’d like this', 'I really want this', 'A dream'][v.interest_level]}</p>
        </div>

        <div>
          <span className="label">Image (optional)</span>
          {showImage ? (
            <div className="relative w-32 overflow-hidden rounded-xl">
              {preview ? <img src={preview} alt="" className="aspect-square w-full object-cover" /> : <StoredImage bucket="fantasy" path={existing.image_path} className="aspect-square w-full" />}
              <button type="button" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white" onClick={() => { setFile(null); setRemoveImage(true); }} aria-label="Remove image"><X size={13} /></button>
            </div>
          ) : (
            <label className="grid h-24 w-32 cursor-pointer place-items-center rounded-xl border border-dashed border-ink-500/30 text-ink-500 transition hover:bg-cream-100 dark:hover:bg-white/5">
              <ImagePlus size={20} strokeWidth={1.5} />
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { setFile(e.target.files[0] || null); setRemoveImage(false); e.target.value = ''; }} aria-label="Add image" />
            </label>
          )}
          <p className="muted mt-1.5 text-[13px]">Stored privately; visible to your partner only if you share this entry.</p>
        </div>

        {!existing && (
          <Field label="Personal notes" hint="Only you will ever see these — even after sharing.">
            <textarea className="input min-h-[90px] resize-none" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        )}
      </div>
    </form>
  );
}
