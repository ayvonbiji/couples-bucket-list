// Create / edit a dream. Quick by default: essentials first, everything else in tidy optional sections.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarDays, ImagePlus, Lock, MapPin, Plus, SlidersHorizontal, Wallet, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { CURRENCIES, PRIORITIES, STATUSES, TIME_REQUIRED } from '../lib/constants.js';
import { toNum, validateItem } from '../lib/validation.js';
import { Disclosure, EmptyState, Field, PageHeader, Segmented, SegmentedControl, Spinner, Toggle } from '../components/ui.jsx';
import TagInput from '../components/TagInput.jsx';
import { CategoryIcon } from '../components/icons.jsx';

const MapPicker = lazy(() => import('../components/MapBits.jsx').then((m) => ({ default: m.MapPicker })));

const toLocalInput = (iso) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');

export default function ItemEditPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const nav = useNavigate();
  const { data, partner, workspace, categories, createItem, updateItem } = useApp();
  const existing = id ? data.items.find((i) => i.id === id) : null;
  const preset = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);

  const [v, setV] = useState(() => existing ? { ...existing, reminder_at: toLocalInput(existing.reminder_at) } : {
    title: '', description: '', category: preset.category || categories[0]?.name || 'General', subcategory: '', notes: '', time_required: '', actual_cost: '', priority: 'Medium',
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

  if (id && !existing) return <><PageHeader back /><EmptyState title="This dream isn’t here" body="It may have been deleted." /></>;

  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const addSub = () => { if (subText.trim()) { setSubtasks([...subtasks, subText.trim()]); setSubText(''); } };

  async function save(e) {
    e.preventDefault();
    const errs = validateItem(v);
    setErrors(errs);
    if (Object.keys(errs).length) {
      // Open any collapsed section containing an error, then scroll to it.
      setTimeout(() => {
        const el = document.querySelector('[role=alert]');
        el?.closest('details')?.setAttribute('open', '');
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
      return;
    }
    setBusy(true);
    const row = {
      title: v.title.trim(), description: v.description?.trim() || null, category: v.category, subcategory: v.subcategory?.trim() || null,
      notes: v.notes?.trim() || null, time_required: v.time_required || null, actual_cost: toNum(v.actual_cost), priority: v.priority, status: v.status,
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
    const r = existing ? await updateItem(existing.id, row, 'Saved') : await createItem(row, { subtasks: pending, files });
    setBusy(false);
    if (r) nav(`/item/${r.id}`, { replace: true });
  }

  const has = (...keys) => keys.some((k) => v[k] !== null && v[k] !== undefined && v[k] !== '' && !(Array.isArray(v[k]) && !v[k].length));

  return (
    <form onSubmit={save} noValidate>
      <PageHeader title={existing ? 'Edit dream' : 'New dream'} compact back actions={
        <button className="btn-primary min-h-[38px] px-4 text-[14px]" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      } />

      <div className="space-y-6 px-5 pb-12">
        {/* Essentials */}
        <section className="space-y-4">
          <Field error={errors.title}>
            <input className="w-full border-0 border-b border-line bg-transparent px-0 pb-2 pt-1 text-[22px] font-medium placeholder:text-ink-500/60 focus:border-ink-500 focus:outline-none focus-visible:ring-0 dark:border-line-dark"
              autoFocus={!existing} maxLength={140} placeholder="What do you dream of doing?" value={v.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!errors.title} aria-label="Title" />
          </Field>
          <textarea className="input min-h-[72px] resize-none" maxLength={5000} placeholder="Short description" value={v.description || ''} onChange={(e) => set({ description: e.target.value })} aria-label="Description" />

          <div>
            <span className="label">Category</span>
            <Segmented value={v.category} onChange={(category) => set({ category })}
              options={categories.map((c) => ({ value: c.name, label: <span className="inline-flex items-center gap-1.5"><CategoryIcon category={c.name} size={14} /> {c.name}</span> }))} />
            {errors.category && <p className="err">{errors.category}</p>}
            <input className="input mt-2 py-2 text-[14px]" maxLength={60} placeholder="Subcategory (optional)" value={v.subcategory || ''} onChange={(e) => set({ subcategory: e.target.value })} aria-label="Subcategory" />
          </div>
          <div>
            <span className="label">Status</span>
            <SegmentedControl value={v.status} onChange={(status) => set({ status })} options={STATUSES.map((s) => ({ value: s, label: { 'In Progress': 'Doing', 'On Hold': 'On hold', Completed: 'Done' }[s] || s }))} />
          </div>
          <div>
            <span className="label">Priority</span>
            <SegmentedControl value={v.priority} onChange={(priority) => set({ priority })} options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
          </div>
        </section>

        {/* Optional sections */}
        <section className="space-y-2">
          <Disclosure title="When" icon={CalendarDays} defaultOpen={Boolean(preset.date) || has('start_date', 'timeframe', 'reminder_at')}>
            <div className="space-y-4">
              <Field label="Timeframe"><input className="input" maxLength={80} placeholder="Next summer, our anniversary…" value={v.timeframe || ''} onChange={(e) => set({ timeframe: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><input type="date" className="input" value={v.start_date || ''} onChange={(e) => set({ start_date: e.target.value })} /></Field>
                <Field label="End" error={errors.end_date}><input type="date" className="input" value={v.end_date || ''} min={v.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} /></Field>
              </div>
              <div>
                <span className="label">Time required</span>
                <Segmented value={v.time_required || ''} onChange={(time_required) => set({ time_required })} options={[{ value: '', label: 'Not sure' }, ...TIME_REQUIRED]} />
              </div>
              <Field label="Reminder" hint="A gentle nudge on this device"><input type="datetime-local" className="input" value={v.reminder_at || ''} onChange={(e) => set({ reminder_at: e.target.value })} /></Field>
            </div>
          </Disclosure>

          <Disclosure title="Where" icon={MapPin} defaultOpen={has('location_name')}>
            <div className="space-y-3">
              <input className="input" placeholder="City, place or address" value={v.location_name || ''} onChange={(e) => set({ location_name: e.target.value })} aria-label="Location" />
              {showMap ? (
                <Suspense fallback={<div className="grid h-56 place-items-center"><Spinner /></div>}>
                  <MapPicker lat={v.lat} lng={v.lng} query={v.location_name} onChange={({ lat, lng, name }) => set({ lat, lng, ...(name && !v.location_name ? { location_name: name } : {}) })} />
                </Suspense>
              ) : (
                <button type="button" className="btn-link" onClick={() => setShowMap(true)}><MapPin size={14} strokeWidth={1.75} /> Drop a pin on the map</button>
              )}
              {v.lat !== null && v.lat !== undefined && <button type="button" className="btn-link text-[13px]" onClick={() => set({ lat: null, lng: null })}>Remove pin</button>}
              {errors.location && <p className="err">{errors.location}</p>}
            </div>
          </Disclosure>

          <Disclosure title="Budget" icon={Wallet} defaultOpen={has('est_cost', 'savings_target', 'actual_cost')}>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <Field label="Estimated cost" error={errors.est_cost}><input type="number" min="0" inputMode="decimal" className="input" value={v.est_cost ?? ''} onChange={(e) => set({ est_cost: e.target.value })} /></Field>
                <Field label="Currency"><select className="input" value={v.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Savings goal" error={errors.savings_target}><input type="number" min="0" inputMode="decimal" className="input" value={v.savings_target ?? ''} onChange={(e) => set({ savings_target: e.target.value })} /></Field>
                <Field label="Saved so far" error={errors.savings_saved}><input type="number" min="0" inputMode="decimal" className="input" value={v.savings_saved ?? ''} onChange={(e) => set({ savings_saved: e.target.value })} /></Field>
              </div>
              <Field label="Actual cost" hint="Fill in once you know what it really cost"><input type="number" min="0" inputMode="decimal" className="input" value={v.actual_cost ?? ''} onChange={(e) => set({ actual_cost: e.target.value })} /></Field>
            </div>
          </Disclosure>

          <Disclosure title="Privacy" icon={Lock} defaultOpen={v.is_surprise}>
            <div className="space-y-4">
              <Toggle checked={v.is_surprise} onChange={(is_surprise) => set({ is_surprise })} label="Keep it a surprise" description={`Hidden from ${partner?.display_name || 'your partner'} until you reveal it`} />
              {v.is_surprise && (
                <Field label="Reveal automatically on" hint="Optional — or reveal it yourself from the dream’s page">
                  <input type="date" className="input" value={v.reveal_date || ''} onChange={(e) => set({ reveal_date: e.target.value })} />
                </Field>
              )}
            </div>
          </Disclosure>

          <Disclosure title={existing ? 'Notes & tags' : 'Notes, tags, photos & checklist'} icon={SlidersHorizontal} defaultOpen={has('tags', 'notes')}>
            <div className="space-y-5">
              <Field label="Notes"><textarea className="input min-h-[80px] resize-none" maxLength={5000} placeholder="Ideas, details, things to remember" value={v.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
              <div><span className="label">Tags</span><TagInput value={v.tags} onChange={(tags) => set({ tags })} /></div>
              {!existing && (
                <>
                  <div>
                    <span className="label">Photos <span className="muted font-normal">· the first becomes the cover</span></span>
                    <div className="flex flex-wrap gap-2">
                      {previews.map((u, k) => (
                        <div key={u} className="relative h-[72px] w-[72px] overflow-hidden rounded-xl">
                          <img src={u} alt="" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== k))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white" aria-label="Remove photo"><X size={12} /></button>
                        </div>
                      ))}
                      <label className="grid h-[72px] w-[72px] cursor-pointer place-items-center rounded-xl border border-dashed border-ink-500/30 text-ink-500 transition hover:bg-cream-100 dark:hover:bg-white/5">
                        <ImagePlus size={20} strokeWidth={1.5} />
                        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { setFiles([...files, ...e.target.files]); e.target.value = ''; }} aria-label="Add photos" />
                      </label>
                    </div>
                  </div>
                  <div>
                    <span className="label">Preparation checklist</span>
                    {subtasks.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {subtasks.map((s, k) => (
                          <li key={k} className="flex min-h-[40px] items-center gap-3 text-[15px]">
                            <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-ink-500/40" />
                            <span className="flex-1">{s}</span>
                            <button type="button" className="muted" onClick={() => setSubtasks(subtasks.filter((_, j) => j !== k))} aria-label="Remove"><X size={15} /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <input className="input py-2" placeholder="Book flights, save money…" value={subText} onChange={(e) => setSubText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} aria-label="New checklist step" />
                      <button type="button" className="btn-soft min-h-[42px] px-3" onClick={addSub} aria-label="Add subtask"><Plus size={18} strokeWidth={1.75} /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Disclosure>
        </section>

        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : existing ? 'Save changes' : 'Add to our list'}</button>
      </div>
    </form>
  );
}
