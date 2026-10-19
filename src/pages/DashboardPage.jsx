// Dashboard: the couple's at-a-glance hub.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, CalendarHeart, ChevronRight, Dices, Gift, Plus } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { activityFeed, partnerSnapshot, summary, topPicks, upcomingItems, yearInReview } from '../lib/stats.js';
import { upcomingDates, occurrenceTitle } from '../lib/recurrence.js';
import { CATEGORIES, CATEGORY_META, DATE_KINDS, STATUSES, STATUS_META } from '../lib/constants.js';
import { countdownLabel, fmtDate, fmtMoney, timeAgo } from '../lib/utils.js';
import { Avatar, EmptyState, MutualBadge, ProgressBar, ProgressRing, StatCard, StoredImage } from '../components/ui.jsx';
import { ItemCard } from '../components/ItemViews.jsx';
import SurpriseMe from '../components/SurpriseMe.jsx';

export default function DashboardPage() {
  const { me, partner, workspace, data, reminders, personLabel } = useApp();
  const items = useDecoratedItems();
  const nav = useNavigate();
  const [surprise, setSurprise] = useState(false);

  const s = useMemo(() => summary(items), [items]);
  const picks = useMemo(() => topPicks(items, data.item_votes, me.id, partner?.id, 5), [items, data.item_votes, me.id, partner?.id]);
  const upcoming = useMemo(() => upcomingItems(items, 5), [items]);
  const dates = useMemo(() => upcomingDates(data.important_dates, 3), [data.important_dates]);
  const feed = useMemo(() => activityFeed({ ...data, items }, 8), [data, items]);
  const yir = useMemo(() => yearInReview({ ...data, items }), [data, items]);
  const revealedGifts = data.wishlist_entries.filter((g) => g.for_user_id === me.id && g.created_by !== me.id && !g.is_gifted).length;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 px-4 pb-6 pt-[max(env(safe-area-inset-top),1rem)]">
      {/* Header */}
      <header className="flex items-center justify-between animate-fade-up">
        <div>
          <p className="muted text-sm font-semibold">{greeting} ☀️</p>
          <h1 className="text-[28px] font-bold leading-tight">{workspace.name}</h1>
        </div>
        <div className="flex -space-x-2">
          <Avatar user={me} size={38} />
          {partner ? <Avatar user={partner} size={38} /> : (
            <Link to="/settings" className="grid h-[38px] w-[38px] place-items-center rounded-full border-2 border-dashed border-rose-300 bg-cream-50 text-rose-500 dark:bg-ink-900" aria-label="Invite partner"><Plus size={16} /></Link>
          )}
        </div>
      </header>

      {!partner && (
        <Link to="/settings" className="card flex items-center gap-3 border-2 border-dashed border-rose-200 p-4 dark:border-rose-900">
          <span className="text-2xl">💌</span>
          <span className="flex-1 text-sm"><b>Invite your partner.</b> Share your code <span className="font-mono font-bold text-rose-600">{workspace.invite_code}</span> so you can plan together.</span>
          <ChevronRight size={18} />
        </Link>
      )}

      {/* Progress + nudge */}
      <section className="card flex items-center gap-5 bg-gradient-to-br from-rose-50 to-cream-100 p-5 dark:from-rose-950/40 dark:to-ink-800">
        <ProgressRing pct={s.pct} size={104} stroke={11}>
          <div><div className="font-display text-2xl font-bold">{s.pct}%</div><div className="muted text-[10px] font-bold uppercase">done</div></div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-snug">{nudge(s)}</p>
          <p className="muted mt-1 text-sm">{s.completedThisYear} this year · {s.completed} all-time</p>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-4 gap-2" aria-label="Quick actions">
        {[
          { label: 'Add item', icon: Plus, onClick: () => nav('/item/new'), primary: true },
          { label: 'Surprise me', icon: Dices, onClick: () => setSurprise(true) },
          { label: 'Calendar', icon: CalendarDays, onClick: () => nav('/calendar') },
          { label: 'Add date', icon: CalendarHeart, onClick: () => nav('/dates?new=1') },
        ].map(({ label, icon: Icon, onClick, primary }) => (
          <button key={label} onClick={onClick} className="flex flex-col items-center gap-1.5 text-xs font-bold">
            <span className={`grid h-14 w-14 place-items-center rounded-2xl shadow-soft transition active:scale-95 ${primary ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 dark:bg-ink-800 dark:text-rose-300'}`}><Icon size={22} /></span>
            {label}
          </button>
        ))}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-5 gap-1.5 sm:gap-2">
        <StatCard label="Total" value={s.total} emoji="📝" onClick={() => nav('/list')} />
        <StatCard label="Completed" value={s.byStatus.Completed} emoji="✅" onClick={() => nav('/memories')} />
        <StatCard label="In progress" value={s.byStatus['In Progress']} emoji="⏳" onClick={() => nav('/list?status=In Progress')} />
        <StatCard label="Planned" value={s.byStatus.Planned} emoji="📅" onClick={() => nav('/list?status=Planned')} />
        <StatCard label="Ideas" value={s.byStatus.Idea} emoji="💡" onClick={() => nav('/list?status=Idea')} />
      </section>

      {items.length === 0 && (
        <EmptyState emoji="🌱" title="Your list is waiting" body="Add the first thing you two dream of doing together — big or tiny."
          action={<button className="btn-primary" onClick={() => nav('/item/new')}><Plus size={18} /> Add our first dream</button>} />
      )}

      {/* Important date countdowns */}
      {dates.length > 0 && (
        <section>
          <SectionHead title="Coming up 💞" to="/dates" />
          <div className="grid grid-cols-3 gap-2">
            {dates.map((d) => (
              <Link key={d.id} to="/dates" className="card relative flex flex-col items-center overflow-hidden px-2 py-3 text-center">
                {d.photo_path && <StoredImage path={d.photo_path} className="absolute inset-0 h-full w-full opacity-20" />}
                <span className="relative text-2xl">{DATE_KINDS[d.kind]?.emoji}</span>
                <span className="relative font-display text-3xl font-bold text-rose-600 dark:text-rose-400">{d.days}</span>
                <span className="relative muted text-[10px] font-bold uppercase">{d.days === 1 ? 'day' : 'days'}</span>
                <span className="relative mt-1 line-clamp-2 text-xs font-bold leading-tight">{occurrenceTitle(d, d.years)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top picks */}
      <section>
        <SectionHead title="Top Picks ⭐" subtitle="Highest rated by both of you" to="/list?sort=mutual" />
        {picks.length ? (
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {picks.map((i, k) => (
              <div key={i.id} className="w-48 shrink-0 snap-start">
                <div className="relative">
                  <span className="absolute -left-1 -top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-gold-400 text-sm font-black text-ink-900 shadow">{k + 1}</span>
                  <ItemCard item={i} compact />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="card muted p-4 text-sm">Rate items with stars on their detail page — anything you <i>both</i> give 4★+ shows up here with a <MutualBadge small />.</p>
        )}
      </section>

      {/* Upcoming items + reminders */}
      <section>
        <SectionHead title="Upcoming plans" to="/calendar" />
        {upcoming.length ? (
          <ul className="card divide-y divide-rose-100 dark:divide-white/5">
            {upcoming.map((i) => (
              <li key={i.id}>
                <Link to={`/item/${i.id}`} className="flex items-center gap-3 p-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center leading-none" style={{ background: CATEGORY_META[i.category].color + '22' }}>
                    <span><span className="block text-[10px] font-bold uppercase">{fmtDate(i.start_date, 'MMM')}</span><span className="font-display text-lg font-bold">{fmtDate(i.start_date, 'd')}</span></span>
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{i.title}</span><span className="muted text-xs">{i.status}</span></span>
                  <span className="chip bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200">{countdownLabel(i.start_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="card muted p-4 text-sm">Nothing scheduled yet. Give an item a date — or let <button className="font-bold text-rose-600 underline" onClick={() => setSurprise(true)}>Surprise me</button> choose.</p>}

        {reminders.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {reminders.slice(0, 4).map((r) => (
              <li key={r.key}>
                <Link to={r.kind === 'item' ? `/item/${r.id}` : '/dates'} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${r.due ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100' : 'bg-white dark:bg-ink-800'}`}>
                  <Bell size={15} /> <span className="flex-1 truncate font-semibold">{r.title}</span>
                  <span className="text-xs">{r.kind === 'date' ? countdownLabel(r.at) : r.due ? 'Due now' : fmtDate(r.at, 'd MMM, HH:mm')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Breakdown */}
      {s.total > 0 && (
        <section className="card space-y-4 p-4">
          <h2 className="section-title">How we're doing</h2>
          <div>
            <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={STATUSES.map((st) => `${st}: ${s.byStatus[st]}`).join(', ')}>
              {STATUSES.map((st) => s.byStatus[st] > 0 && <div key={st} style={{ width: `${(s.byStatus[st] / s.total) * 100}%`, background: STATUS_META[st].color }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {STATUSES.map((st) => <span key={st} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[st].color }} />{st} <b>{s.byStatus[st]}</b></span>)}
            </div>
          </div>
          <div className="space-y-2.5">
            {CATEGORIES.filter((c) => s.byCategory[c].total).map((c) => (
              <div key={c}>
                <div className="mb-1 flex justify-between text-sm"><span>{CATEGORY_META[c].emoji} {c}</span><span className="muted text-xs font-semibold">{s.byCategory[c].done}/{s.byCategory[c].total}</span></div>
                <ProgressBar value={s.byCategory[c].done} max={s.byCategory[c].total} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Year in review */}
      <section>
        <SectionHead title={`${yir.year} in review`} to="/timeline" />
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-ink-800 p-4 text-cream-50 dark:bg-rose-950/50">
          {[['🎉', yir.completed, 'done'], ['📸', yir.photos, 'photos'], ['📍', yir.places, 'places'], ['💰', fmtMoney(yir.spent, workspace.currency) || '0', 'spent']].map(([e, v, l]) => (
            <div key={l} className="text-center">
              <div aria-hidden>{e}</div>
              <div className="truncate font-display text-lg font-bold">{v}</div>
              <div className="text-[10px] font-bold uppercase opacity-70">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Gifts teaser */}
      {revealedGifts > 0 && (
        <Link to="/gifts" className="card flex items-center gap-3 p-4">
          <Gift className="text-rose-600" />
          <span className="flex-1 text-sm"><b>{revealedGifts} gift hint{revealedGifts > 1 ? 's' : ''}</b> from {partner?.display_name || 'your partner'} {revealedGifts > 1 ? 'are' : 'is'} now visible 👀</span>
          <ChevronRight size={18} />
        </Link>
      )}

      {/* Partner snapshot */}
      {partner && (
        <section>
          <SectionHead title="Us, by the numbers" />
          <div className="grid grid-cols-2 gap-2">
            {[me, partner].map((u) => {
              const p = partnerSnapshot({ ...data, items }, u.id);
              return (
                <div key={u.id} className="card p-3">
                  <div className="mb-2 flex items-center gap-2"><Avatar user={u} size={26} /><b className="truncate">{u.id === me.id ? 'Me' : u.display_name}</b></div>
                  <dl className="grid grid-cols-3 text-center text-xs">
                    <div><dt className="muted">added</dt><dd className="font-display text-lg font-bold">{p.added}</dd></div>
                    <div><dt className="muted">votes</dt><dd className="font-display text-lg font-bold">{p.votes}</dd></div>
                    <div><dt className="muted">notes</dt><dd className="font-display text-lg font-bold">{p.comments}</dd></div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity */}
      <section>
        <SectionHead title="Recent activity" />
        {feed.length ? (
          <ul className="card divide-y divide-rose-100 dark:divide-white/5">
            {feed.map((e, k) => (
              <li key={k}>
                <Link to={byId.has(e.itemId) ? `/item/${e.itemId}` : '#'} className="flex items-start gap-2.5 p-3 text-sm">
                  <span aria-hidden>{{ added: '➕', completed: '🎉', comment: '💬', vote: '⭐', photo: '📸' }[e.kind]}</span>
                  <span className="flex-1"><b>{e.user ? personLabel(e.user) : 'You two'}</b> {e.text}</span>
                  <span className="muted shrink-0 text-xs">{timeAgo(e.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="card muted p-4 text-sm">Your shared story starts here. ✍️</p>}
      </section>

      <SurpriseMe open={surprise} onClose={() => setSurprise(false)} />
    </div>
  );
}

function SectionHead({ title, subtitle, to }) {
  return (
    <div className="mb-2 flex items-end justify-between">
      <div><h2 className="section-title">{title}</h2>{subtitle && <p className="muted text-xs">{subtitle}</p>}</div>
      {to && <Link to={to} className="text-sm font-bold text-rose-600 dark:text-rose-400">See all</Link>}
    </div>
  );
}

function nudge(s) {
  if (!s.total) return 'Every great story starts with a list. ✨';
  if (s.completed === 0) return `${s.total} dreams waiting. Which one's first? 💫`;
  if (s.completed === s.total) return `All ${s.total} done! Time to dream bigger. 🌈`;
  return `You've completed ${s.completed} of ${s.total} goals. Keep going! 💪`;
}
