// Item detail: everything about one dream — votes, reactions, planning tools, album, gifts, memory, comments.
import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, Check, Eye, EyeOff, ExternalLink, Link2, MapPin, Pencil, Plus, RotateCcw, Send, Trash2, Wallet, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { voteSummary } from '../lib/scoring.js';
import { surpriseIsActive } from '../lib/visibility.js';
import { validateLink } from '../lib/validation.js';
import { CATEGORY_META, PRIORITY_META, STATUSES } from '../lib/constants.js';
import { cn, countdownLabel, fmtDate, fmtMoney, timeAgo } from '../lib/utils.js';
import { Avatar, EmptyState, MutualBadge, PageHeader, ProgressBar, Segmented, Stars, StoredImage } from '../components/ui.jsx';
import { CategoryDot, StatusPill } from '../components/ItemViews.jsx';
import PhotoAlbum from '../components/PhotoAlbum.jsx';
import ItemWishlist from '../components/Wishlist.jsx';
import CompleteDialog from '../components/CompleteDialog.jsx';
import DeleteItemDialog from '../components/DeleteItemDialog.jsx';

const MiniMap = lazy(() => import('../components/MapBits.jsx').then((m) => ({ default: m.MiniMap })));

export default function ItemDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const app = useApp();
  const { data, me, partner, personLabel, updateItem, vote, toggleReaction, revealSurprise, reopenItem } = app;
  const item = data.items.find((i) => i.id === id);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const votes = useMemo(() => voteSummary(data.item_votes.filter((v) => v.item_id === id), me.id, partner?.id), [data.item_votes, id, me.id, partner?.id]);
  const photos = useMemo(() => data.item_photos.filter((p) => p.item_id === id).sort((a, b) => a.position - b.position), [data.item_photos, id]);

  if (!item) return <><PageHeader title="" back="/list" /><EmptyState emoji="🫥" title="This item isn't here" body="It may have been deleted, or it's a surprise that isn't for your eyes yet 😉" /></>;

  const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;
  const cover = photos.find((p) => p.id === item.cover_photo_id) || photos[0];
  const reactions = data.item_reactions.filter((r) => r.item_id === id);
  const deleted = item.is_deleted;

  const setStatus = (status) => {
    if (status === item.status) return;
    if (status === 'Completed') return setCompleting(true);
    if (item.status === 'Completed') return reopenItem(item.id).then(() => status !== 'In Progress' && updateItem(item.id, { status }));
    updateItem(item.id, { status });
  };

  return (
    <div className="pb-10">
      {/* Hero */}
      <div className="relative h-64 overflow-hidden sm:rounded-b-3xl" style={{ background: `linear-gradient(135deg, ${meta.color}55, ${meta.color}15)` }}>
        <StoredImage path={cover?.storage_path} className="h-full w-full" fallback={<div className="grid h-full place-items-center text-7xl">{meta.emoji}</div>} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <button className="icon-btn bg-black/30 text-white backdrop-blur hover:bg-black/40" onClick={() => nav(-1)} aria-label="Back"><X size={20} /></button>
          {!deleted && <div className="flex gap-2">
            <button className="icon-btn bg-black/30 text-white backdrop-blur hover:bg-black/40" onClick={() => nav(`/item/${id}/edit`)} aria-label="Edit"><Pencil size={18} /></button>
            <button className="icon-btn bg-black/30 text-white backdrop-blur hover:bg-black/40" onClick={() => setDeleting([id])} aria-label="Delete"><Trash2 size={18} /></button>
          </div>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <StatusPill status={item.status} />
            {votes.mutual && <MutualBadge small />}
            {surpriseIsActive(item) && <span className="chip bg-violet-600 text-white"><EyeOff size={12} /> Surprise</span>}
          </div>
          <h1 className="text-3xl font-bold leading-tight drop-shadow">{item.title}</h1>
        </div>
      </div>

      <div className="space-y-6 px-4 pt-4">
        {deleted && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100">This item is in Trash. <button className="font-bold underline" onClick={() => nav('/trash')}>Open Trash</button> to restore it.</div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CategoryDot category={item.category} />
          <span className={cn('chip bg-black/[.04] dark:bg-white/10', PRIORITY_META[item.priority].cls)}>{PRIORITY_META[item.priority].emoji} {item.priority}</span>
          <span className="muted">Added by <b>{item.added_by_both ? 'Both' : personLabel(item.created_by)}</b> · Owner <b>{personLabel(item.owner_user_id)}</b></span>
        </div>

        {surpriseIsActive(item) && item.created_by === me.id && (
          <div className="flex items-center gap-3 rounded-2xl bg-violet-50 p-3 text-sm text-violet-950 dark:bg-violet-950/50 dark:text-violet-100">
            <EyeOff size={20} />
            <span className="flex-1">Hidden from {partner?.display_name || 'your partner'}{item.reveal_date ? ` until ${fmtDate(item.reveal_date)}` : ''}.</span>
            <button className="btn bg-violet-600 px-3 py-1.5 text-white" onClick={() => revealSurprise(item.id)}><Eye size={15} /> Reveal now</button>
          </div>
        )}

        {item.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.description}</p>}

        {/* Status stepper */}
        {!deleted && (
          <section>
            <span className="label">Status</span>
            <Segmented value={item.status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: s === 'Completed' ? '✓ Completed' : s }))} />
            {item.status !== 'Completed' && <button className="btn-primary mt-3 w-full" onClick={() => setCompleting(true)}><Check size={18} /> Mark complete</button>}
          </section>
        )}

        {/* Votes & reactions */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">How much do we want this?</h2>
            <span className="font-display text-xl font-bold text-rose-600" title="Mutual score">{votes.score}<span className="muted text-xs">/100</span></span>
          </div>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold"><Avatar user={me} size={24} /> My vote</span>
              <Stars value={votes.mine} onChange={(n) => vote(item.id, n)} label="My vote" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold"><Avatar user={partner} size={24} /> {partner?.display_name || 'Partner'}</span>
              {votes.theirs !== null ? <Stars value={votes.theirs} readOnly label={`${partner?.display_name || 'Partner'}'s vote`} /> : <span className="muted text-sm">hasn't voted yet</span>}
            </div>
          </div>
          {votes.mutual && <p className="mt-3 text-center text-sm font-bold text-rose-600">💞 You both rated this 4★ or more!</p>}
          <div className="mt-4 flex gap-2 border-t border-rose-100 pt-3 dark:border-white/10">
            {[['heart', '❤️'], ['thumbs', '👍']].map(([k, e]) => {
              const rs = reactions.filter((r) => r.emoji === k);
              const mine = rs.some((r) => r.user_id === me.id);
              return (
                <button key={k} onClick={() => toggleReaction(item.id, k)} aria-pressed={mine}
                  className={cn('chip-toggle px-3 py-1.5 text-sm', mine && 'animate-heartbeat')} title={rs.map((r) => personLabel(r.user_id)).join(', ')}>
                  <span aria-hidden>{e}</span> {rs.length || ''}
                </button>
              );
            })}
          </div>
        </section>

        {/* Details */}
        <section className="card divide-y divide-rose-100 dark:divide-white/5">
          {(item.start_date || item.timeframe) && (
            <Row icon={Calendar} label="When">
              {item.start_date ? <>{fmtDate(item.start_date)}{item.end_date && item.end_date !== item.start_date ? ` → ${fmtDate(item.end_date)}` : ''} {item.status !== 'Completed' && <span className="chip ml-1 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200">{countdownLabel(item.start_date)}</span>}</> : null}
              {item.timeframe && <div className="muted text-sm">{item.timeframe}</div>}
            </Row>
          )}
          {item.location_name && <Row icon={MapPin} label="Where">{item.location_name}</Row>}
          {item.est_cost ? <Row icon={Wallet} label="Estimated cost">{fmtMoney(item.est_cost, item.currency)}</Row> : null}
          {item.reminder_at && <Row icon={Calendar} label="Reminder">{fmtDate(item.reminder_at, 'd MMM yyyy, HH:mm')} {item.reminder_done && '✓'}</Row>}
          {item.tags?.length > 0 && <div className="flex flex-wrap gap-1.5 p-3">{item.tags.map((t) => <span key={t} className="chip bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200">#{t}</span>)}</div>}
        </section>
        {item.lat !== null && item.lat !== undefined && (
          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-rose-100 dark:bg-white/5" />}><MiniMap lat={item.lat} lng={item.lng} emoji={meta.emoji} /></Suspense>
        )}

        {/* Savings */}
        {item.savings_target ? <Savings item={item} /> : null}

        {/* Memory */}
        {item.status === 'Completed' && (
          <section className="card bg-gradient-to-br from-amber-50 to-rose-50 p-4 dark:from-amber-950/30 dark:to-rose-950/30">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Our memory 📖</h2>
              {!deleted && <button className="muted flex items-center gap-1 text-xs font-bold" onClick={() => reopenItem(item.id)}><RotateCcw size={13} /> Reopen</button>}
            </div>
            <p className="muted mt-1 text-sm">Completed {fmtDate(item.completed_at)}{item.actual_cost ? ` · spent ${fmtMoney(item.actual_cost, item.currency)}` : ''}</p>
            {item.completion_note && <p className="mt-3 font-display text-lg italic leading-relaxed">“{item.completion_note}”</p>}
            {item.would_do_again && <div className="mt-3 flex items-center gap-2 text-sm font-semibold">Would do again <Stars value={item.would_do_again} readOnly size={18} /></div>}
          </section>
        )}

        <Checklist itemId={item.id} />
        <PhotoAlbum target={{ item_id: item.id }} coverId={cover?.id} />
        <Links itemId={item.id} />
        <ItemWishlist itemId={item.id} />
        <Comments itemId={item.id} />

        {!deleted && (
          <button className="btn w-full border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => setDeleting([id])}>
            <Trash2 size={16} /> Delete this item
          </button>
        )}
      </div>

      {completing && <CompleteDialog item={item} open onClose={() => setCompleting(false)} />}
      <DeleteItemDialog ids={deleting} onClose={() => setDeleting(null)} onDone={() => nav('/list', { replace: true })} />
    </div>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 p-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-rose-500" />
      <div className="min-w-0 flex-1"><div className="muted text-xs font-bold uppercase tracking-wide">{label}</div><div className="text-[15px]">{children}</div></div>
    </div>
  );
}

function Savings({ item }) {
  const { updateItem } = useApp();
  const [amt, setAmt] = useState('');
  const saved = Number(item.savings_saved || 0), target = Number(item.savings_target);
  const add = (n) => { if (!n || Number.isNaN(n)) return; updateItem(item.id, { savings_saved: Math.max(0, saved + n) }, n > 0 ? `+${fmtMoney(n, item.currency)} saved 🐷` : null); setAmt(''); };
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="section-title">Savings 🐷</h2>
        <span className="text-sm font-bold">{fmtMoney(saved, item.currency)} <span className="muted font-normal">of {fmtMoney(target, item.currency)}</span></span>
      </div>
      <ProgressBar value={saved} max={target} className="mt-3 h-3" color={saved >= target ? 'bg-emerald-500' : 'bg-gradient-to-r from-rose-400 to-rose-600'} />
      <p className="muted mt-1 text-xs">{saved >= target ? 'Goal reached! 🎉' : `${Math.round((saved / target) * 100)}% · ${fmtMoney(target - saved, item.currency)} to go`}</p>
      {item.status !== 'Completed' && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(Number(amt)); }}>
          <input className="input" type="number" min="0" inputMode="decimal" placeholder="Add amount" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Amount to add" />
          <button className="btn-soft px-4" disabled={!amt}>+ Add</button>
        </form>
      )}
    </section>
  );
}

