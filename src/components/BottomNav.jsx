// Compact bottom navigation: Home · List · Calendar · Memories · More.
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, Home, Images, LayoutList, Ellipsis } from 'lucide-react';
import { cn } from '../lib/utils.js';

// Secondary destinations live under "More" and keep that tab highlighted.
const MORE_PATHS = ['/more', '/timeline', '/surprise', '/fantasy', '/dates', '/gifts', '/settings', '/trash', '/export', '/budget', '/categories'];

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/list', label: 'List', icon: LayoutList, also: ['/item', '/map'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/memories', label: 'Memories', icon: Images },
  { to: '/more', label: 'More', icon: Ellipsis, also: MORE_PATHS },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t lg:hidden border-line bg-cream-50/90 pb-safe backdrop-blur-xl dark:border-line-dark dark:bg-ink-950/90" aria-label="Main">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end, also = [] }) => (
          <li key={to}>
            <NavLink to={to} end={end}
              className={({ isActive }) => {
                const active = isActive || also.some((p) => pathname.startsWith(p));
                return cn('flex flex-col items-center gap-1 pb-1 pt-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-rose-600 dark:text-rose-400' : 'text-ink-500 hover:text-ink-700 dark:hover:text-cream-100');
              }}>
              <Icon size={22} strokeWidth={1.6} aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
