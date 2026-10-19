// Memory journal / timeline: completed items, manual entries and milestone dates, newest first.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { yearInReview } from '../lib/stats.js';
import { validateJournal, toNum } from '../lib/validation.js';
import { CATEGORIES, CATEGORY_META, IMPORTANT_DATE_COLOR } from '../lib/constants.js';
import { cn, fmtDate, fmtMoney, todayISO } from '../lib/utils.js';
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, Segmented, Spinner, Stars, StoredImage } from '../components/ui.jsx';
import PhotoAlbum, { Lightbox } from '../components/PhotoAlbum.jsx';
import TagInput from '../components/TagInput.jsx';

export default function TimelinePage() {
  const { data, me, partner, workspace, items } = useApp();
  const [year, setYear] = useState('all');
  const [cat, setCat] = useState('all');
  const [person, setPerson] = useState('any');
  const [editing, setEditing] = useState(null); // null | 'new' | entry
  const [viewer, setViewer] = useState(null);

  // Unified entries: journal (auto + manual) + milestone dates.
  const entries = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]));
    const out = data.journal_entries
      .filter((j) => !j.item_id || itemById.has(j.item_id))
      .map((j) => {
        const it = j.item_id ? itemById.get(j.item_id) : null;
        return { ...j, kind: j.item_id ? 'item' : 'manual', person: it ? (it.owner_user_id ?? 'both') : j.created_by, photos: photosFor(data.item_photos, j) };
      });
    for (const d of data.important_dates) {
      if (d.date <= todayISO() && ['together_since', 'first_date', 'anniversary'].includes(d.kind))
        out.push({ id: `date-${d.id}`, kind: 'milestone', title: d.title, entry_date: d.date, category: null, photoPath: d.photo_path, person: 'both', photos: [] });
    }
    return out.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }, [data, items]);

  const years = [...new Set(entries.map((e) => e.entry_date.slice(0, 4)))].sort().reverse();
  const filtered = entries.filter((e) =>
    (year === 'all' || e.entry_date.startsWith(year)) &&
    (cat === 'all' || e.category === cat) &&
    (person === 'any' || e.person === 'both' || e.person === (person === 'me' ? me.id : partner?.id)));
  const yir = useMemo(() => yearInReview({ ...data, items }, year === 'all' ? new Date().getFullYear() : Number(year)), [data, items, year]);

  // Group by year for headings.
  const groups = filtered.reduce((m, e) => { const y = e.entry_date.slice(0, 4); (m[y] ||= []).push(e); return m; }, {});

  return (
    <div>
      <PageHeader title="Timeline" subtitle="Our story, in order" back actions={<button className="icon-btn" onClick={() => setEditing('new')} aria-label="Write a memory"><Plus size={22} strokeWidth={1.6} /></button>} />
      <div className="space-y-6 px-5 pb-10">
        {/* Year in review */}
        <section className="list-group px-5 py-5">
          <p className="section-title">Year in review</p>
          <h2 className="title-serif mt-1 text-[36px] leading-none">{yir.year}</h2>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {[[yir.completed, 'Dreams completed'], [yir.photos, 'Photos added'], [yir.places, 'Places visited'], [fmtMoney(yir.spent, workspace.currency) || '0', 'Spent on memories']].map(([v, l]) => (
              <div key={l}><dd className="title-serif truncate text-[26px] leading-none">{v}</dd><dt className="muted mt-1 text-[13px]">{l}</dt></div>
            ))}
          </dl>
          {(yir.topCategory || yir.avgRating || yir.journalEntries > 0) && (
            <p className="muted mt-4 border-t border-line pt-3 text-[13px] dark:border-line-dark">
              {yir.topCategory && <>Favourite kind of adventure: <span className="text-ink-800 dark:text-cream-100">{yir.topCategory}</span>. </>}
              {yir.avgRating && <>Would do again: <span className="text-ink-800 dark:text-cream-100">{yir.avgRating.toFixed(1)} of 5</span>. </>}
              {yir.journalEntries ? <>{yir.journalEntries} journal entr{yir.journalEntries === 1 ? 'y' : 'ies'}.</> : null}
            </p>
          )}
        </section>

        {/* Filters */}
        <div className="space-y-3">
          <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
            {['all', ...years].map((y) => <button key={y} className="chip-toggle shrink-0" aria-pressed={year === y} onClick={() => setYear(y)}>{y === 'all' ? 'All years' : y}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input py-2 text-[14px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input py-2 text-[14px]" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
              <option value="any">Both of us</option>
              <option value="me">Me</option>
              {partner && <option value="partner">{partner.display_name}</option>}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={BookOpen} title="Your story starts here" body="Complete a dream, or write about a moment — like your first road trip."
            action={<button className="btn-dark" onClick={() => setEditing('new')}>Write a memory</button>} />
        ) : Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([y, list]) => (
          <section key={y}>
            <h2 className="title-serif mb-3 text-[28px]">{y}</h2>
            <ol className="relative ml-1.5 border-l border-line dark:border-line-dark">
              {list.map((e) => <Entry key={e.id} e={e} onEdit={() => setEditing(e)} onPhoto={(k) => setViewer({ photos: e.photos, index: k })} />)}
            </ol>
          </section>
        ))}
      </div>

      {editing && <JournalForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {viewer && <Lightbox photos={viewer.photos} index={viewer.index} onIndex={(index) => setViewer({ ...viewer, index })} onClose={() => setViewer(null)} />}
    </div>
  );
}

const photosFor = (photos, j) => photos.filter((p) => (j.item_id ? p.item_id === j.item_id : p.journal_entry_id === j.id)).sort((a, b) => a.position - b.position);

