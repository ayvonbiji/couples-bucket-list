// Secret Fantasy — the same checklist idea as the bucket list, in a private journal.
// Private entries are visible only to their author (enforced by the database).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Lock, Plus, Settings2, Shield } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useFantasy } from './FantasyLayout.jsx';
import { FANTASY_STATUSES, reactionLabel, statusBlockedReason, statusLabel } from '../lib/fantasy.js';
import { fmtDate, sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, ProgressBar, SegmentedControl, Toggle } from '../components/ui.jsx';
import { CompleteCheck } from '../components/ItemViews.jsx';
import LockSettings from './LockSettings.jsx';

export default function FantasyListPage() {
  const { me, partner, personLabel, fantasyCategories, toast } = useApp();
  const { data, responsesFor, memberIds, lock, hasLock, setStatus } = useFantasy();
  const nav = useNavigate();
  const [tab, setTab] = useState('mine');
  const [cat, setCat] = useState('all');
  const [status, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [settings, setSettings] = useState(false);

  const hiddenForMe = (f) => responsesFor(f.id).some((r) => r.user_id === me.id && r.hidden);
  const active = useMemo(() => data.fantasies.filter((f) => showArchived || (f.status !== 'archived' && !hiddenForMe(f))), [data, showArchived]); // eslint-disable-line react-hooks/exhaustive-deps
  const lists = useMemo(() => {
    const all = sortBy(active, (f) => f.updated_at || f.created_at, -1);
    return {
      mine: all.filter((f) => f.visibility === 'private' && f.created_by === me.id),
      shared: all.filter((f) => f.visibility === 'shared'),
      wishlist: all.filter((f) => f.on_wishlist),
    };
  }, [active, me.id]);
  const list = lists[tab].filter((f) => (cat === 'all' || f.category === cat) && (status === 'all' || f.status === status));
  const visible = active.filter((f) => f.status !== 'archived');
  const doneCount = visible.filter((f) => f.status === 'completed').length;

  async function toggle(f) {
    if (f.status === 'completed') return setStatus(f.id, 'saved');
    const reason = statusBlockedReason(f, 'completed', responsesFor(f.id), memberIds);
    if (reason) return toast(reason, 'error');
    if (await setStatus(f.id, 'completed')) nav(`/fantasy/${f.id}?experience=1`);
  }

  return (
    <div>
      <PageHeader title="Secret Fantasy" subtitle="Only for the two of you" back="/more" actions={<>
        {hasLock && <button className="icon-btn" onClick={lock} aria-label="Lock now"><Lock size={18} strokeWidth={1.6} /></button>}
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Privacy settings"><Settings2 size={19} strokeWidth={1.6} /></button>
        <button className="icon-btn" onClick={() => nav('/fantasy/new')} aria-label="New fantasy"><Plus size={22} strokeWidth={1.6} /></button>
      </>} />

      <div className="space-y-5 px-5 pb-10">
        {visible.length > 0 && (
          <div>
            <div className="muted mb-1.5 flex justify-between text-[13px]"><span>{doneCount} of {visible.length} completed</span><span>{lists.wishlist.length} on your wishlist</span></div>
            <ProgressBar value={doneCount} max={visible.length} className="h-1" />
          </div>
        )}

        <SegmentedControl value={tab} onChange={setTab} options={[
          { value: 'mine', label: `Private${lists.mine.length ? ` · ${lists.mine.length}` : ''}` },
          { value: 'shared', label: `Shared${lists.shared.length ? ` · ${lists.shared.length}` : ''}` },
          { value: 'wishlist', label: `Wishlist${lists.wishlist.length ? ` · ${lists.wishlist.length}` : ''}` },
        ]} />

        <div className="grid grid-cols-2 gap-2">
          <select className="input py-2 text-[14px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {fantasyCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select className="input py-2 text-[14px]" value={status} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
            <option value="all">Any status</option>
            {FANTASY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <p className="muted flex items-start gap-2 text-[13px] leading-snug">
          <Shield size={14} strokeWidth={1.6} className="mt-[2px] shrink-0" />
          {tab === 'mine' && 'Only you can see these. Nothing is shared until you choose to share it.'}
          {tab === 'shared' && `Visible to you and ${partner?.display_name || 'your partner'}. Sharing is not agreement — each of you responds in your own time.`}
          {tab === 'wishlist' && 'Things you both want to explore. Either of you can remove anything, any time.'}
        </p>

        {list.length === 0 ? (
          <EmptyState icon={Lock}
            title={tab === 'mine' ? 'Your private page is empty' : tab === 'shared' ? 'Nothing shared yet' : 'Your wishlist is empty'}
            body={tab === 'mine' ? 'Write down a wish, an idea, something you’d love to try. It stays yours until you share it.'
              : tab === 'shared' ? 'When one of you shares something, it appears here.' : 'Add a shared fantasy here once you’re both interested.'}
            action={tab === 'mine' && <button className="btn-dark" onClick={() => nav('/fantasy/new')}>Write one</button>} />
        ) : (
          <ul className="list-group hairline">
            {list.map((f) => {
              const theirs = responsesFor(f.id).find((r) => r.user_id !== f.created_by);
              const mine = f.created_by === me.id;
              return (
                <li key={f.id} className="flex items-start gap-3 px-4 py-4">
                  <span className="pt-1"><CompleteCheck done={f.status === 'completed'} onToggle={() => toggle(f)} label={f.status === 'completed' ? `Reopen ${f.title}` : `Mark ${f.title} completed`} /></span>
                  <Link to={`/fantasy/${f.id}`} className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className={`title-serif block truncate text-[21px] leading-tight ${f.status === 'completed' || f.status === 'archived' ? 'text-ink-500' : ''}`}>{f.title}</span>
                      <span className="muted mt-1 block text-[13px]">
                        {f.category} · {statusLabel(f.status)}
                        {!mine && ` · from ${personLabel(f.created_by)}`}
                        {f.visibility === 'shared' && theirs?.reaction && ` · ${mine ? (partner?.display_name || 'Partner') : 'You'}: ${reactionLabel(theirs.reaction)}`}
                        {f.completed_at ? ` · ${fmtDate(f.completed_at, 'd MMM yyyy')}` : f.planned_date ? ` · ${fmtDate(f.planned_date, 'd MMM')}` : ''}
                      </span>
                    </span>
                    <ChevronRight size={16} className="mt-1.5 text-ink-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="list-group px-4"><Toggle checked={showArchived} onChange={setShowArchived} label="Show archived and hidden" /></div>
      </div>
      {settings && <LockSettings onClose={() => setSettings(false)} />}
    </div>
  );
}
