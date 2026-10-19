// Trash / Recently Deleted: restore or delete forever. Auto-purged after 30 days.
import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { useApp } from '../store/AppStore.jsx';
import { TRASH_DAYS, CATEGORY_META } from '../lib/constants.js';
import { sortBy } from '../lib/utils.js';
import { ConfirmDialog, EmptyState, PageHeader } from '../components/ui.jsx';

export default function TrashPage() {
  const { trash, data, restoreItems, permanentDelete, emptyTrash } = useApp();
  const [confirm, setConfirm] = useState(null); // { ids } | 'all'
  const list = sortBy(trash, (i) => i.deleted_at, -1);
  const daysLeft = (i) => Math.max(0, TRASH_DAYS - differenceInCalendarDays(new Date(), new Date(i.deleted_at)));
  const counts = (id) => ['subtasks', 'comments', 'item_photos', 'wishlist_entries'].reduce((n, t) => n + data[t].filter((r) => r.item_id === id).length, 0);

  return (
    <div>
      <PageHeader title="Recently deleted" subtitle={`Items are removed for good after ${TRASH_DAYS} days`} back
        actions={list.length > 0 && <button className="btn-ghost text-red-600" onClick={() => setConfirm('all')}>Empty</button>} />
      <div className="space-y-2 px-4 pb-6">
        {list.length === 0 ? <EmptyState emoji="🧺" title="Trash is empty" body="Deleted items wait here for 30 days in case you change your mind." /> : list.map((i) => (
          <div key={i.id} className="card flex items-center gap-3 p-3">
            <span className="text-2xl" aria-hidden>{CATEGORY_META[i.category]?.emoji}</span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-sans font-bold">{i.title}</h3>
              <p className="muted text-xs">{daysLeft(i)} days left{counts(i.id) ? ` · ${counts(i.id)} attached things` : ''}</p>
            </div>
            <button className="btn-soft px-3 py-1.5" onClick={() => restoreItems([i.id])}><RotateCcw size={15} /> Restore</button>
            <button className="icon-btn h-9 w-9 text-red-600" onClick={() => setConfirm({ ids: [i.id] })} aria-label={`Delete ${i.title} forever`}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      <ConfirmDialog open={!!confirm} danger confirmLabel="Delete forever"
        title={confirm === 'all' ? `Empty trash (${list.length} items)?` : 'Delete forever?'}
        message="This permanently removes the item with all its subtasks, comments, photos, gift ideas and votes. It can't be undone."
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === 'all' ? emptyTrash() : permanentDelete(confirm.ids))} />
    </div>
  );
}
