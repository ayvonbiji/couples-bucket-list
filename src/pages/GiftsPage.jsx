// Gift ideas: "For me" (hints from my partner, visible only after reveal) and "I'm planning" (my secret list).
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, Segmented, Toggle } from '../components/ui.jsx';
import { GiftForm, GiftRow } from '../components/Wishlist.jsx';

export default function GiftsPage() {
  const { data, me, partner } = useApp();
  const [tab, setTab] = useState('forMe');
  const [showGifted, setShowGifted] = useState(false);
  const [adding, setAdding] = useState(false);

  const all = sortBy(data.wishlist_entries, (g) => g.created_at, -1).filter((g) => showGifted || !g.is_gifted);
  // The server/visibility layer already removed hidden gifts that aren't revealed yet.
  const forMe = all.filter((g) => g.for_user_id === me.id && g.created_by !== me.id);
  const mine = all.filter((g) => g.created_by === me.id);
  const list = tab === 'forMe' ? forMe : mine;

  return (
    <div>
      <PageHeader title="Gift ideas 🎁" back actions={<button className="btn-primary px-3" onClick={() => setAdding(true)}><Plus size={17} /> Idea</button>} />
      <div className="space-y-3 px-4 pb-6">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'forMe', label: `💝 For me (${forMe.length})` }, { value: 'mine', label: `🤫 I'm planning (${mine.length})` }]} />
        <p className="muted text-sm">
          {tab === 'forMe'
            ? `Hints and gifts ${partner?.display_name || 'your partner'} saved for you. Hidden ones appear here on their reveal date.`
            : 'Ideas you added. Hidden ones stay invisible to your partner until their reveal date.'}
        </p>
        <Toggle checked={showGifted} onChange={setShowGifted} label="Show already gifted" />
        {list.length ? <ul className="space-y-2">{list.map((g) => <GiftRow key={g.id} g={g} showItem />)}</ul> : (
          <EmptyState emoji={tab === 'forMe' ? '🎀' : '🛍️'} title={tab === 'forMe' ? 'Nothing revealed yet' : 'No gift ideas yet'}
            body={tab === 'forMe' ? 'Patience… good things are coming 😉' : 'Jot down that thing they mentioned once — future you will thank you.'} />
        )}
      </div>
      {adding && <GiftForm open onClose={() => setAdding(false)} />}
    </div>
  );
}
