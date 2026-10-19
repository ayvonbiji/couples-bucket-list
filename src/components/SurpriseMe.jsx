// "Surprise me": filter-aware random pick with a slot-machine reveal, reroll and lock-in.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dices, Lock, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { addDays, format, nextSaturday } from 'date-fns';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { EMPTY_FILTERS, applyFilters, randomPick } from '../lib/stats.js';
import { CATEGORY_META } from '../lib/constants.js';
import { fmtMoney } from '../lib/utils.js';
import { FilterFields, activeFilterCount } from './Filters.jsx';
import { Field, Modal, MutualBadge, StoredImage } from './ui.jsx';

const PRESETS = [
  { label: '💸 Cheap', patch: { maxCost: '2000' } },
  { label: '📅 This weekend', patch: { when: 'weekend' } },
  { label: '💞 Both 4★+', patch: { mutualOnly: true } },
  { label: '🔥 Must-do', patch: { priorities: ['Must-do'] } },
];

export default function SurpriseMe({ open, onClose, initialFilters }) {
  const { me, updateItem } = useApp();
  const nav = useNavigate();
  const all = useDecoratedItems();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, ...initialFilters });
  const [phase, setPhase] = useState('setup'); // setup | spinning | revealed | lock
  const [pick, setPick] = useState(null);
  const [ticker, setTicker] = useState('');
  const [lockDate, setLockDate] = useState(format(nextSaturday(new Date()), 'yyyy-MM-dd'));
  const timer = useRef();

  // Open items only — "what should we do next?"
  const pool = useMemo(() => applyFilters(all.filter((i) => i.status !== 'Completed'), { ...filters, hideCompleted: true }, me?.id), [all, filters, me]);

  useEffect(() => { if (open) { setPhase('setup'); setPick(null); setFilters({ ...EMPTY_FILTERS, ...initialFilters }); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearInterval(timer.current), []);

  function spin(excludeId) {
    if (!pool.length) return;
    setPhase('spinning');
    let n = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setTicker(pool[Math.floor(Math.random() * pool.length)].title);
      if (++n > 14) {
        clearInterval(timer.current);
        setPick(randomPick(pool, excludeId));
        setPhase('revealed');
        navigator.vibrate?.([20, 40, 20]);
      }
    }, 90);
  }

  async function lockIn() {
    await updateItem(pick.id, { status: 'Planned', start_date: lockDate, end_date: null }, 'Locked in! It’s on the calendar 📅');
    onClose();
    nav(`/item/${pick.id}`);
  }

  const meta = pick ? CATEGORY_META[pick.category] || CATEGORY_META.Other : null;

  return (
    <Modal open={open} onClose={onClose} title="Surprise me ✨">
      {phase === 'setup' && (
        <div className="space-y-4">
          <p className="muted text-sm">We'll pick something from <b>{pool.length}</b> open item{pool.length === 1 ? '' : 's'} that match. Mutual favourites get a little extra luck.</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} className="chip-toggle" onClick={() => setFilters((f) => ({ ...f, ...p.patch }))}>{p.label}</button>
            ))}
          </div>
          <details className="rounded-xl bg-white p-3 dark:bg-ink-800">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <SlidersHorizontal size={16} /> More filters {activeFilterCount(filters) > 0 && <span className="chip bg-rose-600 text-white">{activeFilterCount(filters)}</span>}
            </summary>
            <div className="pt-4"><FilterFields value={filters} onChange={setFilters} showStatus={false} /></div>
          </details>
          {pool.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Nothing matches these filters. Loosen them a little?
              <button className="ml-2 font-bold underline" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button></p>
          ) : (
            <button className="btn-primary w-full py-3 text-base" onClick={() => spin()}><Dices size={20} /> Pick for us!</button>
          )}
        </div>
      )}

      {phase === 'spinning' && (
        <div className="grid h-56 place-items-center text-center">
          <div>
            <div className="mb-3 animate-spin text-5xl" aria-hidden>🎲</div>
            <p className="font-display text-xl font-bold blur-[1px]">{ticker}</p>
          </div>
        </div>
      )}

      {phase === 'revealed' && pick && (
        <div className="space-y-4 text-center" style={{ perspective: 800 }}>
          <div className="relative">
            <Confetti />
            <div className="card mx-auto overflow-hidden animate-flip">
              <div className="h-36" style={{ background: `linear-gradient(135deg, ${meta.color}44, ${meta.color}11)` }}>
                <StoredImage path={pick._cover} className="h-full w-full" fallback={<span className="grid h-full place-items-center text-6xl">{meta.emoji}</span>} />
              </div>
              <div className="p-4">
                <p className="muted text-xs font-bold uppercase tracking-wider">Your next adventure</p>
                <h3 className="mt-1 text-2xl font-bold">{pick.title}</h3>
                <p className="muted mt-1 text-sm">{[pick.category, pick.est_cost ? fmtMoney(pick.est_cost, pick.currency) : null, pick.timeframe].filter(Boolean).join(' · ')}</p>
                {pick._votes.mutual && <div className="mt-2"><MutualBadge /></div>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-soft" onClick={() => spin(pick.id)} disabled={pool.length < 2}><RefreshCw size={16} /> Reroll</button>
            <button className="btn-primary" onClick={() => setPhase('lock')}><Lock size={16} /> Lock it in</button>
          </div>
          <button className="btn-ghost w-full" onClick={() => { onClose(); nav(`/item/${pick.id}`); }}>View details</button>
        </div>
      )}

      {phase === 'lock' && pick && (
        <div className="space-y-4">
          <p className="text-[15px]">Set <b>{pick.title}</b> to <b>Planned</b> on:</p>
          <div className="flex flex-wrap gap-1.5">
            {[['This Saturday', nextSaturday(new Date())], ['Next week', addDays(new Date(), 7)], ['In a month', addDays(new Date(), 30)]].map(([l, d]) => (
              <button key={l} className="chip-toggle" aria-pressed={lockDate === format(d, 'yyyy-MM-dd')} onClick={() => setLockDate(format(d, 'yyyy-MM-dd'))}>{l}</button>
            ))}
          </div>
          <Field label="Date"><input type="date" className="input" value={lockDate} onChange={(e) => setLockDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setPhase('revealed')}>Back</button>
            <button className="btn-primary" disabled={!lockDate} onClick={lockIn}>Lock in 💕</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** A little burst of hearts behind the revealed card. */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 16 }, (_, k) => ({
    k, left: Math.random() * 100, delay: Math.random() * 0.3, emoji: ['💖', '✨', '💕', '🎉'][k % 4], rot: Math.random() * 60 - 30,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-4 z-10 h-0" aria-hidden>
      {bits.map((b) => (
        <span key={b.k} className="absolute animate-pop text-xl" style={{ left: `${b.left}%`, top: `${(b.k % 4) * 10 - 10}px`, animationDelay: `${b.delay}s`, transform: `rotate(${b.rot}deg)` }}>{b.emoji}</span>
      ))}
    </div>
  );
}
