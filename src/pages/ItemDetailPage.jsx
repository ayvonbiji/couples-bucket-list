// Item detail: every field, organised. Essentials up top; planning tools in expandable sections.
import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Eye, EyeOff, ExternalLink, Gift, Heart, Images, Link2, ListChecks, MessageCircle, Pencil, Plus, RotateCcw, Send, ThumbsUp, Trash2, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { voteSummary } from '../lib/scoring.js';
import { surpriseIsActive } from '../lib/visibility.js';
import { validateLink } from '../lib/validation.js';
import { STATUSES } from '../lib/constants.js';
import { cn, countdownLabel, fmtDate, fmtMoney, timeAgo } from '../lib/utils.js';
import { Avatar, Disclosure, EmptyState, InfoRow, MutualBadge, PageHeader, ProgressBar, SegmentedControl, Stars, StoredImage } from '../components/ui.jsx';
import { StatusText } from '../components/ItemViews.jsx';
import { CategoryDot, CategoryPlaceholder } from '../components/icons.jsx';
import PhotoAlbum from '../components/PhotoAlbum.jsx';
import ItemWishlist from '../components/Wishlist.jsx';
import CompleteDialog from '../components/CompleteDialog.jsx';
import DeleteItemDialog from '../components/DeleteItemDialog.jsx';

const MiniMap = lazy(() => import('../components/MapBits.jsx').then((m) => ({ default: m.MiniMap })));

