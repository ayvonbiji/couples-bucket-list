// Home: a calm summary. Essentials first; insights tucked into expandable sections.
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Bell, CalendarDays, CalendarPlus, ChevronRight, Dices, Gift, PieChart, Plus, UserPlus } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { activityFeed, partnerSnapshot, summary, topPicks, upcomingItems, yearInReview } from '../lib/stats.js';
import { occurrenceTitle, upcomingDates } from '../lib/recurrence.js';
import { CATEGORIES, CATEGORY_META, STATUSES, STATUS_META } from '../lib/constants.js';
import { countdownLabel, fmtDate, fmtMoney, timeAgo } from '../lib/utils.js';
import { Avatar, Disclosure, EmptyState, ProgressBar, StoredImage } from '../components/ui.jsx';
import { ItemCard } from '../components/ItemViews.jsx';
import { DateKindIcon } from '../components/icons.jsx';

export default function DashboardPage() {
  const { me, partner, workspace, data, reminders, personLabel } = useApp();
  const items = useDecoratedItems();
  const nav = useNavigate();

  const s = useMemo(() => summary(items), [items]);
  const picks = useMemo(() => topPicks(items, data.item_votes, me.id, partner?.id, 5).filter((i) => i._votes.mutual || i._votes.score >= 60), [items, data.item_votes, me.id, partner?.id]);
  const upcoming = useMemo(() => upcomingItems(items, 3), [items]);
  const upcomingCount = useMemo(() => upcomingItems(items, 999).length, [items]);
  const dates = useMemo(() => upcomingDates(data.important_dates, 3), [data.important_dates]);
  const feed = useMemo(() => activityFeed({ ...data, items }, 8), [data, items]);
  const yir = useMemo(() => yearInReview({ ...data, items }), [data, items]);
  const revealedGifts = data.wishlist_entries.filter((g) => g.for_user_id === me.id && g.created_by !== me.id && !g.is_gifted).length;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 px-5 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)]">
      {/* Greeting */}
      <header className="flex items-start justify-between animate-fade-up">
        <div>
          <p className="muted text-[14px]">{greeting}, {me.display_name}</p>
          <h1 className="title-serif mt-0.5 text-[40px] leading-[1.05]">Our Bucket List</h1>
        </div>
        <Link to="/settings" className="mt-1 flex -space-x-2" aria-label="Partner settings">
          <Avatar user={me} size={34} />
          {partner ? <Avatar user={partner} size={34} /> : (
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full border border-dashed border-ink-500/40 bg-cream-50 text-ink-500 dark:bg-ink-950"><UserPlus size={14} strokeWidth={1.6} /></span>
          )}
        </Link>
      </header>

      {!partner && (
        <Link to="/settings" className="list-group list-row">
          <UserPlus size={18} strokeWidth={1.6} className="text-rose-500" />
          <span className="flex-1 text-[14px]">Invite your partner with code <span className="font-mono font-medium tracking-wider">{workspace.invite_code}</span></span>
          <ChevronRight size={16} className="text-ink-500" />
        </Link>
      )}

      {/* Progress + summary */}
      <section className="list-group">
        <div className="px-4 pb-4 pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px]">{nudge(s)}</p>
            <span className="muted text-[13px]">{s.pct}%</span>
          </div>
          <ProgressBar value={s.completed} max={s.total || 1} className="mt-3" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line dark:divide-line-dark dark:border-line-dark">
          {[['Dreams', s.total, '/list'], ['Completed', s.completed, '/memories'], ['Upcoming', upcomingCount, '/calendar']].map(([l, v, to]) => (
            <Link key={l} to={to} className="px-4 py-3 transition hover:bg-cream-50 dark:hover:bg-white/[.03]">
              <div className="title-serif text-[28px] leading-none">{v}</div>
              <div className="muted mt-1 text-[13px]">{l}</div>
            </Link>
          ))}
        </div>
        <p className="muted border-t border-line px-4 py-2.5 text-[13px] dark:border-line-dark">
          {s.byStatus['In Progress']} in progress · {s.byStatus.Planned} planned · {s.byStatus.Idea} ideas · {s.completedThisYear} done this year
        </p>
      </section>

      {/* One primary action, quiet secondary ones */}
      <section>
        <button className="btn-primary w-full" onClick={() => nav('/item/new')}><Plus size={18} strokeWidth={1.75} /> New dream</button>
        <div className="mt-3 grid grid-cols-3 text-[13px]">
          {[[Dices, 'Surprise me', '/surprise'], [CalendarDays, 'Calendar', '/calendar'], [CalendarPlus, 'Add date', '/dates?new=1']].map(([Icon, l, to]) => (
            <Link key={l} to={to} className="flex min-h-[44px] items-center justify-center gap-1.5 text-ink-600 transition hover:text-ink-800 dark:text-[#B9B3BA] dark:hover:text-cream-100">
              <Icon size={16} strokeWidth={1.6} /> {l}
            </Link>
          ))}
        </div>
      </section>

      {items.length === 0 && (
        <EmptyState title="Your list is waiting" body="Add the first thing you’d love to do together — big or small."
          action={<button className="btn-dark" onClick={() => nav('/item/new')}>Add a dream</button>} />
      )}

      {/* Milestones */}
      {dates.length > 0 && (
        <section>
          <SectionHead title="Milestones" to="/dates" />
          <ul className="list-group hairline">
            {dates.map((d, k) => (
              <li key={d.id}>
                <Link to="/dates" className="list-row">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-50 text-rose-500 dark:bg-white/5">
                    {d.photo_path ? <StoredImage path={d.photo_path} className="h-full w-full" /> : <DateKindIcon kind={d.kind} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{occurrenceTitle(d, d.years)}</span>
                    <span className="muted text-[13px]">{fmtDate(d.occurrence, 'EEEE, d MMMM')}</span>
                  </span>
                  <span className="text-right">
                    <span className={k === 0 ? 'title-serif block text-[26px] leading-none text-rose-600 dark:text-rose-400' : 'block text-[15px]'}>{d.days === 0 ? 'Today' : d.days}</span>
                    {d.days > 0 && <span className="muted text-[11px]">{d.days === 1 ? 'day' : 'days'}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Upcoming + reminders */}
      <section>
        <SectionHead title="Coming up" to="/calendar" />
        {upcoming.length || reminders.length ? (
          <ul className="list-group hairline">
            {upcoming.map((i) => (
              <li key={i.id}>
                <Link to={`/item/${i.id}`} className="list-row">
                  <span className="w-10 shrink-0 text-center leading-tight">
                    <span className="muted block text-[11px] uppercase tracking-wide">{fmtDate(i.start_date, 'MMM')}</span>
                    <span className="block text-[19px] font-medium">{fmtDate(i.start_date, 'd')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{i.title}</span>
                    <span className="muted text-[13px]">{countdownLabel(i.start_date)}</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-500" />
                </Link>
              </li>
            ))}
            {reminders.slice(0, 3).map((r) => (
              <li key={r.key}>
                <Link to={r.kind === 'item' ? `/item/${r.id}` : '/dates'} className="list-row">
                  <Bell size={16} strokeWidth={1.6} className={r.due ? 'text-rose-500' : 'text-ink-500'} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{r.title}</span>
                  <span className="muted text-[13px]">{r.kind === 'date' ? countdownLabel(r.at) : r.due ? 'Due now' : fmtDate(r.at, 'd MMM, HH:mm')}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-[14px]">Nothing scheduled yet. Give a dream a date, or let <Link to="/surprise" className="btn-link">Surprise me</Link> choose.</p>
        )}
      </section>

      {/* Top picks */}
      {picks.length > 0 && (
        <section>
          <SectionHead title="You both love" to="/list?sort=mutual" />
          <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
            {picks.map((i) => <div key={i.id} className="w-40 shrink-0 snap-start"><ItemCard item={i} compact /></div>)}
          </div>
        </section>
      )}

      {revealedGifts > 0 && (
        <Link to="/gifts" className="list-group list-row">
          <Gift size={18} strokeWidth={1.6} className="text-rose-500" />
          <span className="flex-1 text-[14px]">{revealedGifts} gift hint{revealedGifts > 1 ? 's' : ''} from {partner?.display_name || 'your partner'}</span>
          <ChevronRight size={16} className="text-ink-500" />
        </Link>
      )}

      {/* Insights — tucked away */}
      {s.total > 0 && (
        <section className="space-y-2">
          <h2 className="section-title mb-2">Insights</h2>
          <Disclosure title="Progress by category" icon={PieChart}>
            <div className="mb-4 flex h-1.5 overflow-hidden rounded-full" role="img" aria-label={STATUSES.map((st) => `${st}: ${s.byStatus[st]}`).join(', ')}>
              {STATUSES.map((st) => s.byStatus[st] > 0 && <div key={st} style={{ width: `${(s.byStatus[st] / s.total) * 100}%`, background: STATUS_META[st].color }} />)}
            </div>
            <div className="space-y-3">
              {CATEGORIES.filter((c) => s.byCategory[c].total).map((c) => (
                <div key={c}>
                  <div className="mb-1.5 flex justify-between text-[14px]">
                    <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />{c}</span>
                    <span className="muted">{s.byCategory[c].done} of {s.byCategory[c].total}</span>
                  </div>
                  <ProgressBar value={s.byCategory[c].done} max={s.byCategory[c].total} color="bg-ink-500/60" />
                </div>
              ))}
            </div>
          </Disclosure>
          <Disclosure title={`${yir.year} so far`} icon={CalendarDays} meta={`${yir.completed} done`}>
            <dl className="grid grid-cols-2 gap-4">
              {[['Dreams completed', yir.completed], ['Photos added', yir.photos], ['Places visited', yir.places], ['Spent on memories', fmtMoney(yir.spent, workspace.currency) || '0']].map(([l, v]) => (
                <div key={l}><dd className="title-serif text-[26px] leading-none">{v}</dd><dt className="muted mt-1 text-[13px]">{l}</dt></div>
              ))}
            </dl>
            <Link to="/timeline" className="btn-link mt-4">Open timeline <ChevronRight size={14} /></Link>
          </Disclosure>
          {partner && (
            <Disclosure title="The two of us" icon={UserPlus}>
              <div className="grid grid-cols-2 gap-4">
                {[me, partner].map((u) => {
                  const p = partnerSnapshot({ ...data, items }, u.id);
                  return (
                    <div key={u.id}>
                      <div className="mb-2 flex items-center gap-2"><Avatar user={u} size={22} /><span className="truncate text-[14px] font-medium">{u.id === me.id ? 'You' : u.display_name}</span></div>
                      <p className="muted text-[13px] leading-6">{p.added} added<br />{p.votes} votes<br />{p.comments} notes</p>
                    </div>
                  );
                })}
              </div>
            </Disclosure>
          )}
          <Disclosure title="Recent activity" icon={Activity} meta={feed.length || ''}>
            {feed.length ? (
              <ul className="space-y-3">
                {feed.map((e, k) => (
                  <li key={k}>
                    <Link to={byId.has(e.itemId) ? `/item/${e.itemId}` : '#'} className="flex items-start gap-3 text-[14px]">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500/40" />
                      <span className="flex-1"><span className="font-medium">{e.user ? personLabel(e.user) : 'You two'}</span> <span className="text-ink-600 dark:text-[#B9B3BA]">{e.text.replace(/ 🎉/, '')}</span></span>
                      <span className="muted shrink-0 text-[12px]">{timeAgo(e.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="muted text-[14px]">Your shared story starts here.</p>}
          </Disclosure>
        </section>
      )}
    </div>
  );
}

function SectionHead({ title, to }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <h2 className="section-title">{title}</h2>
      {to && <Link to={to} className="btn-link text-[13px]">See all</Link>}
    </div>
  );
}

function nudge(s) {
  if (!s.total) return 'Every story starts with a first dream.';
  if (s.completed === 0) return `${s.total} dreams, waiting for you two.`;
  if (s.completed === s.total) return `All ${s.total} done. Time to dream bigger.`;
  return `${s.completed} of ${s.total} dreams completed`;
}

