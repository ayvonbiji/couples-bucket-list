import { useApp } from '../store/AppStore.jsx';
import { cn } from '../lib/utils.js';

/** Stack of transient messages above the bottom nav. Toasts may carry an action (e.g. Undo). */
export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg animate-fade-up',
          t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink-800 text-cream-50 dark:bg-cream-100 dark:text-ink-900')}>
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button className="rounded-full bg-white/20 px-3 py-1 font-bold" onClick={() => { t.action.onClick(); dismissToast(t.id); }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