function Checklist({ itemId }) {
  const { data, addSubtask, toggleSubtask, deleteSubtask } = useApp();
  const [text, setText] = useState('');
  const subs = data.subtasks.filter((s) => s.item_id === itemId).sort((a, b) => a.position - b.position);
  const done = subs.filter((s) => s.done).length;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="section-title">Checklist</h2>
        {subs.length > 0 && <span className="muted text-sm font-semibold">{done}/{subs.length}</span>}
      </div>
      {subs.length > 0 && <ProgressBar value={done} max={subs.length} className="mb-2 h-1.5" color="bg-emerald-500" />}
      <ul className="space-y-1.5">
        {subs.map((s) => (
          <li key={s.id} className="group flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 dark:bg-ink-800">
            <button onClick={() => toggleSubtask(s)} className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition', s.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink-700/30')}
              aria-label={s.done ? `Mark “${s.title}” not done` : `Mark “${s.title}” done`}>{s.done && <Check size={14} strokeWidth={3} />}</button>
            <span className={cn('flex-1 text-[15px]', s.done && 'muted line-through')}>{s.title}</span>
            <button className="muted opacity-60 hover:opacity-100" onClick={() => deleteSubtask(s.id)} aria-label={`Delete “${s.title}”`}><X size={16} /></button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addSubtask(itemId, text); setText(''); } }}>
        <input className="input" maxLength={200} placeholder="Add a step (book flights, save money…)" value={text} onChange={(e) => setText(e.target.value)} aria-label="New checklist step" />
        <button className="btn-soft px-3" aria-label="Add step"><Plus size={18} /></button>
      </form>
    </section>
  );
}

