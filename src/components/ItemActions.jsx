// Shared item actions: complete / reopen toggle and the ⋯ action sheet (Edit, Duplicate, Complete/Reopen, Delete).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { Modal } from './ui.jsx';
import DeleteItemDialog from './DeleteItemDialog.jsx';

/** Returns a toggle(item) for checkboxes: completes with today's date (details can be added) or reopens. */
export function useCompleteToggle() {
  const { quickComplete, reopenItem, toast } = useApp();
  const nav = useNavigate();
  return async (item) => {
    if (item.status === 'Completed') return reopenItem(item.id);
    const r = await quickComplete(item.id);
    if (r) toast('Completed', 'info', { label: 'Add details', onClick: () => nav(`/item/${item.id}?complete=1`) });
  };
}

export default function ItemActionSheet({ item, onClose, onDeleted }) {
  const nav = useNavigate();
  const { duplicateItem } = useApp();
  const toggle = useCompleteToggle();
  const [deleting, setDeleting] = useState(false);
  if (!item) return null;
  const done = item.status === 'Completed';
  const rows = [
    [Pencil, 'Edit', () => nav(`/item/${item.id}/edit`)],
    [Copy, 'Duplicate', async () => { const c = await duplicateItem(item.id); if (c) nav(`/item/${c.id}`); }],
    [done ? RotateCcw : CheckCircle2, done ? 'Reopen' : 'Mark as completed', () => toggle(item)],
  ];
  return (
    <>
      <Modal open={!deleting} onClose={onClose} title={item.title}>
        <ul className="list-group hairline -mx-1">
          {rows.map(([Icon, label, fn]) => (
            <li key={label}>
              <button className="list-row" onClick={async () => { onClose(); await fn(); }}>
                <Icon size={18} strokeWidth={1.6} className="text-ink-500" /> <span className="text-[15px]">{label}</span>
              </button>
            </li>
          ))}
          <li>
            <button className="list-row text-rose-700 dark:text-rose-300" onClick={() => setDeleting(true)}>
              <Trash2 size={18} strokeWidth={1.6} /> <span className="text-[15px]">Delete</span>
            </button>
          </li>
        </ul>
      </Modal>
      {deleting && <DeleteItemDialog ids={[item.id]} onClose={() => { setDeleting(false); onClose(); }} onDone={onDeleted} />}
    </>
  );
}
