// Secret Fantasy — a private journal for two. Private entries are visible only to their author.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Lock, Plus, Settings2, Shield } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useFantasy } from './FantasyLayout.jsx';
import { reactionLabel, statusLabel } from '../lib/fantasy.js';
import { fmtDate, sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, SegmentedControl } from '../components/ui.jsx';
import LockSettings from './LockSettings.jsx';

export default function FantasyListPage() {
  const { me, partner, personLabel } = useApp();
  const { data, responsesFor, lock, hasLock } = useFantasy();
  const nav = useNavigate();
  const [tab, setTab] = useState('private');
  const [settings, setSettings] = useState(false);

  const lists = useMemo(() => {
    const all = sortBy(data.fantasies, (f) => f.updated_at || f.created_at, -1);
    return {
      private: all.filter((f) => f.status === 'private' && f.created_by === me.id),
      shared: all.filter((f) => f.status !== 'private' && !f.on_wishlist),
      wishlist: all.filter((f) => f.on_wishlist),
    };
  }, [data.fantasies, me.id]);
  const list = lists[tab];

  return (
    <div>
      <PageHeader title="Secret Fantasy" subtitle="Only for the two of you" back="/more" actions={<>
        {hasLock && <button className="icon-btn" onClick={lock} aria-label="Lock now"><Lock size={18} strokeWidth={1.6} /></button>}
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Privacy settings"><Settings2 size={19} strokeWidth={1.6} /></button>
        <button className="icon-btn" onClick={() => nav('/fantasy/new')} aria-label="New fantasy"><Plus size={22} strokeWidth={1.6} /></button>
      </>} />

      <div className="space-y-5 px-5 pb-10">
        <SegmentedControl value={tab} onChange={setTab} options={[
          { value: 'private', label: `Private${lists.private.length ? ` · ${lists.private.length}` : ''}` },
          { value: 'shared', label: `Shared${lists.shared.length ? ` · ${lists.shared.length}` : ''}` },
          { value: 'wishlist', label: `Wishlist${lists.wishlist.length ? ` · ${lists.wishlist.length}` : ''}` },
        ]} />

        <p className="muted flex items-start gap-2 text-[13px] leading-snug">
          <Shield size={14} strokeWidth={1.6} className="mt-[2px] shrink-0" />
          {tab === 'private' && 'Only you can see these. Nothing is shared until you choose to share it.'}
          {tab === 'shared' && `Visible to you and ${partner?.display_name || 'your partner'}. Respond, talk it through, and agree only when you’re both comfortable.`}
          {tab === 'wishlist' && 'Things you both want to explore. Either of you can remove anything, any time.'}
        </p>

        {list.length === 0 ? (
          <EmptyState icon={Lock}
            title={tab === 'private' ? 'Your private page is empty' : tab === 'shared' ? 'Nothing shared yet' : 'Your wishlist is empty'}
            body={tab === 'private' ? 'Write down a wish, an idea, something you’d love to try. It stays yours until you share it.'
              : tab === 'shared' ? 'When one of you shares something, it appears here.'
              : 'Add a shared fantasy here once you’re both interested.'}
            action={tab === 'private' && <button className="btn-dark" onClick={() => nav('/fantasy/new')}>Write one</button>} />
        ) : (
          <ul className="list-group hairline">
            {list.map((f) => {
              const theirs = responsesFor(f.id).find((r) => r.user_id !== f.created_by);
              const mine = f.created_by === me.id;
              return (
                <li key={f.id}>
                  <Link to={`/fantasy/${f.id}`} className="list-row items-start py-4">
                    <span className="min-w-0 flex-1">
                      <span className="title-serif block truncate text-[21px] leading-tight">{f.title}</span>
                      <span className="muted mt-1 block text-[13px]">
                        {f.category} · {statusLabel(f.status)}
                        {!mine && ` · from ${personLabel(f.created_by)}`}
                        {f.status !== 'private' && theirs?.reaction && ` · ${mine ? (partner?.display_name || 'Partner') : 'You'}: ${reactionLabel(theirs.reaction)}`}
                        {f.planned_date && ` · ${fmtDate(f.planned_date, 'd MMM')}`}
                      </span>
                    </span>
                    <ChevronRight size={16} className="mt-1.5 text-ink-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {settings && <LockSettings onClose={() => setSettings(false)} />}
    </div>
  );
}
