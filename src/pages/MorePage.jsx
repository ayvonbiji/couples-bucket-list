// "More": every secondary destination, grouped in quiet lists.
import { Link } from 'react-router-dom';
import { BookOpen, CalendarHeart, ChevronRight, Dices, Download, FolderTree, Gift, Lock, Map, Settings, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { Avatar, PageHeader } from '../components/ui.jsx';

export default function MorePage() {
  const { me, partner, trash, workspace } = useApp();
  const groups = [
    [
      { to: '/fantasy', icon: Lock, label: 'Secret Fantasy', hint: 'Just for the two of you' },
    ],
    [
      { to: '/timeline', icon: BookOpen, label: 'Timeline', hint: 'Our story, year by year' },
      { to: '/surprise', icon: Dices, label: 'Surprise Me', hint: 'Let chance pick what’s next' },
      { to: '/budget', icon: Wallet, label: 'Budget', hint: 'Costs and savings' },
      { to: '/categories', icon: FolderTree, label: 'Categories', hint: 'Lists and their progress' },
      { to: '/dates', icon: CalendarHeart, label: 'Important dates', hint: 'Anniversaries and birthdays' },
      { to: '/gifts', icon: Gift, label: 'Gift ideas', hint: 'Hints and secret plans' },
      { to: '/map', icon: Map, label: 'Map', hint: 'Every place on our list' },
    ],
    [
      { to: '/export', icon: Download, label: 'Export & backup' },
      { to: '/trash', icon: Trash2, label: 'Recently deleted', meta: trash.length || '' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  ];

  return (
    <div>
      <PageHeader title="More" />
      <div className="space-y-6 px-5 pb-8">
        <Link to="/settings" className="flex items-center gap-3 rounded-2xl py-1">
          <span className="flex -space-x-2"><Avatar user={me} size={40} />{partner && <Avatar user={partner} size={40} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{me.display_name}{partner ? ` & ${partner.display_name}` : ''}</span>
            <span className="muted block truncate text-[13px]">{workspace.name}</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.6} className="text-ink-500" />
        </Link>

        {groups.map((g, k) => (
          <ul key={k} className="list-group hairline">
            {g.map(({ to, icon: Icon, label, hint, meta }) => (
              <li key={to}>
                <Link to={to} className="list-row">
                  <Icon size={19} strokeWidth={1.6} className={to === '/fantasy' ? 'text-rose-500' : 'text-ink-500'} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{label}</span>
                    {hint && <span className="muted block text-[13px]">{hint}</span>}
                  </span>
                  {meta ? <span className="muted text-[14px]">{meta}</span> : null}
                  <ChevronRight size={16} strokeWidth={1.75} className="text-ink-500" />
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