export default function ItemDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, me, partner, personLabel, updateItem, vote, toggleReaction, revealSurprise, reopenItem } = useApp();
  const item = data.items.find((i) => i.id === id);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const votes = useMemo(() => voteSummary(data.item_votes.filter((v) => v.item_id === id), me.id, partner?.id), [data.item_votes, id, me.id, partner?.id]);
  const photos = useMemo(() => data.item_photos.filter((p) => p.item_id === id).sort((a, b) => a.position - b.position), [data.item_photos, id]);

  if (!item) return <><PageHeader back="/list" /><EmptyState icon={EyeOff} title="This dream isn’t here" body="It may have been deleted — or it’s a surprise that isn’t for your eyes yet." /></>;

  const cover = photos.find((p) => p.id === item.cover_photo_id) || photos[0];
  const reactions = data.item_reactions.filter((r) => r.item_id === id);
  const deleted = item.is_deleted;
  const count = (t) => data[t].filter((r) => r.item_id === id).length;
  const subs = data.subtasks.filter((s) => s.item_id === id);

  const setStatus = (status) => {
    if (status === item.status) return;
    if (status === 'Completed') return setCompleting(true);
    if (item.status === 'Completed') return reopenItem(item.id).then(() => status !== 'In Progress' && updateItem(item.id, { status }));
    updateItem(item.id, { status });
  };

  return (
    <div className="pb-12">
      {/* Top bar over the image */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.6rem)]">
        <button className="icon-btn bg-cream-50/80 backdrop-blur-xl dark:bg-ink-950/70" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft size={22} strokeWidth={1.75} /></button>
        {!deleted && (
          <button className="icon-btn bg-cream-50/80 backdrop-blur-xl dark:bg-ink-950/70" onClick={() => nav(`/item/${id}/edit`)} aria-label="Edit"><Pencil size={17} strokeWidth={1.6} /></button>
        )}
      </div>

      <div className="-mt-[52px] px-5">
        <div className="aspect-[4/3] overflow-hidden rounded-3xl">
          <StoredImage path={cover?.storage_path} className="h-full w-full" fallback={<CategoryPlaceholder category={item.category} size={40} />} />
        </div>
      </div>

      <div className="space-y-7 px-5 pt-5">
        {/* Title block */}
        <section>
          <div className="flex flex-wrap items-center gap-2.5">
            <CategoryDot category={item.category} />
            <StatusText status={item.status} />
            <span className="muted text-[13px]">{item.priority}</span>
            {votes.mutual && <MutualBadge small />}
          </div>
          <h1 className="title-serif mt-2 text-[34px] leading-[1.1]">{item.title}</h1>
          <p className="muted mt-2 text-[13px]">
            Added by {item.added_by_both ? 'both of you' : personLabel(item.created_by)} · {item.owner_user_id ? `${personLabel(item.owner_user_id)}’s dream` : 'For both of you'}
          </p>
          {item.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700 dark:text-[#D4CFD5]">{item.description}</p>}
        </section>

        {deleted && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[14px] dark:bg-rose-900/20">In Recently deleted. <button className="btn-link" onClick={() => nav('/trash')}>Restore it</button></p>
        )}

        {surpriseIsActive(item) && item.created_by === me.id && (
          <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 dark:border-line-dark">
            <EyeOff size={18} strokeWidth={1.6} className="text-ink-500" />
            <span className="flex-1 text-[14px]">Hidden from {partner?.display_name || 'your partner'}{item.reveal_date ? ` until ${fmtDate(item.reveal_date, 'd MMM')}` : ''}</span>
            <button className="btn-link" onClick={() => revealSurprise(item.id)}><Eye size={15} strokeWidth={1.75} /> Reveal</button>
          </div>
        )}

        {/* Status */}
        {!deleted && (
          <section className="space-y-3">
            <SegmentedControl value={item.status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: s === 'In Progress' ? 'Doing' : s === 'Completed' ? 'Done' : s }))} />
            {item.status !== 'Completed' && <button className="btn-primary w-full" onClick={() => setCompleting(true)}><Check size={18} strokeWidth={1.75} /> Mark as completed</button>}
          </section>
        )}

        {/* Memory */}
        {item.status === 'Completed' && (
          <section>
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="section-title">Our memory</h2>
              {!deleted && <button className="btn-link text-[13px]" onClick={() => reopenItem(item.id)}><RotateCcw size={13} /> Reopen</button>}
            </div>
            <div className="list-group px-4 py-4">
              {item.completion_note ? <p className="title-serif text-[22px] italic leading-snug">“{item.completion_note}”</p> : <p className="muted text-[14px]">No note yet.</p>}
              <p className="muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <span>{fmtDate(item.completed_at, 'd MMMM yyyy')}</span>
                {item.actual_cost ? <span>Spent {fmtMoney(item.actual_cost, item.currency)}</span> : null}
                {item.would_do_again && <span className="flex items-center gap-1.5">Again? <Stars value={item.would_do_again} readOnly size={13} /></span>}
              </p>
            </div>
          </section>
        )}

        {/* Together: votes + reactions */}
        <section>
          <h2 className="section-title mb-2.5">Together</h2>
          <div className="list-group hairline">
            <div className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="flex items-center gap-2.5 text-[15px]"><Avatar user={me} size={26} /> You</span>
              <Stars value={votes.mine} onChange={(n) => vote(item.id, n)} label="Your vote" />
            </div>
            <div className="flex min-h-[52px] items-center justify-between gap-2 px-4 py-2">
              <span className="flex items-center gap-2.5 text-[15px]"><Avatar user={partner} size={26} /> {partner?.display_name || 'Partner'}</span>
              {votes.theirs !== null ? <span className="pr-1.5"><Stars value={votes.theirs} readOnly size={20} label={`${partner?.display_name || 'Partner'}'s vote`} /></span> : <span className="muted pr-2 text-[14px]">Not rated yet</span>}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex gap-2">
                {[['heart', Heart, 'Love'], ['thumbs', ThumbsUp, 'Like']].map(([k, Icon, l]) => {
                  const rs = reactions.filter((r) => r.emoji === k);
                  const mine = rs.some((r) => r.user_id === me.id);
                  return (
                    <button key={k} onClick={() => toggleReaction(item.id, k)} aria-pressed={mine} aria-label={`${l}${rs.length ? ` (${rs.length})` : ''}`}
                      className={cn('inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] transition', mine ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300' : 'border-line text-ink-500 dark:border-line-dark')}
                      title={rs.map((r) => personLabel(r.user_id)).join(', ')}>
                      <Icon size={15} strokeWidth={1.75} className={cn(mine && 'fill-current animate-heartbeat')} /> {rs.length || ''}
                    </button>
                  );
                })}
              </div>
              <span className="muted text-[13px]">Mutual score <span className="font-medium text-ink-800 dark:text-cream-100">{votes.score}</span></span>
            </div>
          </div>
        </section>

        {/* Details */}
        <section>
          <h2 className="section-title mb-2.5">Details</h2>
          <div className="list-group hairline">
            <InfoRow label="When">
              {item.start_date ? <>{fmtDate(item.start_date, 'd MMM yyyy')}{item.end_date && item.end_date !== item.start_date ? ` – ${fmtDate(item.end_date, 'd MMM')}` : ''}{item.status !== 'Completed' && <span className="muted block text-[13px]">{countdownLabel(item.start_date)}</span>}</> : null}
              {item.timeframe && <span className={cn('block', item.start_date && 'muted text-[13px]')}>{item.timeframe}</span>}
              {!item.start_date && !item.timeframe && <span className="muted">Not set</span>}
            </InfoRow>
            <InfoRow label="Where">{item.location_name || <span className="muted">Not set</span>}</InfoRow>
            <InfoRow label="Budget">{item.est_cost ? fmtMoney(item.est_cost, item.currency) : <span className="muted">Not set</span>}</InfoRow>
            {item.savings_target ? <Savings item={item} /> : null}
            {item.reminder_at && <InfoRow label="Reminder">{fmtDate(item.reminder_at, 'd MMM, HH:mm')}{item.reminder_done && ' ✓'}</InfoRow>}
            {item.tags?.length > 0 && <InfoRow label="Tags"><span className="flex flex-wrap justify-end gap-1.5">{item.tags.map((t) => <span key={t} className="chip-quiet">{t}</span>)}</span></InfoRow>}
          </div>
          {item.lat !== null && item.lat !== undefined && (
            <div className="mt-3">
              <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-cream-100 dark:bg-white/5" />}><MiniMap lat={item.lat} lng={item.lng} /></Suspense>
            </div>
          )}
        </section>

        {/* Expandable planning tools */}
        <section className="space-y-2">
          <Disclosure title="Photos" icon={Images} meta={photos.length || ''} defaultOpen={photos.length > 0}>
            <PhotoAlbum target={{ item_id: item.id }} coverId={cover?.id} bare />
          </Disclosure>
          <Disclosure title="Checklist" icon={ListChecks} meta={subs.length ? `${subs.filter((s) => s.done).length}/${subs.length}` : ''}>
            <Checklist itemId={item.id} />
          </Disclosure>
          <Disclosure title="Notes to each other" icon={MessageCircle} meta={count('comments') || ''}>
            <Comments itemId={item.id} />
          </Disclosure>
          <Disclosure title="Links & bookings" icon={Link2} meta={count('item_links') || ''}>
            <Links itemId={item.id} />
          </Disclosure>
          <Disclosure title="Gift & gear ideas" icon={Gift} meta={count('wishlist_entries') || ''}>
            <ItemWishlist itemId={item.id} bare />
          </Disclosure>
        </section>

        {!deleted && (
          <button className="btn-ghost w-full text-rose-700 dark:text-rose-300" onClick={() => setDeleting([id])}>
            <Trash2 size={16} strokeWidth={1.6} /> Delete dream
          </button>
        )}
      </div>

      {completing && <CompleteDialog item={item} open onClose={() => setCompleting(false)} />}
      <DeleteItemDialog ids={deleting} onClose={() => setDeleting(null)} onDone={() => nav('/list', { replace: true })} />
    </div>
  );
}

