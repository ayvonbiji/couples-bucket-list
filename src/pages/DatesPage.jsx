// Important dates: birthdays, anniversaries, together-since… with countdowns and reminders.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CalendarHeart, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { nextOccurrence, occurrenceTitle, yearsAt } from '../lib/recurrence.js';
import { validateDate } from '../lib/validation.js';
import { DATE_KINDS } from '../lib/constants.js';
import { countdownLabel, fmtDate, sortBy } from '../lib/utils.js';
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, Segmented, Spinner, StoredImage, Toggle } from '../components/ui.jsx';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { DateKindIcon } from '../components/icons.jsx';

export default function DatesPage() {
  const { data } = useApp();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (params.get('new')) { setEditing({ date: params.get('date') || '' }); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const list = useMemo(() => sortBy(data.important_dates.map((d) => {
    const occ = nextOccurrence(d);
    const days = occ ? differenceInCalendarDays(occ, startOfDay(new Date())) : null;
    return { ...d, occ, days, years: yearsAt(d, occ) };
  }), (d) => (d.days !== null && d.days >= 0 ? d.days : 100000 + Math.abs(d.days ?? 0))), [data.important_dates]);

  return (
    <div>
      <PageHeader title="Important dates" subtitle="The days that are yours" back actions={<button className="icon-btn" onClick={() => setEditing({})} aria-label="Add a date"><Plus size={22} strokeWidth={1.6} /></button>} />
      <div className="px-5 pb-8">
        {list.length === 0 ? (
          <EmptyState icon={CalendarHeart} title="No dates yet" body="Add your anniversary, birthdays, the day you met." action={<button className="btn-dark" onClick={() => setEditing({})}>Add a date</button>} />
        ) : <ul className="list-group hairline">{list.map((d) => <DateRow key={d.id} d={d} onEdit={() => setEditing(d)} />)}</ul>}
      </div>
      {editing && <DateForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DateRow({ d, onEdit }) {
  const kind = DATE_KINDS[d.kind] || DATE_KINDS.other;
  const past = d.days !== null && d.days < 0;
  const sinceLabel = d.kind === 'together_since' || d.kind === 'first_date';
  const totalDays = differenceInCalendarDays(new Date(), new Date(d.date));
  return (
    <li>
      <button className="list-row" onClick={onEdit} aria-label={`Edit ${d.title}`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-50 text-rose-500 dark:bg-white/5">
          <StoredImage path={d.photo_path} className="h-full w-full" fallback={<DateKindIcon kind={d.kind} size={18} />} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{occurrenceTitle(d, d.years)}</span>
          <span className="muted block text-[13px]">
            {past ? countdownLabel(d.date) : d.occ && fmtDate(d.occ, 'EEEE, d MMMM')}
            {' · '}{kind.label}{d.repeats_yearly ? ', yearly' : ''}
          </span>
          {(sinceLabel && totalDays > 0) || (d.reminder_offset_days > 0 && !past) ? (
            <span className="muted mt-0.5 flex items-center gap-1 text-[12px]">
              {sinceLabel && totalDays > 0 && <>{totalDays.toLocaleString()} days together</>}
              {sinceLabel && totalDays > 0 && d.reminder_offset_days > 0 && !past && ' · '}
              {d.reminder_offset_days > 0 && !past && <><Bell size={11} strokeWidth={1.75} /> {d.reminder_offset_days}d before</>}
            </span>
          ) : null}
        </span>
        {!past && d.days !== null && (
          <span className="text-right">
            <span className="title-serif block text-[26px] leading-none">{d.days === 0 ? 'Today' : d.days}</span>
            {d.days > 0 && <span className="muted text-[11px]">{d.days === 1 ? 'day' : 'days'}</span>}
          </span>
        )}
      </button>
    </li>
  );
}

function DateForm({ initial, onClose }) {
  const { addDate, updateDate, deleteDate, uploadSingle } = useApp();
  const editing = Boolean(initial.id);
  const [v, setV] = useState({ title: '', date: '', kind: 'anniversary', repeats_yearly: true, reminder_offset_days: 7, photo_path: null, notes: '', ...initial });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (p) => setV((x) => ({ ...x, ...p }));

  async function save() {
    const e = validateDate(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const row = { title: v.title.trim(), date: v.date, kind: v.kind, repeats_yearly: v.repeats_yearly, reminder_offset_days: Number(v.reminder_offset_days), photo_path: v.photo_path || null, notes: v.notes?.trim() || null };
    const r = editing ? await updateDate(v.id, row) : await addDate(row);
    setBusy(false);
    if (r) onClose();
  }

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit date' : 'New important date'}
      footer={<>
        {editing && <button className="icon-btn h-11 w-11 text-rose-700 dark:text-rose-300" onClick={() => setConfirm(true)} aria-label="Delete date"><Trash2 size={17} strokeWidth={1.6} /></button>}
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-dark flex-1" onClick={save} disabled={busy || uploading}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <div><span className="label">Type</span>
          <Segmented value={v.kind} onChange={(kind) => set({ kind, ...(v.title ? {} : { title: kind === 'other' ? '' : DATE_KINDS[kind].label }) })}
            options={Object.entries(DATE_KINDS).map(([k, m]) => ({ value: k, label: m.label }))} />
        </div>
        <Field label="Title" error={errors.title}><input className="input" maxLength={100} placeholder="Her birthday, our wedding…" value={v.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Date" error={errors.date} hint="For anniversaries, use the original date — we'll count the years"><input type="date" className="input" value={v.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Toggle checked={v.repeats_yearly} onChange={(repeats_yearly) => set({ repeats_yearly })} label="Repeats every year" />
        <Field label="Remind us" error={errors.reminder_offset_days}>
          <select className="input" value={v.reminder_offset_days} onChange={(e) => set({ reminder_offset_days: Number(e.target.value) })}>
            {[0, 1, 3, 7, 14, 30].map((n) => <option key={n} value={n}>{n === 0 ? 'On the day' : `${n} day${n > 1 ? 's' : ''} before`}</option>)}
          </select>
        </Field>
        <div>
          <span className="label">Photo</span>
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-rose-50 text-rose-500 dark:bg-white/5">
              <StoredImage path={v.photo_path} className="h-full w-full" fallback={<DateKindIcon kind={v.kind} size={22} />} />
            </div>
            <label className="btn-soft cursor-pointer">
              {uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus size={16} strokeWidth={1.6} />} {v.photo_path ? 'Change' : 'Add photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files[0]; e.target.value = '';
                if (!f) return;
                setUploading(true);
                const path = await uploadSingle(f);
                setUploading(false);
                if (path) set({ photo_path: path });
              }} />
            </label>
            {v.photo_path && <button className="btn-link text-[13px]" onClick={() => set({ photo_path: null })}>Remove</button>}
          </div>
        </div>
        <Field label="Notes"><textarea className="input" rows={2} value={v.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
      <ConfirmDialog open={confirm} title="Delete this date?" danger confirmLabel="Delete" onClose={() => setConfirm(false)} onConfirm={async () => { await deleteDate(v.id); onClose(); }} />
    </Modal>
  );
}

