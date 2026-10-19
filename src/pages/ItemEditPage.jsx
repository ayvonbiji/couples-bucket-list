// Create / edit a bucket-list item.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ImagePlus, MapPin, Plus, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { CATEGORIES, CATEGORY_META, CURRENCIES, PRIORITIES, PRIORITY_META, STATUSES } from '../lib/constants.js';
import { toNum, validateItem } from '../lib/validation.js';
import { EmptyState, Field, PageHeader, Segmented, Spinner, Toggle } from '../components/ui.jsx';
import TagInput from '../components/TagInput.jsx';

const MapPicker = lazy(() => import('../components/MapBits.jsx').then((m) => ({ default: m.MapPicker })));

const toLocalInput = (iso) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');

export default function ItemEditPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const nav = useNavigate();
  const { data, me, partner, workspace, createItem, updateItem } = useApp();
  const existing = id ? data.items.find((i) => i.id === id) : null;
  const preset = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);

  const [v, setV] = useState(() => existing ? { ...existing, reminder_at: toLocalInput(existing.reminder_at) } : {
    title: '', description: '', category: preset.category || 'Experiences', priority: 'Someday',
    status: preset.date ? 'Planned' : 'Idea', timeframe: '', start_date: preset.date || '', end_date: '',
    location_name: '', lat: null, lng: null, est_cost: '', currency: workspace.currency, owner_user_id: null,
    added_by_both: false, tags: [], is_surprise: false, reveal_date: '', savings_target: '', savings_saved: '',
    reminder_at: '',
  });
  const [subtasks, setSubtasks] = useState([]);
  const [subText, setSubText] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [showMap, setShowMap] = useState(Boolean(existing?.lat));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  if (id && !existing) return <><PageHeader title="Not found" back /><EmptyState emoji="🫥" title="This item isn't here" body="It may have been deleted." /></>;

  const set = (patch) => setV((x) => ({ ...x, ...patch }));

  async function save(e) {
    e.preventDefault();
    const errs = validateItem(v);
    setErrors(errs);
    if (Object.keys(errs).length) { setTimeout(() => document.querySelector('[role=alert]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50); return; }
    setBusy(true);
    const row = {
      title: v.title.trim(), description: v.description?.trim() || null, category: v.category, priority: v.priority, status: v.status,
      timeframe: v.timeframe?.trim() || null, start_date: v.start_date || null, end_date: v.end_date || null,
      location_name: v.location_name?.trim() || null, lat: v.lat ?? null, lng: v.lng ?? null,
      est_cost: toNum(v.est_cost), currency: v.currency, owner_user_id: v.owner_user_id || null, added_by_both: v.added_by_both,
      tags: v.tags, is_surprise: v.is_surprise, reveal_date: v.is_surprise ? v.reveal_date || null : null,
      savings_target: toNum(v.savings_target), savings_saved: toNum(v.savings_saved) ?? 0,
      reminder_at: v.reminder_at ? new Date(v.reminder_at).toISOString() : null,
      reminder_done: existing && existing.reminder_at !== (v.reminder_at ? new Date(v.reminder_at).toISOString() : null) ? false : existing?.reminder_done ?? false,
    };
    if (row.status === 'Completed' && !existing?.completed_at) row.completed_at = format(new Date(), 'yyyy-MM-dd');
    const pending = subText.trim() ? [...subtasks, subText.trim()] : subtasks;
    const r = existing ? await updateItem(existing.id, row, 'Saved ✓') : await createItem(row, { subtasks: pending, files });
    setBusy(false);
    if (r) nav(`/item/${r.id}`, { replace: true });
  }

  return (
    <form onSubmit={save} noValidate>
      <PageHeader title={existing ? 'Edit item' : 'New dream ✨'} back actions={
        <button className="btn-primary" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      } />

      <div className="space-y-5 px-4 pb-10">
        <Field label="Title *" error={errors.title}>
          <input className="input text-lg font-semibold" autoFocus={!existing} maxLength={140} placeholder="e.g. Hot-air balloon at sunrise" value={v.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!errors.title} />
        </Field>

        <Field label="Notes">
          <textarea className="input min-h-[90px]" maxLength={5000} placeholder="Why we want this, ideas, details…" value={v.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>

        <div>
          <span className="label">Category</span>
          <Segmented value={v.category} onChange={(category) => set({ category })} options={CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_META[c].emoji} ${c}` }))} />
        </div>
        <div>
          <span className="label">Priority</span>
          <Segmented size="lg" value={v.priority} onChange={(priority) => set({ priority })} options={PRIORITIES.map((p) => ({ value: p, label: `${PRIORITY_META[p].emoji} ${p}` }))} />
        </div>
        <div>
          <span className="label">Status</span>
          <Segmented value={v.status} onChange={(status) => set({ status })} options={STATUSES} />
        </div>

        <div className="card space-y-4 p-4">
          <h2 className="section-title">When</h2>
          <Field label="Timeframe (free text)"><input className="input" maxLength={80} placeholder="Next summer, our 5th anniversary…" value={v.timeframe || ''} onChange={(e) => set({ timeframe: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><input type="date" className="input" value={v.start_date || ''} onChange={(e) => set({ start_date: e.target.value })} /></Field>
            <Field label="End date" error={errors.end_date}><input type="date" className="input" value={v.end_date || ''} min={v.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} /></Field>
          </div>
          <Field label="Reminder" hint="We'll nudge you on this device at this time">
            <input type="datetime-local" className="input" value={v.reminder_at || ''} onChange={(e) => set({ reminder_at: e.target.value })} />
          </Field>
        </div>

        <div className="card space-y-3 p-4">
          <h2 className="section-title">Where</h2>
          <Field label="Location"><input className="input" placeholder="City, place or address" value={v.location_name || ''} onChange={(e) => set({ location_name: e.target.value })} /></Field>
          {showMap ? (
            <Suspense fallback={<div className="grid h-56 place-items-center"><Spinner /></div>}>
              <MapPicker lat={v.lat} lng={v.lng} query={v.location_name} onChange={({ lat, lng, name }) => set({ lat, lng, ...(name && !v.location_name ? { location_name: name } : {}) })} />
            </Suspense>
          ) : (
            <button type="button" className="btn-soft" onClick={() => setShowMap(true)}><MapPin size={16} /> Add a map pin</button>
          )}
          {v.lat !== null && v.lat !== undefined && <button type="button" className="text-xs font-bold text-rose-600" onClick={() => set({ lat: null, lng: null })}>Remove pin</button>}
          {errors.location && <p className="err">{errors.location}</p>}
        </div>

        <div className="card space-y-4 p-4">
          <h2 className="section-title">Money</h2>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Estimated cost" error={errors.est_cost}><input type="number" min="0" inputMode="decimal" className="input" value={v.est_cost ?? ''} onChange={(e) => set({ est_cost: e.target.value })} /></Field>
            <Field label="Currency">
              <select className="input" value={v.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Savings target" error={errors.savings_target}><input type="number" min="0" inputMode="decimal" className="input" value={v.savings_target ?? ''} onChange={(e) => set({ savings_target: e.target.value })} /></Field>
            <Field label="Saved so far" error={errors.savings_saved}><input type="number" min="0" inputMode="decimal" className="input" value={v.savings_saved ?? ''} onChange={(e) => set({ savings_saved: e.target.value })} /></Field>
          </div>
        </div>

        <div className="card space-y-4 p-4">
          <h2 className="section-title">Who</h2>
          <div>
            <span className="label">Owner</span>
            <Segmented value={v.owner_user_id || ''} onChange={(o) => set({ owner_user_id: o || null })}
              options={[{ value: me.id, label: 'Me' }, ...(partner ? [{ value: partner.id, label: partner.display_name || 'Partner' }] : []), { value: '', label: 'Both' }]} />
          </div>
          <Toggle checked={v.added_by_both} onChange={(added_by_both) => set({ added_by_both })} label="We came up with this together" description="Shows “Added by: Both”" />
          <Toggle checked={v.is_surprise} onChange={(is_surprise) => set({ is_surprise })} label="🤫 Surprise" description={`Hidden from ${partner?.display_name || 'your partner'} until you reveal it`} />
          {v.is_surprise && (
            <Field label="Auto-reveal on (optional)" hint="Leave empty to reveal manually from the item page">
              <input type="date" className="input" value={v.reveal_date || ''} onChange={(e) => set({ reveal_date: e.target.value })} />
            </Field>
          )}
        </div>

        <div>
          <span className="label">Tags</span>
          <TagInput value={v.tags} onChange={(tags) => set({ tags })} />
        </div>

        {!existing && (
          <>
            <div>
              <span className="label">Photos (first one becomes the cover)</span>
              <div className="flex flex-wrap gap-2">
                {previews.map((u, k) => (
                  <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl">
                    <img src={u} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== k))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove photo"><X size={14} /></button>
                  </div>
                ))}
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-rose-200 text-rose-500 dark:border-rose-900">
                  <ImagePlus size={22} />
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { setFiles([...files, ...e.target.files]); e.target.value = ''; }} />
                </label>
              </div>
            </div>
            <div>
              <span className="label">Checklist</span>
              <ul className="mb-2 space-y-1">
                {subtasks.map((s, k) => (
                  <li key={k} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-ink-800">
                    <span className="flex-1">☐ {s}</span>
                    <button type="button" onClick={() => setSubtasks(subtasks.filter((_, j) => j !== k))} aria-label="Remove"><X size={14} /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input className="input" placeholder="Book flights, save money…" value={subText} onChange={(e) => setSubText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (subText.trim()) { setSubtasks([...subtasks, subText.trim()]); setSubText(''); } } }} />
                <button type="button" className="btn-soft px-3" onClick={() => { if (subText.trim()) { setSubtasks([...subtasks, subText.trim()]); setSubText(''); } }} aria-label="Add subtask"><Plus size={18} /></button>
              </div>
            </div>
          </>
        )}

        <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : existing ? 'Save changes' : 'Add to our list 💕'}</button>
      </div>
    </form>
  );
}
