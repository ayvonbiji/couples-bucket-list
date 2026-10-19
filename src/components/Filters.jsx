// Filter controls shared by the List view and "Surprise me".
import { PRIORITIES, STATUSES, TIME_REQUIRED } from '../lib/constants.js';
import { EMPTY_FILTERS } from '../lib/stats.js';
import { useApp } from '../store/AppStore.jsx';
import { Modal, Segmented, Toggle } from './ui.jsx';

const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Count of active filters (search excluded) for the filter button badge. */
export function activeFilterCount(f) {
  return f.categories.length + f.statuses.length + f.priorities.length + (f.owner !== 'any') + (f.createdBy !== 'any') + (f.minScore > 0) +
    (f.mutualOnly ? 1 : 0) + (f.maxCost !== '' ? 1 : 0) + (f.minCost !== '' ? 1 : 0) + (f.when !== 'any') + (f.hideCompleted ? 1 : 0) +
    f.timeRequired.length + (f.targetFrom || f.targetTo ? 1 : 0) + (f.completedFrom || f.completedTo ? 1 : 0);
}

function Group({ label, children }) {
  return <div><span className="label">{label}</span>{children}</div>;
}

export function FilterFields({ value: f, onChange, showStatus = true, compact = false }) {
  const { partner, workspace, categories } = useApp();
  const set = (patch) => onChange({ ...f, ...patch });
  const chips = (list, key) => (
    <div className="flex flex-wrap gap-1.5">
      {list.map((v) => <button key={v} type="button" className="chip-toggle" aria-pressed={f[key].includes(v)} onClick={() => set({ [key]: toggleIn(f[key], v) })}>{v}</button>)}
    </div>
  );
  return (
    <div className="space-y-5">
      <Group label="Category">{chips(categories.map((c) => c.name), 'categories')}</Group>
      {showStatus && <Group label="Status">{chips(STATUSES, 'statuses')}</Group>}
      <Group label="Priority">{chips(PRIORITIES, 'priorities')}</Group>
      <Group label="Time required">{chips(TIME_REQUIRED, 'timeRequired')}</Group>
      <Group label={`Budget (${workspace?.currency || ''})`}>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" min="0" inputMode="numeric" placeholder="Min" value={f.minCost} onChange={(e) => set({ minCost: e.target.value })} aria-label="Minimum budget" />
          <input className="input" type="number" min="0" inputMode="numeric" placeholder="Max" value={f.maxCost} onChange={(e) => set({ maxCost: e.target.value })} aria-label="Maximum budget" />
        </div>
      </Group>
      {!compact && (
        <>
          <Group label="Created by">
            <Segmented value={f.createdBy} onChange={(createdBy) => set({ createdBy })}
              options={[{ value: 'any', label: 'Anyone' }, { value: 'me', label: 'Me' }, { value: 'partner', label: partner?.display_name || 'Partner' }, { value: 'both', label: 'Together' }]} />
          </Group>
          <Group label="Whose dream">
            <Segmented value={f.owner} onChange={(owner) => set({ owner })}
              options={[{ value: 'any', label: 'Anyone' }, { value: 'me', label: 'Mine' }, { value: 'partner', label: partner?.display_name || 'Partner' }, { value: 'both', label: 'Both' }]} />
          </Group>
          <Group label="Target date">
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="date" value={f.targetFrom} onChange={(e) => set({ targetFrom: e.target.value })} aria-label="Target date from" />
              <input className="input" type="date" value={f.targetTo} onChange={(e) => set({ targetTo: e.target.value })} aria-label="Target date to" />
            </div>
          </Group>
          {showStatus && (
            <Group label="Completed between">
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="date" value={f.completedFrom} onChange={(e) => set({ completedFrom: e.target.value })} aria-label="Completed from" />
                <input className="input" type="date" value={f.completedTo} onChange={(e) => set({ completedTo: e.target.value })} aria-label="Completed to" />
              </div>
            </Group>
          )}
        </>
      )}
      <Group label="When">
        <Segmented value={f.when} onChange={(when) => set({ when })}
          options={[{ value: 'any', label: 'Any time' }, { value: 'weekend', label: 'This weekend' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'Next 30 days' }, { value: 'undated', label: 'No date yet' }]} />
      </Group>
      <div>
        <span className="label">Mutual score — at least {f.minScore}</span>
        <input type="range" min="0" max="100" step="10" value={f.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })} className="w-full accent-rose-500" aria-label="Minimum mutual score" />
      </div>
      <Toggle checked={f.mutualOnly} onChange={(mutualOnly) => set({ mutualOnly })} label="Both love it" description="Only dreams you both rated 4 stars or more" />
      {showStatus && <Toggle checked={f.hideCompleted} onChange={(hideCompleted) => set({ hideCompleted })} label="Hide completed" />}
    </div>
  );
}

export function FilterSheet({ open, onClose, value, onChange }) {
  return (
    <Modal open={open} onClose={onClose} title="Filters"
      footer={<>
        <button className="btn-ghost flex-1" onClick={() => onChange({ ...EMPTY_FILTERS, q: value.q })}>Clear all</button>
        <button className="btn-dark flex-1" onClick={onClose}>Show results</button>
      </>}>
      <FilterFields value={value} onChange={onChange} />
    </Modal>
  );
}