function Savings({ item }) {
  const { updateItem } = useApp();
  const [amt, setAmt] = useState('');
  const saved = Number(item.savings_saved || 0), target = Number(item.savings_target);
  const add = (n) => { if (!n || Number.isNaN(n)) return; updateItem(item.id, { savings_saved: Math.max(0, saved + n) }, n > 0 ? `${fmtMoney(n, item.currency)} added to savings` : null); setAmt(''); };
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="muted text-[14px]">Saved</span>
        <span className="text-[15px]">{fmtMoney(saved, item.currency)} <span className="muted">of {fmtMoney(target, item.currency)}</span></span>
      </div>
      <ProgressBar value={saved} max={target} className="mt-2.5" color={saved >= target ? 'bg-[#6F9884]' : 'bg-rose-500'} />
      {item.status !== 'Completed' && saved < target && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(Number(amt)); }}>
          <input className="input py-2" type="number" min="0" inputMode="decimal" placeholder={`Add to savings (${fmtMoney(target - saved, item.currency)} to go)`} value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Amount to add" />
          <button className="btn-soft min-h-[42px] px-4" disabled={!amt}>Add</button>
        </form>
      )}
    </div>
  );
}

function Checklist({ itemId }) {
  const { data, addSubtask, toggleSubtask, deleteSubtask } = useApp();
  const [text, setText] = useState('');
  const subs = data.subtasks.filter((s) => s.item_id === itemId).sort((a, b) => a.position - b.position);
  return (
    <div>
      <ul className="-mx-1 space-y-0.5">
        {subs.map((s) => (
          <li key={s.id} className="group flex min-h-[44px] items-center gap-3 rounded-lg px-1">
            <button onClick={() => toggleSubtask(s)} className={cn('grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition', s.done ? 'border-ink-500 bg-ink-500 text-white dark:border-ink-500' : 'border-ink-500/40')}
              aria-label={s.done ? `Mark “${s.title}” not done` : `Mark “${s.title}” done`}>{s.done && <Check size={12} strokeWidth={2.5} />}</button>
            <span className={cn('flex-1 text-[15px]', s.done && 'muted line-through')}>{s.title}</span>
            <button className="muted opacity-60 transition hover:opacity-100" onClick={() => deleteSubtask(s.id)} aria-label={`Delete “${s.title}”`}><X size={16} strokeWidth={1.6} /></button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addSubtask(itemId, text); setText(''); } }}>
        <input className="input py-2" maxLength={200} placeholder="Add a step" value={text} onChange={(e) => setText(e.target.value)} aria-label="New checklist step" />
        <button className="btn-soft min-h-[42px] px-3" aria-label="Add step"><Plus size={18} strokeWidth={1.75} /></button>
      </form>
    </div>
  );
}

