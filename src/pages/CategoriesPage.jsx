// Categories: each is a filtered view of the same list. Add, rename, recolour, reorder, remove.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { ConfirmDialog, Field, Modal, PageHeader, ProgressBar, SegmentedControl } from '../components/ui.jsx';
import { CategoryIcon } from '../components/icons.jsx';
import { cn } from '../lib/utils.js';

const COLORS = ['#8A8590', '#6E8FAF', '#C65D70', '#8E7DA6', '#C39A62', '#6F9884', '#B0809A', '#9B6B8E', '#7F9AA0', '#A3958A'];

export default function CategoriesPage() {
  const { categories, fantasyCategories, items } = useApp();
  const [kind, setKind] = useState('bucket');
  const [editing, setEditing] = useState(null); // category | 'new'
  const list = kind === 'bucket' ? categories : fantasyCategories;

  // Bucket-list progress per category (fantasy counts are deliberately not computed here).
  const stats = useMemo(() => {
    const m = {};
    for (const i of items) {
      const s = (m[i.category] ||= { total: 0, done: 0 });
      s.total++; if (i.status === 'Completed') s.done++;
    }
    return m;
  }, [items]);

  return (
    <div>
      <PageHeader title="Categories" back actions={<button className="icon-btn" onClick={() => setEditing('new')} aria-label="Add category"><Plus size={22} strokeWidth={1.6} /></button>} />
      <div className="space-y-5 px-5 pb-10">
        <SegmentedControl value={kind} onChange={setKind} options={[{ value: 'bucket', label: 'Bucket list' }, { value: 'fantasy', label: 'Secret Fantasy' }]} />
        <ul className="list-group hairline">
          {list.map((c) => {
            const s = stats[c.name] || { total: 0, done: 0 };
            return (
              <li key={c.id} className="flex items-center">
                {kind === 'bucket' ? (
                  <Link to={`/list?category=${encodeURIComponent(c.name)}`} className="list-row flex-1">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `${c.color}1f`, color: c.color }}><CategoryIcon category={c.name} size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{c.name}</span>
                      {s.total > 0 ? <ProgressBar value={s.done} max={s.total} className="mt-1.5 h-1" color="bg-ink-500/50" /> : <span className="muted text-[12px]">No dreams yet</span>}
                    </span>
                    <span className="muted text-[13px]">{s.total ? `${s.done}/${s.total}` : ''}</span>
                    <ChevronRight size={16} className="text-ink-500" />
                  </Link>
                ) : (
                  <span className="list-row flex-1 hover:bg-transparent">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 truncate text-[15px]">{c.name}</span>
                  </span>
                )}
                <button className="icon-btn mr-2 h-9 w-9" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil size={15} strokeWidth={1.6} /></button>
              </li>
            );
          })}
        </ul>
        <p className="muted text-[13px]">{kind === 'bucket' ? 'Every category is a filtered view of your one shared list. Tap one to open it.' : 'Fantasy categories are shared names; entries inside them stay private until shared.'}</p>
      </div>
      {editing && <CategorySheet kind={kind} list={list} category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategorySheet({ kind, list, category, onClose }) {
  const { addCategory, renameCategory, recolorCategory, reorderCategories, deleteCategory } = useApp();
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[list.length % COLORS.length]);
  const [fallback, setFallback] = useState(() => list.find((c) => c.id !== category?.id)?.id || '');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const idx = category ? list.findIndex((c) => c.id === category.id) : -1;

  async function save() {
    if (!name.trim()) return setError('Give it a name');
    if (!category) { if (await addCategory(kind, name, color)) onClose(); return; }
    if (name.trim() !== category.name && !(await renameCategory(category.id, name))) return;
    if (color !== category.color) await recolorCategory(category.id, color);
    onClose();
  }
  const move = (dir) => {
    const next = [...list]; const j = idx + dir;
    [next[idx], next[j]] = [next[j], next[idx]];
    reorderCategories(next);
  };

  return (
    <Modal open onClose={onClose} title={category ? 'Edit category' : 'New category'}
      footer={<><button className="btn-ghost flex-1" onClick={onClose}>Cancel</button><button className="btn-dark flex-1" onClick={save}>Save</button></>}>
      <div className="space-y-5">
        <Field label="Name" error={error}><input className="input" maxLength={60} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} /></Field>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c}
              className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-cream-50 dark:ring-offset-ink-900', color === c && 'ring-[1.5px] ring-ink-800 dark:ring-cream-100')} style={{ background: c }} />)}
          </div>
        </div>
        {category && (
          <>
            <div className="flex items-center justify-between">
              <span className="label mb-0">Order</span>
              <div className="flex gap-1">
                <button className="btn-soft min-h-[38px] px-3" disabled={idx <= 0} onClick={() => move(-1)} aria-label="Move up"><ArrowUp size={15} /></button>
                <button className="btn-soft min-h-[38px] px-3" disabled={idx >= list.length - 1} onClick={() => move(1)} aria-label="Move down"><ArrowDown size={15} /></button>
              </div>
            </div>
            {list.length > 1 && (
              <div className="space-y-2 border-t border-line pt-4 dark:border-line-dark">
                <span className="label">Remove category — move its entries to</span>
                <select className="input" value={fallback} onChange={(e) => setFallback(e.target.value)} aria-label="Move entries to">
                  {list.filter((c) => c.id !== category.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn-ghost w-full text-rose-700 dark:text-rose-300" onClick={() => setConfirm(true)}>Remove “{category.name}”</button>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog open={confirm} danger title={`Remove “${category?.name}”?`} confirmLabel="Remove"
        message={`Everything in it moves to “${list.find((c) => c.id === fallback)?.name}”. Nothing is deleted.`}
        onClose={() => setConfirm(false)} onConfirm={async () => { await deleteCategory(category.id, fallback); onClose(); }} />
    </Modal>
  );
}
