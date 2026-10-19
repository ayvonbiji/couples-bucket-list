// The bucket list: search, filters, sort, List/Card view, Map link, multi-select bulk delete.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckSquare, Dices, LayoutGrid, List as ListIcon, Map as MapIcon, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { EMPTY_FILTERS, SORTS, applyFilters, applySort } from '../lib/stats.js';
import { FilterSheet, activeFilterCount } from '../components/Filters.jsx';
import { ItemCard, ItemRow } from '../components/ItemViews.jsx';
import { EmptyState, PageHeader } from '../components/ui.jsx';
import DeleteItemDialog from '../components/DeleteItemDialog.jsx';
import SurpriseMe from '../components/SurpriseMe.jsx';
import { cn } from '../lib/utils.js';

const VIEW_KEY = 'cbl:listView';

export default function ListPage() {
  const { me } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const all = useDecoratedItems();
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, statuses: params.get('status') ? [params.get('status')] : [] }));
  const [sort, setSort] = useState(params.get('sort') || 'mutual');
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(null);
  const [surprise, setSurprise] = useState(false);

  const items = useMemo(() => applySort(applyFilters(all, filters, me.id), sort), [all, filters, sort, me.id]);
  const nActive = activeFilterCount(filters);

  const setViewPersist = (v) => { setView(v); localStorage.setItem(VIEW_KEY, v); };
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const startSelect = (id) => { setSelectMode(true); setSelected(new Set(id ? [id] : [])); };
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  return (
    <div>
      {selectMode ? (
        <header className="sticky top-0 z-20 flex items-center gap-2 bg-rose-600 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.9rem)] text-white">
          <button className="icon-btn hover:bg-white/15" onClick={exitSelect} aria-label="Cancel selection"><X size={20} /></button>
          <h1 className="flex-1 text-xl font-bold">{selected.size} selected</h1>
          <button className="btn bg-white/15 hover:bg-white/25" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>All</button>
          <button className="btn bg-white text-rose-700" disabled={!selected.size} onClick={() => setDeleting([...selected])}><Trash2 size={16} /> Delete</button>
        </header>
      ) : (
        <PageHeader title="Our list" subtitle={`${items.length} of ${all.length} items`} actions={<>
          <button className="icon-btn" onClick={() => startSelect()} aria-label="Select items"><CheckSquare size={20} /></button>
          <button className="icon-btn text-rose-600" onClick={() => setSurprise(true)} aria-label="Surprise me"><Dices size={21} /></button>
        </>} />
      )}

      <div className="space-y-3 px-4">
        {/* Search + filter */}
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search size={17} className="muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input pl-9" placeholder="Search titles, places, tags…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search" />
          </label>
          <button className={cn('btn-soft relative px-3', nActive && 'ring-2 ring-rose-500')} onClick={() => setShowFilters(true)} aria-label="Filters">
            <SlidersHorizontal size={18} />
            {nActive > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] text-white">{nActive}</span>}
          </button>
        </div>

        {/* Sort + view */}
        <div className="flex items-center gap-2">
          <select className="input w-auto flex-1 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>Sort: {s.label}</option>)}
          </select>
          <div className="flex rounded-full bg-rose-100 p-1 dark:bg-white/10" role="tablist" aria-label="View">
            {[['list', ListIcon, 'List view'], ['card', LayoutGrid, 'Card view']].map(([v, Icon, l]) => (
              <button key={v} role="tab" aria-selected={view === v} aria-label={l} onClick={() => setViewPersist(v)}
                className={cn('grid h-8 w-9 place-items-center rounded-full transition', view === v && 'bg-white text-rose-600 shadow dark:bg-ink-800')}><Icon size={17} /></button>
            ))}
            <Link to="/map" aria-label="Map view" className="grid h-8 w-9 place-items-center rounded-full"><MapIcon size={17} /></Link>
          </div>
        </div>

        {/* Quick status chips */}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {['All', 'Idea', 'Planned', 'In Progress', 'Completed'].map((s) => {
            const on = s === 'All' ? !filters.statuses.length : filters.statuses.length === 1 && filters.statuses[0] === s;
            return <button key={s} className="chip-toggle shrink-0" aria-pressed={on} onClick={() => setFilters({ ...filters, statuses: s === 'All' ? [] : [s] })}>{s}</button>;
          })}
          <button className="chip-toggle shrink-0" aria-pressed={filters.mutualOnly} onClick={() => setFilters({ ...filters, mutualOnly: !filters.mutualOnly })}>💞 Both want</button>
        </div>

        {all.length === 0 ? (
          <EmptyState emoji="🗺️" title="No dreams yet" body="What’s one thing you’d love to do together this year?"
            action={<button className="btn-primary" onClick={() => nav('/item/new')}><Plus size={18} /> Add an item</button>} />
        ) : items.length === 0 ? (
          <EmptyState emoji="🔍" title="Nothing matches" body="Try a different search or loosen the filters."
            action={<button className="btn-soft" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>} />
        ) : view === 'card' ? (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {items.map((i) => (
              <div key={i.id} className="animate-fade-up" onContextMenu={(e) => { e.preventDefault(); startSelect(i.id); }}>
                {selectMode ? (
                  <button className={cn('block w-full rounded-2xl text-left', selected.has(i.id) && 'ring-4 ring-rose-500')} onClick={() => toggleSel(i.id)}>
                    <div className="pointer-events-none"><ItemCard item={i} /></div>
                  </button>
                ) : <ItemCard item={i} />}
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2 pb-4">
            {items.map((i) => (
              <ItemRow key={i.id} item={i} selectMode={selectMode} selected={selected.has(i.id)} onToggleSelect={toggleSel}
                onLongPress={startSelect} onDelete={(it) => setDeleting([it.id])} />
            ))}
          </ul>
        )}
        {!selectMode && all.length > 0 && <p className="muted pb-2 text-center text-xs">Tip: swipe left to delete · long-press to select several</p>}
      </div>

      {!selectMode && (
        <button onClick={() => nav('/item/new')} className="fixed bottom-24 right-[max(1rem,calc(50%-20rem))] z-30 grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-700 active:scale-95" aria-label="Add item">
          <Plus size={26} />
        </button>
      )}

      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} value={filters} onChange={setFilters} />
      <DeleteItemDialog ids={deleting} onClose={() => setDeleting(null)} onDone={exitSelect} />
      <SurpriseMe open={surprise} onClose={() => setSurprise(false)} initialFilters={{ ...filters, statuses: [] }} />
    </div>
  );
}
