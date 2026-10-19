// Gift / gear ideas. Hidden gifts stay invisible to the partner until their reveal date
// (enforced by RLS in Supabase and by visibility.js in Demo Mode).
import { useState } from 'react';
import { Check, EyeOff, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
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
    <Modal open={open} onClose={onClose} title={initial ? 'Edit gift idea' : 'New gift idea'}
      footer={<><button className="btn-ghost flex-1" onClick={onClose}>Cancel</button><button className="btn-dark flex-1" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button></>}>
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
        <Toggle checked={v.is_hidden} onChange={(is_hidden) => set({ is_hidden })} label="Hide from partner" description="They won't see it until the reveal date" />
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
    <li className={cn('flex items-start gap-3 py-3', g.is_gifted && 'opacity-60')}>
      <button onClick={() => updateGift(g.id, { is_gifted: !g.is_gifted, gifted_at: g.is_gifted ? null : new Date().toISOString() })}
        className={cn('mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition', g.is_gifted ? 'border-ink-500 bg-ink-500 text-white' : 'border-ink-500/40')}
        aria-label={g.is_gifted ? 'Mark as not gifted' : 'Mark as gifted'}>{g.is_gifted && <Check size={12} strokeWidth={2.5} />}</button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-[15px] font-medium', g.is_gifted && 'line-through')}>{g.name}</span>
          {g.price ? <span className="muted text-[14px]">{fmtMoney(g.price, g.currency)}</span> : null}
        </div>
        <p className="muted text-[13px]">
          For {personLabel(g.for_user_id, { both: 'either of us' })} · from {personLabel(g.created_by)}{item ? ` · ${item.title}` : ''}
          {stillHidden && mine && <span className="ml-1 inline-flex items-center gap-1"> · <EyeOff size={11} strokeWidth={1.75} /> hidden, reveals {countdownLabel(g.reveal_date)}</span>}
          {g.reveal_date && !stillHidden && g.is_hidden ? ` · revealed ${fmtDate(g.reveal_date, 'd MMM')}` : ''}
          {g.is_gifted ? ' · gifted' : ''}
        </p>
        {g.notes && <p className="mt-1 text-[14px] text-ink-700 dark:text-[#D4CFD5]">{g.notes}</p>}
        {g.url && <a href={g.url} target="_blank" rel="noreferrer noopener" className="btn-link mt-1 text-[13px]"><ExternalLink size={12} strokeWidth={1.75} /> View link</a>}
      </div>
      {mine && <button className="icon-btn h-9 w-9" onClick={() => setEdit(true)} aria-label="Edit gift"><Pencil size={15} strokeWidth={1.6} /></button>}
      <button className="icon-btn h-9 w-9" onClick={() => setDel(true)} aria-label="Delete gift"><Trash2 size={15} strokeWidth={1.6} /></button>
      {edit && <GiftForm open initial={g} itemId={g.item_id} onClose={() => setEdit(false)} />}
      <ConfirmDialog open={del} title="Remove this gift idea?" danger confirmLabel="Remove" onClose={() => setDel(false)} onConfirm={() => deleteGift(g.id)} />
    </li>
  );
}

/** Wishlist block on an item's detail page (`bare` = inside an expandable section). */
export default function ItemWishlist({ itemId, bare }) {
  const { data } = useApp();
  const [adding, setAdding] = useState(false);
  const gifts = data.wishlist_entries.filter((g) => g.item_id === itemId);
  return (
    <div>
      {!bare && <h2 className="section-title mb-2">Gift & gear ideas</h2>}
      {gifts.length ? <ul className="hairline -mt-3">{gifts.map((g) => <GiftRow key={g.id} g={g} />)}</ul>
        : <p className="muted text-[14px]">Things you’ll need, or want to gift each other for this. Hide them to keep a surprise.</p>}
      <button className="btn-link mt-3" onClick={() => setAdding(true)}><Plus size={15} strokeWidth={1.75} /> Add an idea</button>
      {adding && <GiftForm open itemId={itemId} onClose={() => setAdding(false)} />}
    </div>
  );
}
