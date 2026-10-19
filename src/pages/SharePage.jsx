// Public read-only view of the list (when sharing is switched on). No editing, no private data.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBackend } from '../data/backend.js';
import { CATEGORY_META } from '../lib/constants.js';
import { fmtDate } from '../lib/utils.js';
import { StatusPill } from '../components/ItemViews.jsx';
import { EmptyState, Spinner } from '../components/ui.jsx';

export default function SharePage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    getBackend()
      .then((b) => b.sharedList(token))
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((e) => setState({ loading: false, data: null, error: e.message }));
  }, [token]);

  if (state.loading) return <div className="grid min-h-dvh place-items-center text-rose-600"><Spinner /></div>;
  if (!state.data) return <EmptyState emoji="🔒" title="This list isn't shared" body="The link may be off or incorrect." />;

  const { name, items } = state.data;
  const done = items.filter((i) => i.status === 'Completed');
  const open = items.filter((i) => i.status !== 'Completed');
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 text-center">
        <div className="text-4xl">💞</div>
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="muted text-sm">{items.length} dreams · {done.length} come true · read-only</p>
      </header>
      {[['Still dreaming', open], ['Done together', done]].map(([label, list]) => list.length > 0 && (
        <section key={label} className="mb-6">
          <h2 className="section-title mb-2">{label}</h2>
          <ul className="space-y-2">
            {list.map((i) => (
              <li key={i.id} className="card flex items-start gap-3 p-3">
                <span className="text-2xl" aria-hidden>{CATEGORY_META[i.category]?.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans font-bold">{i.title}</h3>
                  {i.description && <p className="muted mt-0.5 text-sm">{i.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <StatusPill status={i.status} />
                    {i.location_name && <span className="muted">📍 {i.location_name}</span>}
                    {i.completed_at ? <span className="muted">✓ {fmtDate(i.completed_at)}</span> : i.start_date ? <span className="muted">📅 {fmtDate(i.start_date)}</span> : i.timeframe ? <span className="muted">{i.timeframe}</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted text-center text-xs">Made with Our Bucket List 💕</p>
    </main>
  );
}
