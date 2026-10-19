// Recently deleted: restore or delete forever. Auto-purged after 30 days.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { useApp } from '../store/AppStore.jsx';
import { TRASH_DAYS } from '../lib/constants.js';
import { sortBy } from '../lib/utils.js';
import { ConfirmDialog, EmptyState, PageHeader } from '../components/ui.jsx';
import { CategoryDot } from '../components/icons.jsx';

export default function TrashPage() {
  const { trash, data, restoreItems, permanentDelete, emptyTrash } = useApp();
  const [confirm, setConfirm] = useState(null); // { ids } | 'all'
  const list = sortBy(trash, (i) => i.deleted_at, -1);
  const daysLeft = (i) => Math.max(0, TRASH_DAYS - differenceInCalendarDays(new Date(), new Date(i.deleted_at)));
  const counts = (id) => ['subtasks', 'comments', 'item_photos', 'wishlist_entries'].reduce((n, t) => n + data[t].filter((r) => r.item_id === id).length, 0);

  return (
    <div>
      <PageHeader title="Recently deleted" subtitle={`Removed for good after ${TRASH_DAYS} days`} back
        actions={list.length > 0 && <button className="btn-ghost min-h-[36px] px-3 text-[14px] text-rose-700 dark:text-rose-300" onClick={() => setConfirm('all')}>Empty</button>} />
      <div className="px-5 pb-8">
        {list.length === 0 ? <EmptyState icon={Trash2} title="Nothing here" body="Deleted dreams wait here for 30 days in case you change your mind." /> : (
          <ul className="list-group hairline">
            {list.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-medium">{i.title}</h3>
                  <p className="mt-0.5 flex items-center gap-2"><CategoryDot category={i.category} /><span className="muted text-[13px]">· {daysLeft(i)} days left{counts(i.id) ? ` · ${counts(i.id)} attachments` : ''}</span></p>
                </div>
                <button className="btn-link" onClick={() => restoreItems([i.id])}>Restore</button>
                <button className="icon-btn h-9 w-9" onClick={() => setConfirm({ ids: [i.id] })} aria-label={`Delete ${i.title} forever`}><Trash2 size={16} strokeWidth={1.6} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog open={!!confirm} danger confirmLabel="Delete forever"
        title={confirm === 'all' ? `Delete ${list.length} dreams forever?` : 'Delete forever?'}
        message="This permanently removes the dream with all its checklist steps, notes, photos, gift ideas and votes. It can’t be undone."
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === 'all' ? emptyTrash() : permanentDelete(confirm.ids))} />
    </div>
  );
}
