// Item presentations: quiet list row (swipe / long-press) and an image-first grid card.
// Progressive disclosure: only title, category, status, one date-or-place and a thumbnail.
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Ellipsis, EyeOff, Heart, Trash2 } from 'lucide-react';
import { STATUS_META } from '../lib/constants.js';
import { cn, countdownLabel, fmtDate } from '../lib/utils.js';
import { surpriseIsActive } from '../lib/visibility.js';
import { StoredImage } from './ui.jsx';
import { useApp } from '../store/AppStore.jsx';
import { CategoryDot, CategoryPlaceholder } from './icons.jsx';

export function StatusText({ status, className }) {
  return <span className={cn('text-[13px] font-medium', STATUS_META[status]?.cls, className)}>{status}</span>;
}
// Back-compat name used across pages.
export const StatusPill = StatusText;
export { CategoryDot };

/**
 * Small "Created by Ayvon" line: who originally created or suggested the dream, chosen in the form.
 * Older items without a creator show nothing until one is picked when editing.
 */
export function CreatedBy({ item, className }) {
  const { personName } = useApp();
  const name = item.creator_id ? personName(item.creator_id) : null;
  if (!name) return null;
  return <p className={cn('muted truncate text-[11px] leading-tight', className)}>Created by {name}</p>;
}

/** One secondary detail: upcoming date beats place beats timeframe. */
function secondary(item) {
  if (item.status === 'Completed' && item.completed_at) return fmtDate(item.completed_at, 'd MMM yyyy');
  if (item.start_date) return `${fmtDate(item.start_date, 'd MMM')} · ${countdownLabel(item.start_date)}`;
  return item.location_name || item.timeframe || '';
}

/** Votes as "★ 5 · 4" (mine · partner's). Used on detail summaries. */
export function VoteMini({ v }) {
  if (!v || (v.mine === null && v.theirs === null)) return null;
  return <span className="muted text-[13px]" title="Your vote · partner's vote">★ {v.mine ?? '–'} · {v.theirs ?? '–'}</span>;
}

/** Round completion checkbox used on every list (bucket list and Secret Fantasy). */
export function CompleteCheck({ done, onToggle, label, disabled }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onToggle(); }} onTouchStart={(e) => e.stopPropagation()}
      className={cn('grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition active:scale-90 disabled:opacity-40',
        done ? 'border-[#6F9884] bg-[#6F9884] text-white' : 'border-ink-500/35 hover:border-ink-500')}>
      {done && <Check size={14} strokeWidth={2.5} />}
    </button>
  );
}

/**
 * List row: completion checkbox, title, category, status, one detail and a thumbnail.
 * Swipe left reveals Delete; long-press starts multi-select; ⋯ opens Edit / Duplicate / Delete.
 */