function Links({ itemId }) {
  const { data, addLink, deleteLink } = useApp();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('inspiration');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const links = data.item_links.filter((l) => l.item_id === itemId);
  const submit = async (e) => {
    e.preventDefault();
    const full = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`;
    const v = validateLink(full);
    if (v) return setErr(v);
    setErr('');
    if (await addLink(itemId, full, label.trim(), kind)) { setUrl(''); setLabel(''); setOpen(false); }
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="section-title">Links & bookings</h2>
        <button className="btn-soft px-3 py-1.5" onClick={() => setOpen(!open)}><Link2 size={15} /> Add</button>
      </div>
      {open && (
        <form onSubmit={submit} className="card mb-2 space-y-2 p-3">
          <input className="input" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link URL" />
          <input className="input" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link label" />
          <Segmented value={kind} onChange={setKind} options={[{ value: 'inspiration', label: '✨ Inspiration' }, { value: 'booking', label: '🎫 Booking' }, { value: 'other', label: 'Other' }]} />
          {err && <p className="err">{err}</p>}
          <button className="btn-primary w-full">Save link</button>
        </form>
      )}
      {links.length ? (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 dark:bg-ink-800">
              <span aria-hidden>{l.kind === 'booking' ? '🎫' : l.kind === 'inspiration' ? '✨' : '🔗'}</span>
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-[15px] font-semibold text-rose-700 dark:text-rose-300">{l.label || l.url.replace(/^https?:\/\//, '')}</a>
              <ExternalLink size={14} className="muted shrink-0" />
              <button className="muted" onClick={() => deleteLink(l.id)} aria-label="Delete link"><X size={16} /></button>
            </li>
          ))}
        </ul>
      ) : !open && <p className="muted text-sm">Save inspiration, reviews and confirmation links here.</p>}
    </section>
  );
}

function Comments({ itemId }) {
  const { data, me, partner, addComment, deleteComment, personLabel } = useApp();
  const [text, setText] = useState('');
  const comments = data.comments.filter((c) => c.item_id === itemId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const userOf = (uid) => (uid === me.id ? me : partner);
  return (
    <section>
      <h2 className="section-title mb-2">Notes to each other 💬</h2>
      <ul className="space-y-2">
        {comments.map((c) => {
          const mine = c.user_id === me.id;
          return (
            <li key={c.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
              <Avatar user={userOf(c.user_id)} size={26} />
              <div className={cn('group max-w-[78%] rounded-2xl px-3 py-2', mine ? 'rounded-br-md bg-rose-600 text-white' : 'rounded-bl-md bg-white dark:bg-ink-800')}>
                <p className="whitespace-pre-wrap text-[15px]">{c.body}</p>
                <p className={cn('mt-0.5 text-[10.5px]', mine ? 'text-white/75' : 'muted')}>
                  {personLabel(c.user_id)} · {timeAgo(c.created_at)}
                  {mine && <button className="ml-2 underline" onClick={() => deleteComment(c.id)}>delete</button>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await addComment(itemId, text))) setText(''); }}>
        <input className="input" maxLength={2000} placeholder="Write a note…" value={text} onChange={(e) => setText(e.target.value)} aria-label="New comment" />
        <button className="btn-primary px-3" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
    </section>
  );
}
