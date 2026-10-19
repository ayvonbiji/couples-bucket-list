// Memories gallery: completed items (and every photo from them).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { CATEGORY_META } from '../lib/constants.js';
import { fmtDate, sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, Segmented, Stars, StoredImage } from '../components/ui.jsx';
import { Lightbox } from '../components/PhotoAlbum.jsx';

export default function MemoriesPage() {
  const { data } = useApp();
  const all = useDecoratedItems();
  const [mode, setMode] = useState('memories');
  const [viewer, setViewer] = useState(null);

  const done = useMemo(() => sortBy(all.filter((i) => i.status === 'Completed'), (i) => i.completed_at || '', -1), [all]);
  const photos = useMemo(() => {
    const ids = new Set(done.map((i) => i.id));
    const manual = new Set(data.journal_entries.filter((j) => !j.item_id).map((j) => j.id));
    return sortBy(data.item_photos.filter((p) => ids.has(p.item_id) || manual.has(p.journal_entry_id)), (p) => p.created_at, -1);
  }, [done, data]);

  return (
    <div>
      <PageHeader title="Memories" subtitle={`${done.length} dreams come true · ${photos.length} photos`} />
      <div className="space-y-4 px-4 pb-6">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'memories', label: '✨ Memories' }, { value: 'photos', label: '📸 All photos' }]} />

        {done.length === 0 ? (
          <EmptyState emoji="🌅" title="No memories yet" body="When you complete an item, it lands here with its photos and your journal note." action={<Link to="/list" className="btn-primary">Pick something to do</Link>} />
        ) : mode === 'memories' ? (
          <div className="columns-2 gap-3 [column-fill:_balance]">
            {done.map((i) => {
              const meta = CATEGORY_META[i.category] || CATEGORY_META.Other;
              return (
                <Link key={i.id} to={`/item/${i.id}`} className="card mb-3 block break-inside-avoid overflow-hidden animate-fade-up">
                  <div style={{ background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}10)` }}>
                    <StoredImage path={i._cover} className="w-full" style={{ aspectRatio: '4 / 5' }} fallback={<div className="grid h-32 place-items-center text-5xl">{meta.emoji}</div>} />
                  </div>
                  <div className="p-3">
                    <h3 className="font-sans text-[15px] font-bold leading-snug">{i.title}</h3>
                    <p className="muted text-xs">{fmtDate(i.completed_at)}{i._photoCount ? ` · ${i._photoCount} 📸` : ''}</p>
                    {i.would_do_again && <div className="mt-1"><Stars value={i.would_do_again} readOnly size={13} /></div>}
                    {i.completion_note && <p className="mt-1.5 line-clamp-3 font-display text-sm italic">“{i.completion_note}”</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState emoji="📷" title="No photos yet" body="Add photos to a completed item's album." />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map((p, k) => (
              <button key={p.id} className="aspect-square overflow-hidden rounded-lg" onClick={() => setViewer(k)}>
                <StoredImage path={p.storage_path} alt={p.caption || ''} className="h-full w-full" />
              </button>
            ))}
          </div>
        )}
      </div>
      {viewer !== null && <Lightbox photos={photos} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