export function ItemRow({ item, selectMode, selected, onToggleSelect, onLongPress, onDelete, onToggleComplete, onMore }) {
  const nav = useNavigate();
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const pressTimer = useRef(null);
  const moved = useRef(false);

  const onTouchStart = (e) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    moved.current = false;
    pressTimer.current = setTimeout(() => { if (!moved.current) { navigator.vibrate?.(10); onLongPress?.(item.id); } }, 500);
  };
  const onTouchMove = (e) => {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x, ddy = e.touches[0].clientY - start.current.y;
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) { moved.current = true; clearTimeout(pressTimer.current); }
    if (!selectMode && Math.abs(ddx) > Math.abs(ddy)) setDx(Math.max(-88, Math.min(0, ddx + (dx < 0 ? -88 : 0))));
  };
  const onTouchEnd = () => {
    clearTimeout(pressTimer.current);
    setDx((d) => (d < -44 ? -88 : 0));
    start.current = null;
  };
  const open = () => {
    if (moved.current) return;
    if (selectMode) onToggleSelect(item.id);
    else if (dx !== 0) setDx(0);
    else nav(`/item/${item.id}`);
  };
  const sub = secondary(item);

  return (
    <li className="relative overflow-hidden">
      <button className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-1 bg-rose-700 text-[12px] font-medium text-white"
        onClick={() => { setDx(0); onDelete(item); }} aria-label={`Delete ${item.title}`} tabIndex={dx ? 0 : -1}>
        <Trash2 size={18} strokeWidth={1.75} /> Delete
      </button>
      <div
        role="button" tabIndex={0}
        onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(item.id); }}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn('relative flex cursor-pointer select-none items-center gap-3.5 bg-white px-4 py-3 transition-transform duration-200 dark:bg-ink-900',
          selected && 'bg-rose-50 dark:bg-rose-900/20')}
      >
        {selectMode ? (
          <span className={cn('grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition',
            selected ? 'border-rose-500 bg-rose-500 text-white' : 'border-ink-500/40')}>
            {selected && <Check size={13} strokeWidth={2.5} />}
          </span>
        ) : onToggleComplete && (
          <CompleteCheck done={item.status === 'Completed'} onToggle={() => onToggleComplete(item)}
            label={item.status === 'Completed' ? `Reopen “${item.title}”` : `Mark “${item.title}” as completed`} />
        )}
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <StoredImage path={item._cover} className="h-full w-full" fallback={<CategoryPlaceholder category={item.category} size={18} />} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className={cn('truncate text-[15px] font-medium', item.status === 'Completed' && 'text-ink-500')}>{item.title}</h3>
            {surpriseIsActive(item) && <EyeOff size={13} strokeWidth={1.75} className="shrink-0 text-ink-500" aria-label="Surprise — hidden from partner" />}
            {item._votes?.mutual && <Heart size={12} strokeWidth={2} className="shrink-0 fill-rose-500 text-rose-500" aria-label="Both want this" />}
          </div>
          <div className="mt-0.5 flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <CategoryDot category={item.category} />
            <span className="text-ink-500/50" aria-hidden>·</span>
            <StatusText status={item.status} />
            {sub && <><span className="text-ink-500/50" aria-hidden>·</span><span className="muted truncate text-[13px]">{sub}</span></>}
          </div>
          <CreatedBy item={item} className="mt-0.5" />
        </div>
        {!selectMode && onMore && (
          <button type="button" className="icon-btn -mr-2 h-9 w-9 shrink-0 text-ink-500" onClick={(e) => { e.stopPropagation(); onMore(item); }} onTouchStart={(e) => e.stopPropagation()} aria-label={`Actions for ${item.title}`}>
            <Ellipsis size={18} strokeWidth={1.6} />
          </button>
        )}
      </div>
    </li>
  );
}

/** Grid card: consistent 4:5 image, title and one quiet line. */
export function ItemCard({ item, compact }) {
  return (
    <Link to={`/item/${item.id}`} className="group block">
      <div className={cn('relative overflow-hidden rounded-2xl bg-cream-100 dark:bg-ink-900', compact ? 'aspect-[4/3]' : 'aspect-[4/5]')}>
        <StoredImage path={item._cover} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" fallback={<CategoryPlaceholder category={item.category} size={28} />} />
        {item._votes?.mutual && (
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/85 backdrop-blur dark:bg-ink-900/80" aria-label="Both want this">
            <Heart size={13} strokeWidth={2} className="fill-rose-500 text-rose-500" />
          </span>
        )}
        {surpriseIsActive(item) && (
          <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/85 text-ink-700 backdrop-blur dark:bg-ink-900/80 dark:text-cream-100" aria-label="Surprise">
            <EyeOff size={13} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div className="px-0.5 pt-2.5">
        <h3 className="line-clamp-1 text-[15px] font-medium">{item.title}</h3>
        <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap">
          <CategoryDot category={item.category} label={false} />
          <StatusText status={item.status} />
        </div>
        {!compact && <CreatedBy item={item} className="mt-0.5" />}
      </div>
    </Link>
  );
}
