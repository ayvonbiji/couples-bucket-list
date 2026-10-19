// Filter controls shared by the List view and "Surprise me".
import { CATEGORIES, PRIORITIES, STATUSES } from '../lib/constants.js';
import { EMPTY_FILTERS } from '../lib/stats.js';
import { useApp } from '../store/AppStore.jsx';
import { Field, Modal, Segmented, Toggle } from './ui.jsx';

const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Count of active filters (search excluded) for the filter button badge. */
export function activeFilterCount(f) {
  return f.categories.length + f.statuses.length + f.priorities.length + (f.owner !== 'any') + (f.minScore > 0) +
    (f.mutualOnly ? 1 : 0) + (f.maxCost !== '' ? 1 : 0) + (f.when !== 'any') + (f.hideCompleted ? 1 : 0);
}

export function FilterFields({ value: f, onChange, showStatus = true }) {
  const { partner, workspace } = useApp();
  const set = (patch) => onChange({ ...f, ...patch });
  return (
    <div className="space-y-5">
      <div>
        <span className="label">Category</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip-toggle" aria-pressed={f.categories.includes(c)} onClick={() => set({ categories: toggleIn(f.categories, c) })}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {showStatus && (
        <div>
          <span className="label">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => <button key={s} type="button" className="chip-toggle" aria-pressed={f.statuses.includes(s)} onClick={() => set({ statuses: toggleIn(f.statuses, s) })}>{s}</button>)}
          </div>
        </div>
      )}
      <div>
        <span className="label">Priority</span>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => <button key={p} type="button" className="chip-toggle" aria-pressed={f.priorities.includes(p)} onClick={() => set({ priorities: toggleIn(f.priorities, p) })}>{p}</button>)}
        </div>
      </div>
      <div>
        <span className="label">Owner</span>
        <Segmented value={f.owner} onChange={(owner) => set({ owner })}
          options={[{ value: 'any', label: 'Anyone' }, { value: 'me', label: 'Me' }, { value: 'partner', label: partner?.display_name || 'Partner' }, { value: 'both', label: 'Both' }]} />
      </div>
      <div>
        <span className="label">When</span>
        <Segmented value={f.when} onChange={(when) => set({ when })}
          options={[{ value: 'any', label: 'Any time' }, { value: 'weekend', label: 'This weekend' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'Next 30 days' }, { value: 'undated', label: 'No date yet' }]} />
      </div>
      <Field label={`Max cost (${workspace?.currency || ''})`}>
        <input className="input" type="number" min="0" inputMode="numeric" placeholder="No limit" value={f.maxCost}
          onChange={(e) => set({ maxCost: e.target.value })} />
      </Field>
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
