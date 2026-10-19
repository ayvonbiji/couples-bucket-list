// "Surprise me": filter-aware random pick with a gentle reveal, reroll and lock-in.
// <SurpriseContent> is the body (used by the Surprise page); <SurpriseMe> wraps it in a sheet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Dices, Lock, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { addDays, format, nextSaturday } from 'date-fns';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { EMPTY_FILTERS, applyFilters, randomPick } from '../lib/stats.js';
import { fmtMoney } from '../lib/utils.js';
import { FilterFields, activeFilterCount } from './Filters.jsx';
import { Field, Modal, MutualBadge, StoredImage } from './ui.jsx';
import { CategoryDot, CategoryPlaceholder } from './icons.jsx';

const PRESETS = [
  { label: 'Under 2,000', patch: { maxCost: '2000' } },
  { label: 'A few hours', patch: { timeRequired: ['Few hours'] } },
  { label: 'This weekend', patch: { when: 'weekend' } },
  { label: 'Both love it', patch: { mutualOnly: true } },
  { label: 'High priority', patch: { priorities: ['High'] } },
];

export function SurpriseContent({ onDone, initialFilters }) {
  const { me, updateItem } = useApp();
  const nav = useNavigate();
  const all = useDecoratedItems();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, ...initialFilters });
  const [phase, setPhase] = useState('setup'); // setup | spinning | revealed | lock
  const [pick, setPick] = useState(null);
  const [ticker, setTicker] = useState('');
  const [lockDate, setLockDate] = useState(format(nextSaturday(new Date()), 'yyyy-MM-dd'));
  const timer = useRef();

  // Open dreams only — "what should we do next?"
  const pool = useMemo(() => applyFilters(all.filter((i) => i.status !== 'Completed'), { ...filters, hideCompleted: true }, me?.id), [all, filters, me]);
  useEffect(() => () => clearInterval(timer.current), []);

  function spin(excludeId) {
    if (!pool.length) return;
    setPhase('spinning');
    let n = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setTicker(pool[Math.floor(Math.random() * pool.length)].title);
      if (++n > 12) {
        clearInterval(timer.current);
        setPick(randomPick(pool, excludeId));
        setPhase('revealed');
        navigator.vibrate?.(12);
      }
    }, 110);
  }

  async function lockIn() {
    await updateItem(pick.id, { status: 'Planned', start_date: lockDate, end_date: null }, 'Locked in — it’s on the calendar');
    onDone?.();
    nav(`/item/${pick.id}`);
  }

  const togglePreset = (patch) => setFilters((f) => {
    const on = Object.entries(patch).every(([k, v]) => JSON.stringify(f[k]) === JSON.stringify(v));
    return { ...f, ...(on ? Object.fromEntries(Object.keys(patch).map((k) => [k, EMPTY_FILTERS[k]])) : patch) };
  });

  if (phase === 'spinning') {
    return (
      <div className="grid h-72 place-items-center text-center">
        <div>
          <Dices size={28} strokeWidth={1.4} className="mx-auto mb-4 animate-spin text-rose-500" />
          <p className="title-serif text-[24px] opacity-60 transition">{ticker}</p>
        </div>
      </div>
    );
  }

  if (phase === 'revealed' && pick) {
    return (
      <div className="space-y-5" style={{ perspective: 900 }}>
        <div className="animate-flip">
          <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-cream-100 dark:bg-ink-900">
            <StoredImage path={pick._cover} className="h-full w-full" fallback={<CategoryPlaceholder category={pick.category} size={40} />} />
          </div>
          <div className="pt-5 text-center">
            <p className="section-title">Your next adventure</p>
            <h3 className="title-serif mt-2 text-[34px] leading-tight">{pick.title}</h3>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <CategoryDot category={pick.category} />
              {pick.est_cost ? <span className="muted text-[13px]">{fmtMoney(pick.est_cost, pick.currency)}</span> : null}
              {pick.timeframe && <span className="muted text-[13px]">{pick.timeframe}</span>}
              {pick._votes.mutual && <MutualBadge small />}
            </div>
          </div>
        </div>
        <button className="btn-primary w-full" onClick={() => setPhase('lock')}><Lock size={16} strokeWidth={1.75} /> Lock it in</button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-soft" onClick={() => spin(pick.id)} disabled={pool.length < 2}><RefreshCw size={15} strokeWidth={1.75} /> Pick again</button>
          <button className="btn-soft" onClick={() => { onDone?.(); nav(`/item/${pick.id}`); }}>View dream</button>
        </div>
      </div>
    );
  }

  if (phase === 'lock' && pick) {
    return (
      <div className="space-y-5">
        <p className="text-[15px]">Plan <span className="font-medium">{pick.title}</span> for:</p>
        <div className="flex flex-wrap gap-1.5">
          {[['This Saturday', nextSaturday(new Date())], ['Next week', addDays(new Date(), 7)], ['In a month', addDays(new Date(), 30)]].map(([l, d]) => (
            <button key={l} className="chip-toggle" aria-pressed={lockDate === format(d, 'yyyy-MM-dd')} onClick={() => setLockDate(format(d, 'yyyy-MM-dd'))}>{l}</button>
          ))}
        </div>
        <Field label="Date"><input type="date" className="input" value={lockDate} onChange={(e) => setLockDate(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-soft" onClick={() => setPhase('revealed')}>Back</button>
          <button className="btn-primary" disabled={!lockDate} onClick={lockIn}>Lock in</button>
        </div>
      </div>
    );
  }

  // setup
  return (
    <div className="space-y-5">
      <p className="muted text-[15px]">Let chance choose from {pool.length} open dream{pool.length === 1 ? '' : 's'}. The ones you both love get a little extra luck.</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const on = Object.entries(p.patch).every(([k, v]) => JSON.stringify(filters[k]) === JSON.stringify(v));
          return <button key={p.label} className="chip-toggle" aria-pressed={on} onClick={() => togglePreset(p.patch)}>{p.label}</button>;
        })}
      </div>
      <details className="group list-group">
        <summary className="list-row cursor-pointer">
          <SlidersHorizontal size={17} strokeWidth={1.6} className="text-ink-500" />
          <span className="flex-1 text-[15px]">More filters</span>
          {activeFilterCount(filters) > 0 && <span className="muted text-[13px]">{activeFilterCount(filters)} on</span>}
          <ChevronRight size={16} className="chev text-ink-500 transition-transform" />
        </summary>
        <div className="border-t border-line px-4 py-4 dark:border-line-dark"><FilterFields value={filters} onChange={setFilters} showStatus={false} compact /></div>
      </details>
      {pool.length === 0 ? (
        <p className="muted text-[14px]">Nothing matches these filters. <button className="btn-link" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button></p>
      ) : (
        <button className="btn-primary w-full" onClick={() => spin()}><Dices size={18} strokeWidth={1.6} /> Surprise us</button>
      )}
    </div>
  );
}

/** Sheet wrapper (kept for places that open it in context). */
export default function SurpriseMe({ open, onClose, initialFilters }) {
  return (
    <Modal open={open} onClose={onClose} title="Surprise me">
      {open && <SurpriseContent onDone={onClose} initialFilters={initialFilters} />}
    </Modal>
  );
}
