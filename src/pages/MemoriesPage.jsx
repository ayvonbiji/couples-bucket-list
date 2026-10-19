// Memories: completed dreams as a calm gallery, plus every photo.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { fmtDate, sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, SegmentedControl, Stars, StoredImage } from '../components/ui.jsx';
import { CategoryPlaceholder } from '../components/icons.jsx';
import { Lightbox } from '../components/PhotoAlbum.jsx';

export default function MemoriesPage() {
  const { data, me, partner, categories } = useApp();
  const [year, setYear] = useState('all');
  const [cat, setCat] = useState('all');
  const [person, setPerson] = useState('any');
  const all = useDecoratedItems();
  const [mode, setMode] = useState('memories');
  const [viewer, setViewer] = useState(null);

  const allDone = useMemo(() => sortBy(all.filter((i) => i.status === 'Completed'), (i) => i.completed_at || '', -1), [all]);
  const years = [...new Set(allDone.map((i) => (i.completed_at || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  // Partner filter: who created the dream (one shared list — no separate sides).
  const done = useMemo(() => allDone.filter((i) =>
    (year === 'all' || (i.completed_at || '').startsWith(year)) &&
    (cat === 'all' || i.category === cat) &&
    (person === 'any' || i.creator_id === (person === 'me' ? me.id : partner?.id))), [allDone, year, cat, person, me.id, partner?.id]);
  const photos = useMemo(() => {
    const ids = new Set(done.map((i) => i.id));
    const manual = new Set(data.journal_entries.filter((j) => !j.item_id).map((j) => j.id));
    return sortBy(data.item_photos.filter((p) => ids.has(p.item_id) || manual.has(p.journal_entry_id)), (p) => p.created_at, -1);
  }, [done, data]);

  return (
    <div>
      <PageHeader title="Memories" subtitle={`${done.length} dream${done.length === 1 ? '' : 's'} come true`} />
      <div className="space-y-5 px-5 pb-10">
        <SegmentedControl value={mode} onChange={setMode} options={[{ value: 'memories', label: 'Memories' }, { value: 'photos', label: `Photos${photos.length ? ` · ${photos.length}` : ''}` }]} />

        {allDone.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <select className="input py-2 text-[14px]" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
              <option value="all">All years</option>{years.map((y) => <option key={y}>{y}</option>)}
            </select>
            <select className="input py-2 text-[14px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select className="input py-2 text-[14px]" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Partner">
              <option value="any">Both of us</option><option value="me">Created by {me.display_name || 'me'}</option>{partner && <option value="partner">Created by {partner.display_name}</option>}
            </select>
          </div>
        )}
        {allDone.length > 0 && done.length === 0 ? (
          <EmptyState icon={Images} title="No memories match" body="Try another year, category or partner." />
        ) : done.length === 0 ? (
          <EmptyState icon={Images} title="No memories yet" body="When you complete a dream, it lands here with its photos and your note." action={<Link to="/list" className="btn-soft">Choose something to do</Link>} />
        ) : mode === 'memories' ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
            {done.map((i) => (
              <Link key={i.id} to={`/item/${i.id}`} className="group block animate-fade-up">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-cream-100 dark:bg-ink-900">
                  <StoredImage path={i._cover} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" fallback={<CategoryPlaceholder category={i.category} size={28} />} />
                </div>
                <h3 className="mt-2.5 line-clamp-1 text-[15px] font-medium">{i.title}</h3>
                <p className="muted text-[13px]">{fmtDate(i.completed_at, 'MMMM yyyy')}</p>
                {i.completion_note && <p className="title-serif mt-1 line-clamp-2 text-[16px] italic leading-snug text-ink-700 dark:text-[#D4CFD5]">“{i.completion_note}”</p>}
                <p className="muted mt-1 flex flex-wrap items-center gap-x-2 text-[12px]">
                  {i.location_name && <span className="truncate">{i.location_name}</span>}
                  {(i.satisfaction || i.would_do_again) && <Stars value={i.satisfaction || i.would_do_again} readOnly size={11} />}
                </p>
                {i.favourite_memory && <p className="muted mt-0.5 line-clamp-2 text-[12px]">Favourite: {i.favourite_memory}</p>}
              </Link>
            ))}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState icon={Images} title="No photos yet" body="Add photos to a completed dream to see them here." />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map((p, k) => (
              <button key={p.id} className="aspect-square overflow-hidden rounded-md" onClick={() => setViewer(k)} aria-label={p.caption || `Photo ${k + 1}`}>
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
