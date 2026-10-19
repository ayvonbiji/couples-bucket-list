// Gift / gear ideas. Hidden gifts stay invisible to the partner until their reveal date
// (enforced by RLS in Supabase and by visibility.js in Demo Mode).
import { useState } from 'react';
import { Check, EyeOff, ExternalLink, Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { validateGift, toNum } from '../lib/validation.js';
import { CURRENCIES } from '../lib/constants.js';
import { cn, countdownLabel, fmtDate, fmtMoney, todayISO } from '../lib/utils.js';
import { ConfirmDialog, Field, Modal, Segmented, Spinner, Toggle } from './ui.jsx';

export function GiftForm({ open, onClose, itemId = null, initial }) {
  const { me, partner, workspace, data, addGift, updateGift } = useApp();
  const [v, setV] = useState(() => initial || {
    name: '', url: '', price: '', currency: workspace.currency, notes: '', is_hidden: false, reveal_date: '',
    for_user_id: partner?.id || me.id, item_id: itemId,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setV((x) => ({ ...x, ...p }));
  const openItems = data.items.filter((i) => !i.is_deleted);

  async function save() {
    const e = validateGift(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const row = { name: v.name.trim(), url: v.url?.trim() || null, price: toNum(v.price), currency: v.currency, notes: v.notes?.trim() || null,
      is_hidden: v.is_hidden, reveal_date: v.is_hidden ? v.reveal_date : null, for_user_id: v.for_user_id || null, item_id: v.item_id || null };
    const r = initial ? await updateGift(initial.id, row) : await addGift(row);
    setBusy(false);
    if (r) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit gift idea' : 'New gift idea 🎁'}
      footer={<><button className="btn-ghost flex-1" onClick={onClose}>Cancel</button><button className="btn-primary flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button></>}>
      <div className="space-y-4">
        <Field label="Gift *" error={errors.name}><input className="input" maxLength={140} placeholder="Hiking boots for the trek" value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Link" error={errors.url}><input className="input" type="url" inputMode="url" placeholder="https://…" value={v.url || ''} onChange={(e) => set({ url: e.target.value })} /></Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Price" error={errors.price}><input className="input" type="number" min="0" inputMode="decimal" value={v.price ?? ''} onChange={(e) => set({ price: e.target.value })} /></Field>
          <Field label="Currency"><select className="input" value={v.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <div>
          <span className="label">For</span>
          <Segmented value={v.for_user_id} onChange={(for_user_id) => set({ for_user_id })}
            options={[...(partner ? [{ value: partner.id, label: partner.display_name || 'Partner' }] : []), { value: me.id, label: 'Me (a hint)' }]} />
        </div>
        {!itemId && (
          <Field label="Linked bucket-list item (optional)">
            <select className="input" value={v.item_id || ''} onChange={(e) => set({ item_id: e.target.value || null })}>
              <option value="">— none —</option>
              {openItems.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes"><textarea className="input" rows={2} value={v.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <Toggle checked={v.is_hidden} onChange={(is_hidden) => set({ is_hidden })} label="🤫 Hide from partner" description="They won't see it until the reveal date" />
        {v.is_hidden && (
          <Field label="Reveal on" error={errors.reveal_date} hint="e.g. their birthday or your anniversary">
            <input type="date" className="input" min={todayISO()} value={v.reveal_date || ''} onChange={(e) => set({ reveal_date: e.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function GiftRow({ g, showItem }) {
  const { me, data, personLabel, updateGift, deleteGift } = useApp();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const mine = g.created_by === me.id;
  const stillHidden = g.is_hidden && g.reveal_date && g.reveal_date > todayISO();
  const item = showItem && g.item_id ? data.items.find((i) => i.id === g.item_id) : null;
  return (
    <li className={cn('flex items-start gap-3 rounded-xl bg-white p-3 dark:bg-ink-800', g.is_gifted && 'opacity-60')}>
      <button onClick={() => updateGift(g.id, { is_gifted: !g.is_gifted, gifted_at: g.is_gifted ? null : new Date().toISOString() })}
        className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2', g.is_gifted ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink-700/30')}
        aria-label={g.is_gifted ? 'Mark as not gifted' : 'Mark as gifted'}>{g.is_gifted && <Check size={14} strokeWidth={3} />}</button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('font-bold', g.is_gifted && 'line-through')}>{g.name}</span>
          {g.price ? <span className="muted text-sm">{fmtMoney(g.price, g.currency)}</span> : null}
          {stillHidden && mine && <span className="chip bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"><EyeOff size={11} /> Hidden · reveals {countdownLabel(g.reveal_date)}</span>}
          {g.is_gifted && <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Gifted</span>}
        </div>
        <p className="muted text-xs">For {personLabel(g.for_user_id, { both: 'either of us' })} · from {personLabel(g.created_by)}{item ? ` · for “${item.title}”` : ''}{g.reveal_date && !stillHidden && g.is_hidden ? ` · revealed ${fmtDate(g.reveal_date, 'd MMM')}` : ''}</p>
        {g.notes && <p className="mt-1 text-sm">{g.notes}</p>}
        {g.url && <a href={g.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-rose-600"><ExternalLink size={13} /> View link</a>}
      </div>
      {mine && <button className="icon-btn h-8 w-8" onClick={() => setEdit(true)} aria-label="Edit gift"><Pencil size={15} /></button>}
      <button className="icon-btn h-8 w-8" onClick={() => setDel(true)} aria-label="Delete gift"><Trash2 size={15} /></button>
      {edit && <GiftForm open initial={g} itemId={g.item_id} onClose={() => setEdit(false)} />}
      <ConfirmDialog open={del} title="Remove this gift idea?" danger confirmLabel="Remove" onClose={() => setDel(false)} onConfirm={() => deleteGift(g.id)} />
    </li>
  );
}

/** Wishlist block on an item's detail page. */
export default function ItemWishlist({ itemId }) {
  const { data } = useApp();
  const [adding, setAdding] = useState(false);
  const gifts = data.wishlist_entries.filter((g) => g.item_id === itemId);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2"><Gift size={18} className="text-rose-600" /> Gift & gear ideas</h2>
        <button className="btn-soft px-3 py-1.5" onClick={() => setAdding(true)}><Plus size={15} /> Add</button>
      </div>
      {gifts.length ? <ul className="space-y-2">{gifts.map((g) => <GiftRow key={g.id} g={g} />)}</ul>
        : <p className="muted text-sm">Things you'll need or want to gift each other for this — hide them for a surprise.</p>}
      {adding && <GiftForm open itemId={itemId} onClose={() => setAdding(false)} />}
    </section>
  );
}
