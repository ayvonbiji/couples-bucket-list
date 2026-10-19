// Public read-only view of the list (when sharing is switched on). No editing, no private data.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { getBackend } from '../data/backend.js';
import { fmtDate } from '../lib/utils.js';
import { StatusText } from '../components/ItemViews.jsx';
import { CategoryDot } from '../components/icons.jsx';
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

  if (state.loading) return <div className="grid min-h-dvh place-items-center text-rose-500"><Spinner /></div>;
  if (!state.data) return <EmptyState icon={Lock} title="This list isn’t shared" body="The link may be turned off or incorrect." />;

  const { name, items } = state.data;
  const done = items.filter((i) => i.status === 'Completed');
  const open = items.filter((i) => i.status !== 'Completed');
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <header className="mb-10 text-center">
        <h1 className="title-serif text-[40px] leading-tight">{name}</h1>
        <p className="muted mt-1 text-[14px]">{items.length} dreams · {done.length} come true</p>
      </header>
      {[['Still dreaming', open], ['Done together', done]].map(([label, list]) => list.length > 0 && (
        <section key={label} className="mb-8">
          <h2 className="section-title mb-2.5">{label}</h2>
          <ul className="list-group hairline">
            {list.map((i) => (
              <li key={i.id} className="px-4 py-3.5">
                <h3 className="text-[15px] font-medium">{i.title}</h3>
                {i.description && <p className="muted mt-0.5 text-[14px]">{i.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <CategoryDot category={i.category} />
                  <StatusText status={i.status} />
                  {i.location_name && <span className="muted text-[13px]">{i.location_name}</span>}
                  {i.completed_at ? <span className="muted text-[13px]">{fmtDate(i.completed_at)}</span> : i.start_date ? <span className="muted text-[13px]">{fmtDate(i.start_date)}</span> : i.timeframe ? <span className="muted text-[13px]">{i.timeframe}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted text-center text-[12px]">Shared read-only from Our Bucket List</p>
    </main>
  );
}
