// Delete confirmation for one or many items: moves them to Trash, with an Undo toast.
// Lists what else goes with them (subtasks, comments, photos, gifts, votes).
import { useMemo } from 'react';
import { useApp } from '../store/AppStore.jsx';
import { ConfirmDialog } from './ui.jsx';
import { TRASH_DAYS } from '../lib/constants.js';

export default function DeleteItemDialog({ ids, onClose, onDone }) {
  const { data, softDelete, restoreItems, toast } = useApp();
  const open = ids?.length > 0;

  const counts = useMemo(() => {
    if (!open) return null;
    const set = new Set(ids);
    const c = (t) => data[t].filter((r) => set.has(r.item_id)).length;
    return { subtasks: c('subtasks'), comments: c('comments'), photos: c('item_photos'), gifts: c('wishlist_entries'), votes: c('item_votes') };
  }, [ids, data, open]);

  if (!open) return null;
  const title = ids.length === 1 ? `Delete “${data.items.find((i) => i.id === ids[0])?.title ?? 'item'}”?` : `Delete ${ids.length} items?`;
  const parts = counts && Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${n === 1 ? k.replace(/s$/, '') : k}`);

  return (
    <ConfirmDialog open title={title} danger confirmLabel="Move to Trash" onClose={onClose}
      onConfirm={async () => {
        const list = [...ids];
        await softDelete(list);
        onDone?.();
        toast(list.length > 1 ? `${list.length} items moved to Trash` : 'Moved to Trash', 'info', { label: 'Undo', onClick: () => restoreItems(list) });
      }}>
      <p className="muted text-[15px]">It goes to <b>Trash</b> for {TRASH_DAYS} days, then disappears for good.</p>
      {parts?.length > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          ⚠️ This also removes its {parts.join(', ')} when permanently deleted.
        </p>
      )}
    </ConfirmDialog>
  );
}
