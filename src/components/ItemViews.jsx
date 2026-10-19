// Item presentations: compact list row (swipe / long-press) and photo card.
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Check, EyeOff, Gift, MapPin, MessageCircle, Trash2 } from 'lucide-react';
import { CATEGORY_META, PRIORITY_META, STATUS_META } from '../lib/constants.js';
import { cn, countdownLabel, fmtDate, fmtMoney } from '../lib/utils.js';
import { surpriseIsActive } from '../lib/visibility.js';
import { useApp } from '../store/AppStore.jsx';
import { MutualBadge, StoredImage } from './ui.jsx';

export function StatusPill({ status, className }) {
  return <span className={cn('chip', STATUS_META[status]?.cls, className)}>{status}</span>;
}

export function CategoryDot({ category }) {
  const m = CATEGORY_META[category] || CATEGORY_META.Other;
  return <span className="chip bg-black/[.04] text-ink-700 dark:bg-white/10 dark:text-cream-100"><span aria-hidden>{m.emoji}</span>{category}</span>;
}

/** Tiny "who" line: Added by + owner. */
function WhoLine({ item }) {
  const { personLabel } = useApp();
  const added = item.added_by_both ? 'Both' : personLabel(item.created_by);
  return <span className="muted text-xs">Added by {added}</span>;
}

/** Votes as two small heart scores: mine · partner's. */
export function VoteMini({ v }) {
  if (!v || (v.mine === null && v.theirs === null)) return null;
  return (
    <span className="muted text-xs font-semibold" title="Your vote · partner's vote">
      ★ {v.mine ?? '–'} · {v.theirs ?? '–'}
    </span>
  );
}

/**
 * List row. Swipe left (touch) reveals Delete; long-press (or the checkbox in select mode) selects.
 */
export function ItemRow({ item, selectMode, selected, onToggleSelect, onLongPress, onDelete }) {
  const nav = useNavigate();
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const pressTimer = useRef(null);
  const moved = useRef(false);

  const onTouchStart = (e) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    moved.current = false;
    pressTimer.current = setTimeout(() => { if (!moved.current) { navigator.vibrate?.(15); onLongPress?.(item.id); } }, 500);
  };
  const onTouchMove = (e) => {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x, ddy = e.touches[0].clientY - start.current.y;
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) { moved.current = true; clearTimeout(pressTimer.current); }
    if (!selectMode && Math.abs(ddx) > Math.abs(ddy)) setDx(Math.max(-96, Math.min(0, ddx + (dx < 0 ? -96 : 0))));
  };
  const onTouchEnd = () => {
    clearTimeout(pressTimer.current);
    setDx((d) => (d < -48 ? -96 : 0));
    start.current = null;
  };
  const open = () => {
    if (moved.current) return;
    if (selectMode) onToggleSelect(item.id);
    else if (dx !== 0) setDx(0);
    else nav(`/item/${item.id}`);
  };
  const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* swipe-revealed delete */}
      <button className="absolute inset-y-0 right-0 flex w-24 flex-col items-center justify-center gap-1 bg-red-600 text-xs font-bold text-white"
        onClick={() => { setDx(0); onDelete(item); }} aria-label={`Delete ${item.title}`} tabIndex={dx ? 0 : -1}>
        <Trash2 size={20} /> Delete
      </button>
      <div
        role="button" tabIndex={0}
        onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(item.id); }}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn('card relative flex cursor-pointer select-none items-center gap-3 p-3 transition-transform duration-200', selected && 'ring-2 ring-rose-500')}
      >
        {selectMode && (
          <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2', selected ? 'border-rose-600 bg-rose-600 text-white' : 'border-ink-700/30')}>
            {selected && <Check size={14} strokeWidth={3} />}
          </span>
        )}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" style={{ background: meta.color + '22' }}>
          <StoredImage path={item._cover} className="h-full w-full" fallback={<span className="grid h-full place-items-center text-2xl" aria-hidden>{meta.emoji}</span>} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className={cn('truncate font-sans text-[15px] font-bold', item.status === 'Completed' && 'line-through decoration-rose-400/60')}>{item.title}</h3>
            {surpriseIsActive(item) && <EyeOff size={14} className="shrink-0 text-violet-500" aria-label="Surprise — hidden from partner" />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <StatusPill status={item.status} className="px-2 py-0.5 text-[10.5px]" />
            <span className={cn('text-xs font-semibold', PRIORITY_META[item.priority]?.cls)}>{PRIORITY_META[item.priority]?.emoji} {item.priority}</span>
            <VoteMini v={item._votes} />
            {item.start_date && item.status !== 'Completed' && <span className="muted text-xs">· {countdownLabel(item.start_date)}</span>}
          </div>
          {item._votes?.mutual && <div className="mt-1"><MutualBadge small /></div>}
        </div>
      </div>
    </li>
  );
}

/** Photo-forward card for Card view and dashboard carousels. */
export function ItemCard({ item, compact }) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;
  const { data } = useApp();
  const gifts = data.wishlist_entries.filter((g) => g.item_id === item.id).length;
  return (
    <Link to={`/item/${item.id}`} className="card group block overflow-hidden transition active:scale-[.98]">
      <div className={cn('relative overflow-hidden', compact ? 'h-28' : 'h-40')} style={{ background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}10)` }}>
        <StoredImage path={item._cover} className="h-full w-full transition duration-500 group-hover:scale-105" fallback={<span className="grid h-full place-items-center text-5xl" aria-hidden>{meta.emoji}</span>} />
        <div className="absolute left-2 top-2 flex gap-1">
          <StatusPill status={item.status} className="shadow-sm" />
          {surpriseIsActive(item) && <span className="chip bg-violet-600 text-white"><EyeOff size={11} /> Surprise</span>}
        </div>
        {item._votes?.mutual && <div className="absolute bottom-2 left-2"><MutualBadge small /></div>}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 font-sans text-[15px] font-bold leading-snug">{item.title}</h3>
        {!compact && (
          <div className="muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {item.location_name && <span className="flex items-center gap-1"><MapPin size={12} />{item.location_name}</span>}
            {(item.start_date || item.timeframe) && <span className="flex items-center gap-1"><Calendar size={12} />{item.start_date ? fmtDate(item.start_date, 'd MMM') : item.timeframe}</span>}
            {item.est_cost ? <span>{fmtMoney(item.est_cost, item.currency)}</span> : null}
            {item._comments ? <span className="flex items-center gap-1"><MessageCircle size={12} />{item._comments}</span> : null}
            {gifts ? <span className="flex items-center gap-1"><Gift size={12} />{gifts}</span> : null}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <WhoLine item={item} />
          <VoteMini v={item._votes} />
        </div>
      </div>
    </Link>
  );
}
