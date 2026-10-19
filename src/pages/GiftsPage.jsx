// Gift ideas: "For me" (hints from my partner, visible only after reveal) and "I'm planning" (my secret list).
import { useState } from 'react';
import { Gift, Plus } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, SegmentedControl, Toggle } from '../components/ui.jsx';
import { GiftForm, GiftRow } from '../components/Wishlist.jsx';

export default function GiftsPage() {
  const { data, me, partner } = useApp();
  const [tab, setTab] = useState('forMe');
  const [showGifted, setShowGifted] = useState(false);
  const [adding, setAdding] = useState(false);

  const all = sortBy(data.wishlist_entries, (g) => g.created_at, -1).filter((g) => showGifted || !g.is_gifted);
  // Hidden gifts that aren't revealed yet were already removed by the server (RLS) / visibility layer.
  const forMe = all.filter((g) => g.for_user_id === me.id && g.created_by !== me.id);
  const mine = all.filter((g) => g.created_by === me.id);
  const list = tab === 'forMe' ? forMe : mine;

  return (
    <div>
      <PageHeader title="Gift ideas" back actions={<button className="icon-btn" onClick={() => setAdding(true)} aria-label="New gift idea"><Plus size={22} strokeWidth={1.6} /></button>} />
      <div className="space-y-4 px-5 pb-8">
        <SegmentedControl value={tab} onChange={setTab} options={[{ value: 'forMe', label: `For me${forMe.length ? ` · ${forMe.length}` : ''}` }, { value: 'mine', label: `I’m planning${mine.length ? ` · ${mine.length}` : ''}` }]} />
        <p className="muted text-[14px]">
          {tab === 'forMe'
            ? `Hints ${partner?.display_name || 'your partner'} saved for you. Hidden ones appear here on their reveal date.`
            : 'Your ideas. Hidden ones stay invisible to your partner until their reveal date.'}
        </p>
        {list.length ? <ul className="list-group hairline px-4">{list.map((g) => <GiftRow key={g.id} g={g} showItem />)}</ul> : (
          <EmptyState icon={Gift} title={tab === 'forMe' ? 'Nothing revealed yet' : 'No gift ideas yet'}
            body={tab === 'forMe' ? 'Good things are on their way.' : 'Note down that thing they mentioned once — future you will thank you.'} />
        )}
        <div className="list-group px-4"><Toggle checked={showGifted} onChange={setShowGifted} label="Show already gifted" /></div>
      </div>
      {adding && <GiftForm open onClose={() => setAdding(false)} />}
    </div>
  );
}
