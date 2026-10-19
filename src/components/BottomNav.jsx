import { NavLink } from 'react-router-dom';
import { BookHeart, CalendarHeart, Home, Images, ListChecks, Settings } from 'lucide-react';
import { cn } from '../lib/utils.js';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/list', label: 'List', icon: ListChecks },
  { to: '/calendar', label: 'Calendar', icon: CalendarHeart },
  { to: '/timeline', label: 'Timeline', icon: BookHeart },
  { to: '/memories', label: 'Memories', icon: Images },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rose-100 bg-cream-50/95 pb-safe backdrop-blur dark:border-white/10 dark:bg-ink-950/95" aria-label="Main">
      <ul className="mx-auto grid max-w-2xl grid-cols-6">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end}
              className={({ isActive }) => cn('flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10.5px] font-bold transition',
                isActive ? 'text-rose-600 dark:text-rose-400' : 'text-ink-700/55 dark:text-cream-100/50')}>
              {({ isActive }) => (<>
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-rose-100 dark:bg-rose-950')}>
                  <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {label}
              </>)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