function Links({ itemId }) {
  const { data, addLink, deleteLink } = useApp();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('inspiration');
  const [err, setErr] = useState('');
  const links = data.item_links.filter((l) => l.item_id === itemId);
  const submit = async (e) => {
    e.preventDefault();
    const full = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`;
    const v = validateLink(full);
    if (v) return setErr(v);
    setErr('');
    if (await addLink(itemId, full, label.trim(), kind)) { setUrl(''); setLabel(''); }
  };
  return (
    <div className="space-y-3">
      {links.length > 0 && (
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.id} className="flex min-h-[44px] items-center gap-3">
              <span className="chip-quiet">{l.kind === 'booking' ? 'Booking' : l.kind === 'inspiration' ? 'Idea' : 'Link'}</span>
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-[15px] underline decoration-line underline-offset-4 dark:decoration-line-dark">{l.label || l.url.replace(/^https?:\/\//, '')}</a>
              <ExternalLink size={14} strokeWidth={1.6} className="muted shrink-0" />
              <button className="muted" onClick={() => deleteLink(l.id)} aria-label="Delete link"><X size={16} strokeWidth={1.6} /></button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <input className="input py-2" inputMode="url" placeholder="Paste a link" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link URL" />
        {url && <>
          <input className="input py-2" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link label" />
          <SegmentedControl value={kind} onChange={setKind} options={[{ value: 'inspiration', label: 'Inspiration' }, { value: 'booking', label: 'Booking' }, { value: 'other', label: 'Other' }]} />
          {err && <p className="err">{err}</p>}
          <button className="btn-dark w-full">Save link</button>
        </>}
      </form>
    </div>
  );
}

function Comments({ itemId }) {
  const { data, me, partner, addComment, deleteComment, personLabel } = useApp();
  const [text, setText] = useState('');
  const comments = data.comments.filter((c) => c.item_id === itemId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const userOf = (uid) => (uid === me.id ? me : partner);
  return (
    <div>
      <ul className="space-y-3">
        {comments.map((c) => {
          const mine = c.user_id === me.id;
          return (
            <li key={c.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
              <Avatar user={userOf(c.user_id)} size={24} />
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2', mine ? 'rounded-br-md bg-ink-800 text-white dark:bg-cream-100 dark:text-ink-900' : 'rounded-bl-md bg-cream-100 dark:bg-white/5')}>
                <p className="whitespace-pre-wrap text-[15px]">{c.body}</p>
                <p className={cn('mt-0.5 text-[11px]', mine ? 'opacity-60' : 'muted')}>
                  {personLabel(c.user_id)} · {timeAgo(c.created_at)}
                  {mine && <button className="ml-2 underline" onClick={() => deleteComment(c.id)}>Delete</button>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {!comments.length && <p className="muted mb-1 text-[14px]">Leave a little note for each other.</p>}
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await addComment(itemId, text))) setText(''); }}>
        <input className="input py-2" maxLength={2000} placeholder="Write a note" value={text} onChange={(e) => setText(e.target.value)} aria-label="New comment" />
        <button className="btn-primary min-h-[42px] px-3" disabled={!text.trim()} aria-label="Send"><Send size={16} strokeWidth={1.75} /></button>
      </form>
    </div>
  );
}

