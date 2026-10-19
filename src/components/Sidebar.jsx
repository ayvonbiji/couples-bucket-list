// Desktop navigation (lg and up). Mobile uses the bottom bar.
import { NavLink } from 'react-router-dom';
import { BookOpen, CalendarDays, CalendarHeart, Dices, Download, FolderTree, Gift, Home, Images, LayoutList, Lock, Map, Settings, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { cn } from '../lib/utils.js';
import { Avatar } from './ui.jsx';

const PRIMARY = [
  ['/', 'Home', Home, true], ['/list', 'Bucket List', LayoutList], ['/calendar', 'Calendar', CalendarDays], ['/memories', 'Memories', Images],
];
const SECONDARY = [
  ['/fantasy', 'Secret Fantasy', Lock], ['/timeline', 'Timeline', BookOpen], ['/surprise', 'Surprise Me', Dices], ['/budget', 'Budget', Wallet],
  ['/categories', 'Categories', FolderTree], ['/dates', 'Important dates', CalendarHeart], ['/gifts', 'Gift ideas', Gift], ['/map', 'Map', Map],
];
const SYSTEM = [['/export', 'Export & backup', Download], ['/trash', 'Recently deleted', Trash2], ['/settings', 'Settings', Settings]];

function Item({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition',
      isActive ? 'bg-ink-800/[.05] font-medium text-ink-800 dark:bg-white/5 dark:text-cream-100' : 'text-ink-600 hover:bg-ink-800/[.03] dark:text-[#B9B3BA] dark:hover:bg-white/[.03]')}>
      <Icon size={18} strokeWidth={1.6} /> {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { me, partner, workspace } = useApp();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 dark:border-line-dark lg:flex">
      <div className="mb-6 px-3">
        <p className="title-serif text-[24px] leading-tight">{workspace.name}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex -space-x-2"><Avatar user={me} size={24} />{partner && <Avatar user={partner} size={24} />}</span>
          <span className="muted truncate text-[13px]">{me.display_name}{partner ? ` & ${partner.display_name}` : ''}</span>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto" aria-label="Main">
        <div className="space-y-0.5">{PRIMARY.map(([to, l, i, end]) => <Item key={to} to={to} label={l} icon={i} end={end} />)}</div>
        <div className="space-y-0.5">{SECONDARY.map(([to, l, i]) => <Item key={to} to={to} label={l} icon={i} />)}</div>
        <div className="space-y-0.5">{SYSTEM.map(([to, l, i]) => <Item key={to} to={to} label={l} icon={i} />)}</div>
      </nav>
    </aside>
  );
}
