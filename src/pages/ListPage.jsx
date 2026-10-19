// The bucket list: search, filters, sort, List / Grid / Map, multi-select bulk delete.
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, CheckCircle2, LayoutGrid, List as ListIcon, Map as MapIcon, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { EMPTY_FILTERS, SORTS, applyFilters, applySort } from '../lib/stats.js';
import { FilterSheet, activeFilterCount } from '../components/Filters.jsx';
import { ItemCard, ItemRow } from '../components/ItemViews.jsx';
import { EmptyState, PageHeader, SegmentedControl } from '../components/ui.jsx';
import DeleteItemDialog from '../components/DeleteItemDialog.jsx';
import ItemActionSheet, { useCompleteToggle } from '../components/ItemActions.jsx';
import { cn } from '../lib/utils.js';

const VIEW_KEY = 'cbl:listView';
const STATUS_TABS = ['All', 'Idea', 'Planned', 'In Progress', 'On Hold', 'Completed'];

export default function ListPage() {
  const { me, categories } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const all = useDecoratedItems();
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    statuses: params.get('status') ? [params.get('status')] : [],
    categories: params.get('category') ? [params.get('category')] : [],
  }));
  const [acting, setActing] = useState(null);
  const toggleComplete = useCompleteToggle();
  const [sort, setSort] = useState(params.get('sort') || 'mutual');
  const [view, setView] = useState(() => { const v = localStorage.getItem(VIEW_KEY); return v === 'card' ? 'grid' : v || 'list'; });
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(null);

  const items = useMemo(() => applySort(applyFilters(all, filters, me.id), sort), [all, filters, sort, me.id]);
  const nActive = activeFilterCount(filters) - (filters.statuses.length === 1 ? 1 : 0) - (filters.categories.length === 1 ? 1 : 0);
  const currentCat = filters.categories.length === 1 ? filters.categories[0] : '';
  const currentTab = filters.statuses.length === 1 ? filters.statuses[0] : filters.statuses.length ? null : 'All';

  const setViewPersist = (v) => {
    if (v === 'map') return nav('/map');
    setView(v); localStorage.setItem(VIEW_KEY, v);
  };
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const startSelect = (id) => { setSelectMode(true); setSelected(new Set(id ? [id] : [])); };
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  return (
    <div>
      {selectMode ? (
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-cream-50/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl dark:border-line-dark dark:bg-ink-950/90">
          <button className="icon-btn" onClick={exitSelect} aria-label="Cancel selection"><X size={20} strokeWidth={1.75} /></button>
          <h1 className="flex-1 text-[17px] font-semibold">{selected.size} selected</h1>
          <button className="btn-ghost min-h-[36px] px-3 text-[14px]" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>Select all</button>
          <button className="btn-danger min-h-[36px] px-4 text-[14px]" disabled={!selected.size} onClick={() => setDeleting([...selected])}><Trash2 size={15} strokeWidth={1.75} /> Delete</button>
        </header>
      ) : (
        <PageHeader title={currentCat || 'Bucket List'} subtitle={`${items.length} of ${all.length} dream${all.length === 1 ? '' : 's'}`} actions={<>
          <button className="icon-btn" onClick={() => startSelect()} aria-label="Select items"><CheckCircle2 size={20} strokeWidth={1.6} /></button>
          <button className="icon-btn" onClick={() => nav('/item/new')} aria-label="New dream"><Plus size={22} strokeWidth={1.6} /></button>
        </>} />
      )}

      <div className="space-y-4 px-5">
        {/* Search + filter */}
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search size={16} strokeWidth={1.75} className="muted pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="input bg-ink-800/[.04] border-transparent pl-10 dark:bg-white/5" placeholder="Search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search dreams" />
          </label>
          <button className={cn('icon-btn relative h-[46px] w-[46px] rounded-xl bg-ink-800/[.04] dark:bg-white/5', nActive > 0 && 'text-rose-600')} onClick={() => setShowFilters(true)} aria-label={`Filters${nActive ? ` (${nActive} active)` : ''}`}>
            <SlidersHorizontal size={18} strokeWidth={1.6} />
            {nActive > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />}
          </button>
        </div>

        {/* Status tabs */}
        <div className="no-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 shadow-[inset_0_-1px_0_#EAE6E5] dark:shadow-[inset_0_-1px_0_#2E2B2F]" role="tablist">
          {STATUS_TABS.map((s) => (
            <button key={s} role="tab" aria-selected={currentTab === s}
              className={cn('shrink-0 border-b-[1.5px] pb-2.5 text-[14px] transition', currentTab === s ? 'border-ink-800 font-medium text-ink-800 dark:border-cream-100 dark:text-cream-100' : 'border-transparent text-ink-500')}
              onClick={() => setFilters({ ...filters, statuses: s === 'All' ? [] : [s] })}>{s}</button>
          ))}
        </div>

        {/* Category · sort · view */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1 text-[14px] text-ink-600 dark:text-[#B9B3BA] sm:flex-row sm:gap-4">
            <select className="max-w-[11rem] truncate bg-transparent focus:outline-none" value={currentCat} onChange={(e) => setFilters({ ...filters, categories: e.target.value ? [e.target.value] : [] })} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5">
              <ArrowUpDown size={13} strokeWidth={1.75} />
              <select className="appearance-none bg-transparent pr-1 focus:outline-none" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <SegmentedControl className="w-[132px]" value={view} onChange={setViewPersist}
            options={[{ value: 'list', label: <ListIcon size={16} strokeWidth={1.6} className="mx-auto" aria-label="List view" /> }, { value: 'grid', label: <LayoutGrid size={16} strokeWidth={1.6} className="mx-auto" aria-label="Grid view" /> }, { value: 'map', label: <MapIcon size={16} strokeWidth={1.6} className="mx-auto" aria-label="Map view" /> }]} />
        </div>

        {all.length === 0 ? (
          <EmptyState title="No dreams yet" body="What’s one thing you’d love to do together this year?"
            action={<button className="btn-dark" onClick={() => nav('/item/new')}>Add a dream</button>} />
        ) : items.length === 0 ? (
          <EmptyState icon={Search} title="Nothing matches" body="Try another search, or clear the filters."
            action={<button className="btn-soft" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>} />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 pb-4 sm:grid-cols-3">
            {items.map((i) => (
              <div key={i.id} className="animate-fade-up" onContextMenu={(e) => { e.preventDefault(); startSelect(i.id); }}>
                {selectMode ? (
                  <button className={cn('block w-full rounded-2xl text-left transition', selected.has(i.id) ? 'opacity-100 ring-2 ring-rose-500 ring-offset-4 ring-offset-cream-50 dark:ring-offset-ink-950' : 'opacity-70')} onClick={() => toggleSel(i.id)} aria-pressed={selected.has(i.id)}>
                    <div className="pointer-events-none"><ItemCard item={i} /></div>
                  </button>
                ) : <ItemCard item={i} />}
              </div>
            ))}
          </div>
        ) : (
          <ul className="list-group hairline mb-2">
            {items.map((i) => (
              <ItemRow key={i.id} item={i} selectMode={selectMode} selected={selected.has(i.id)} onToggleSelect={toggleSel}
                onLongPress={startSelect} onDelete={(it) => setDeleting([it.id])} onToggleComplete={toggleComplete} onMore={setActing} />
            ))}
          </ul>
        )}
        {!selectMode && view === 'list' && items.length > 0 && <p className="muted pb-4 text-center text-[12px]">Tick to complete · swipe left to delete · press and hold to select</p>}
      </div>

      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} value={filters} onChange={setFilters} />
      <DeleteItemDialog ids={deleting} onClose={() => setDeleting(null)} onDone={exitSelect} />
      {acting && <ItemActionSheet item={acting} onClose={() => setActing(null)} />}
    </div>
  );
}