function Entry({ e, onEdit, onPhoto }) {
  const meta = e.category ? CATEGORY_META[e.category] : null;
  const dot = e.kind === 'milestone' ? IMPORTANT_DATE_COLOR : meta?.color || '#C65D70';
  const kindLabel = e.kind === 'milestone' ? 'Milestone' : e.kind === 'manual' ? 'Journal' : e.category;
  return (
    <li className="relative mb-7 ml-5 animate-fade-up">
      <span className="absolute -left-[24.5px] top-[7px] h-2 w-2 rounded-full ring-4 ring-cream-50 dark:ring-ink-950" style={{ background: dot }} />
      <p className="muted text-[13px]">{fmtDate(e.entry_date, 'd MMMM')}{kindLabel ? ` · ${kindLabel}` : ''}</p>
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {e.kind === 'item' ? <Link to={`/item/${e.item_id}`} className="text-[17px] font-medium hover:underline">{e.title}</Link> : <h3 className="text-[17px] font-medium">{e.title}</h3>}
        </div>
        {e.kind === 'manual' && <button className="icon-btn -mt-1.5 h-9 w-9" onClick={onEdit} aria-label="Edit entry"><Pencil size={15} strokeWidth={1.6} /></button>}
      </div>
      {e.note && <p className="title-serif mt-1.5 whitespace-pre-wrap text-[19px] italic leading-snug text-ink-700 dark:text-[#D4CFD5]">“{e.note}”</p>}
      {e.photos.length > 0 && (
        <div className={cn('mt-3 grid gap-1 overflow-hidden rounded-xl', e.photos.length === 1 ? 'grid-cols-1' : e.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {e.photos.slice(0, 3).map((p, k) => (
            <button key={p.id} onClick={() => onPhoto(k)} className="relative aspect-[4/3] overflow-hidden">
              <StoredImage path={p.storage_path} alt={p.caption || ''} className="h-full w-full" />
              {k === 2 && e.photos.length > 3 && <span className="absolute inset-0 grid place-items-center bg-black/40 text-[15px] font-medium text-white">+{e.photos.length - 3}</span>}
            </button>
          ))}
        </div>
      )}
      {e.photoPath && <StoredImage path={e.photoPath} className="mt-3 h-36 w-full rounded-xl" />}
      {(e.rating || e.location_name || e.tags?.length > 0) && (
        <div className="muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          {e.rating ? <Stars value={e.rating} readOnly size={12} /> : null}
          {e.location_name && <span className="flex items-center gap-1"><MapPin size={12} strokeWidth={1.6} />{e.location_name}</span>}
          {e.tags?.map((t) => <span key={t}>{t}</span>)}
        </div>
      )}
    </li>
  );
}

/** Create / edit a manual journal entry (with its own photo album when editing). */
function JournalForm({ entry, onClose }) {
  const { addJournal, updateJournal, deleteJournal } = useApp();
  const [v, setV] = useState(entry ? { ...entry } : { title: '', entry_date: todayISO(), note: '', rating: 0, category: '', location_name: '', tags: [] });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (p) => setV((x) => ({ ...x, ...p }));

  async function save() {
    const e = validateJournal(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const row = { title: v.title.trim(), entry_date: v.entry_date, note: v.note?.trim() || null, rating: toNum(v.rating) || null, category: v.category || null, location_name: v.location_name?.trim() || null, tags: v.tags || [] };
    const r = entry ? await updateJournal(entry.id, row) : await addJournal(row, files);
    setBusy(false);
    if (r) onClose();
  }

  return (
    <Modal open onClose={onClose} title={entry ? 'Edit memory' : 'New memory'} wide
      footer={<>
        {entry && <button className="icon-btn h-11 w-11 text-rose-700 dark:text-rose-300" onClick={() => setConfirm(true)} aria-label="Delete entry"><Trash2 size={17} strokeWidth={1.6} /></button>}
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-dark flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <Field label="Title" error={errors.title}><input className="input" maxLength={140} placeholder="Our first road trip" value={v.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Date" error={errors.entry_date}><input type="date" className="input" value={v.entry_date} onChange={(e) => set({ entry_date: e.target.value })} /></Field>
        <Field label="What happened"><textarea className="input min-h-[110px]" value={v.note || ''} onChange={(e) => set({ note: e.target.value })} /></Field>
        <div><span className="label">Rating</span><Stars value={v.rating} onChange={(rating) => set({ rating })} size={22} /></div>
        <div><span className="label">Category</span><Segmented value={v.category || ''} onChange={(category) => set({ category })} options={[{ value: '', label: 'None' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} /></div>
        <Field label="Location"><input className="input" value={v.location_name || ''} onChange={(e) => set({ location_name: e.target.value })} /></Field>
        <div><span className="label">Tags</span><TagInput value={v.tags || []} onChange={(tags) => set({ tags })} /></div>
        {entry ? <PhotoAlbum target={{ journal_entry_id: entry.id }} canSetCover={false} title="Photos" /> : (
          <Field label="Photos">
            <input type="file" accept="image/*" multiple className="input" onChange={(e) => setFiles([...e.target.files])} />
            {files.length > 0 && <span className="muted text-[13px]">{files.length} selected</span>}
          </Field>
        )}
      </div>
      <ConfirmDialog open={confirm} title="Delete this memory?" message="Its photos will be deleted too." danger confirmLabel="Delete"
        onClose={() => setConfirm(false)} onConfirm={async () => { await deleteJournal(entry.id); onClose(); }} />
    </Modal>
  );
}
