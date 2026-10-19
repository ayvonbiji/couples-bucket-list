import { useApp } from '../store/AppStore.jsx';
import { cn } from '../lib/utils.js';

/** Quiet, transient messages above the bottom nav. Toasts may carry an action (e.g. Undo). */
export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-5" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto flex max-w-md items-center gap-4 rounded-full py-2.5 pl-5 pr-2.5 text-[14px] shadow-float animate-fade-up',
          t.type === 'error' ? 'bg-rose-700 text-white' : 'bg-ink-800 text-cream-50 dark:bg-cream-100 dark:text-ink-900', !t.action && 'pr-5')}>
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button className="rounded-full px-3 py-1 font-medium text-rose-300 dark:text-rose-600" onClick={() => { t.action.onClick(); dismissToast(t.id); }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
