// Budget tracker: estimated vs actual, savings progress and what's left — per currency.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { fmtMoney, sortBy } from '../lib/utils.js';
import { EmptyState, PageHeader, ProgressBar, SegmentedControl } from '../components/ui.jsx';
import { CategoryDot } from '../components/icons.jsx';

export default function BudgetPage() {
  const { items, workspace } = useApp();
  const priced = items.filter((i) => i.est_cost || i.actual_cost || i.savings_target);
  const currencies = [...new Set(priced.map((i) => i.currency || workspace.currency))];
  const [cur, setCur] = useState(currencies.includes(workspace.currency) ? workspace.currency : currencies[0] || workspace.currency);
  const [scope, setScope] = useState('open');

  const list = useMemo(() => priced.filter((i) => (i.currency || workspace.currency) === cur), [priced, cur, workspace.currency]);
  const totals = useMemo(() => {
    const open = list.filter((i) => i.status !== 'Completed');
    const done = list.filter((i) => i.status === 'Completed');
    const sum = (arr, f) => arr.reduce((s, i) => s + Number(f(i) || 0), 0);
    const planned = sum(open, (i) => i.est_cost);
    const saved = sum(open, (i) => i.savings_saved);
    const target = sum(open, (i) => i.savings_target || i.est_cost);
    return {
      planned, saved, target, remaining: Math.max(0, target - saved),
      spent: sum(done, (i) => i.actual_cost ?? i.est_cost),
      estDone: sum(done, (i) => i.est_cost),
    };
  }, [list]);
  const rows = sortBy(list.filter((i) => (scope === 'open' ? i.status !== 'Completed' : i.status === 'Completed')), (i) => Number(i.est_cost || i.actual_cost || 0), -1);

  return (
    <div>
      <PageHeader title="Budget" back />
      <div className="space-y-6 px-5 pb-10">
        {!priced.length ? (
          <EmptyState icon={Wallet} title="No costs yet" body="Add an estimated cost or savings goal to a dream to track it here." />
        ) : (
          <>
            {currencies.length > 1 && <SegmentedControl value={cur} onChange={setCur} options={currencies.map((c) => ({ value: c, label: c }))} />}
            <section className="list-group">
              <div className="grid grid-cols-2 divide-x divide-line dark:divide-line-dark">
                <div className="px-4 py-4"><p className="muted text-[13px]">Still to fund</p><p className="title-serif mt-1 text-[28px] leading-none">{fmtMoney(totals.remaining, cur)}</p></div>
                <div className="px-4 py-4"><p className="muted text-[13px]">Spent on memories</p><p className="title-serif mt-1 text-[28px] leading-none">{fmtMoney(totals.spent, cur)}</p></div>
              </div>
              <div className="border-t border-line px-4 py-3 dark:border-line-dark">
                <div className="flex justify-between text-[13px]"><span className="muted">Saved for upcoming dreams</span><span>{fmtMoney(totals.saved, cur)} of {fmtMoney(totals.target, cur)}</span></div>
                <ProgressBar value={totals.saved} max={totals.target || 1} className="mt-2" />
              </div>
              <p className="muted border-t border-line px-4 py-2.5 text-[13px] dark:border-line-dark">
                Planned {fmtMoney(totals.planned, cur)} · Completed dreams estimated {fmtMoney(totals.estDone, cur)}, cost {fmtMoney(totals.spent, cur)}
              </p>
            </section>

            <SegmentedControl value={scope} onChange={setScope} options={[{ value: 'open', label: 'Upcoming' }, { value: 'done', label: 'Completed' }]} />
            <ul className="list-group hairline">
              {rows.map((i) => {
                const target = Number(i.savings_target || i.est_cost || 0), saved = Number(i.savings_saved || 0);
                return (
                  <li key={i.id}>
                    <Link to={`/item/${i.id}`} className="block px-4 py-3 transition hover:bg-cream-50 dark:hover:bg-white/[.03]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px]">{i.title}</span>
                        <span className="shrink-0 text-[14px]">{scope === 'open' ? fmtMoney(i.est_cost, cur) || '—' : fmtMoney(i.actual_cost ?? i.est_cost, cur)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3">
                        <CategoryDot category={i.category} />
                        <span className="muted text-[12px]">
                          {scope === 'open'
                            ? (target ? `${fmtMoney(saved, cur)} saved · ${fmtMoney(Math.max(0, target - saved), cur)} to go` : '')
                            : (i.actual_cost && i.est_cost ? `estimated ${fmtMoney(i.est_cost, cur)}` : '')}
                        </span>
                      </div>
                      {scope === 'open' && target > 0 && <ProgressBar value={saved} max={target} className="mt-2 h-1" />}
                    </Link>
                  </li>
                );
              })}
              {!rows.length && <li className="muted px-4 py-6 text-center text-[14px]">Nothing here.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
