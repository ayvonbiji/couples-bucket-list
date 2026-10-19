// UI primitives shared by every screen. Quiet by default: hairlines, no heavy shadows, one accent.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, Sparkles, Star, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { cn } from '../lib/utils.js';

export function Spinner({ className = '' }) {
  return <span role="status" aria-label="Loading" className={cn('inline-block h-5 w-5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent', className)} />;
}

/**
 * Page header. Large serif title (iOS-style) with an optional back button and actions.
 * `back` may be true (history back) or a path.
 */
export function PageHeader({ title, subtitle, back, actions, compact }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-cream-50/85 px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl dark:bg-ink-950/85">
      <div className="flex h-10 items-center justify-between">
        {back ? (
          <button className="-ml-2 flex items-center gap-0.5 rounded-full py-2 pl-1 pr-3 text-[15px] text-ink-700 transition hover:bg-ink-800/5 dark:text-cream-100 dark:hover:bg-white/5"
            onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="Back">
            <ChevronLeft size={22} strokeWidth={1.75} /> <span className="sr-only sm:not-sr-only">Back</span>
          </button>
        ) : <span />}
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {title && (
        <div className={cn(compact ? 'mt-0' : 'mt-1')}>
          <h1 className={cn('title-serif leading-[1.1] text-ink-800 dark:text-cream-100', compact ? 'text-[28px]' : 'text-[34px]')}>{title}</h1>
          {subtitle && <p className="muted mt-0.5 text-[14px]">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape or backdrop tap. */
export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input:not([type=file]),textarea,select,button[data-autofocus]')?.focus(), 60);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div ref={ref} className={cn('relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-cream-50 shadow-float animate-sheet-up dark:bg-ink-900 sm:rounded-[28px]', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink-800/10 dark:bg-white/15 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button className="icon-btn -mr-2 h-9 w-9" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={1.75} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-5 py-3 pb-safe dark:border-line-dark">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog. `danger` styles the confirm button for destructive actions. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button data-autofocus className={cn(danger ? 'btn-danger' : 'btn-dark', 'flex-1')} disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); onClose(); } }}>
          {busy ? <Spinner className="h-4 w-4" /> : confirmLabel}
        </button>
      </>}>
      {message && <p className="muted text-[15px]">{message}</p>}
      {children}
    </Modal>
  );
}

/** 1–5 star input (or read-only). Tapping the current value clears it. */
export function Stars({ value, onChange, size = 20, label = 'Rating', readOnly }) {
  return (
    <div className="flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={readOnly ? `${label}: ${value ?? 0} of 5` : label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        const icon = <Star size={size} strokeWidth={1.5} className={on ? 'fill-rose-500 text-rose-500' : 'text-ink-500/40'} />;
        return readOnly ? <span key={n}>{icon}</span> : (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90" onClick={() => onChange(value === n ? 0 : n)}>{icon}</button>
        );
      })}
    </div>
  );
}

/** Subtle mutual-interest marker. */
export function MutualBadge({ small, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400', small ? 'text-[12px]' : 'text-[13px]', className)}>
      <Heart size={small ? 11 : 13} strokeWidth={2} className="fill-current" /> Both want this
    </span>
  );
}

export function EmptyState({ icon: Icon = Sparkles, title, body, action }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center animate-fade-up">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-500 dark:bg-white/5">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body && <p className="muted mt-1 max-w-xs text-[14px]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, max = 100, className = '', color = 'bg-rose-500' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-800/[.06] dark:bg-white/10', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ pct, size = 56, stroke = 3, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-ink-800/[.07] dark:stroke-white/10" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className="fill-none stroke-rose-500 transition-[stroke-dashoffset] duration-1000"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(pct, 100)) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Field({ label, error, children, hint, className }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="muted mt-1 block text-[13px]">{hint}</span>}
      {error && <span className="err block" role="alert">{error}</span>}
    </label>
  );
}

/** Pill-style single choice. */
export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="radiogroup">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-pressed={value === v}
            className="chip-toggle" onClick={() => onChange(v)}>{l}</button>
        );
      })}
    </div>
  );
}

/** iOS-style segmented control (equal-width, one row). */
export function SegmentedControl({ options, value, onChange, className }) {
  return (
    <div className={cn('grid rounded-xl bg-ink-800/[.05] p-0.5 dark:bg-white/5', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('min-h-[34px] rounded-[10px] px-2 text-[13px] font-medium transition', value === o.value ? 'bg-white text-ink-800 shadow-[0_1px_3px_rgba(37,35,38,0.1)] dark:bg-ink-800 dark:text-cream-100' : 'text-ink-500')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span>
        <span className="block text-[15px]">{label}</span>
        {description && <span className="muted block text-[13px]">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('relative h-[30px] w-[50px] shrink-0 rounded-full transition', checked ? 'bg-rose-500' : 'bg-ink-800/15 dark:bg-white/15')}>
        <span className={cn('absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[23px]' : 'left-[3px]')} />
      </button>
    </label>
  );
}

export function Avatar({ user, size = 28 }) {
  const name = user?.display_name || '?';
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-medium text-white ring-2 ring-cream-50 dark:ring-ink-950" title={name}
      style={{ width: size, height: size, background: user?.avatar_color || '#C65D70', fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Expandable section built on <details> — progressive disclosure for secondary content. */
export function Disclosure({ title, meta, defaultOpen, children, icon: Icon }) {
  return (
    <details className="group list-group" open={defaultOpen}>
      <summary className="list-row cursor-pointer select-none">
        {Icon && <Icon size={18} strokeWidth={1.6} className="shrink-0 text-ink-500" />}
        <span className="flex-1 text-[15px] font-medium">{title}</span>
        {meta !== undefined && meta !== null && meta !== '' && <span className="muted text-[14px]">{meta}</span>}
        <ChevronRight size={16} strokeWidth={1.75} className="chev shrink-0 text-ink-500 transition-transform duration-200" />
      </summary>
      <div className="border-t border-line px-4 py-4 dark:border-line-dark">{children}</div>
    </details>
  );
}

/** Simple label/value row for detail pages. */
export function InfoRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="muted shrink-0 text-[14px]">{label}</span>
      <span className="min-w-0 text-right text-[15px]">{children}</span>
    </div>
  );
}

/** Resolve a storage path to a displayable URL (signed URL or local object URL). */
export function useFileUrl(path, bucket = 'photos') {
  const { backend } = useApp();
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    if (!path || !backend) { setUrl(null); return; }
    backend.fileUrl(bucket, path).then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    return () => { live = false; };
  }, [path, bucket, backend]);
  return url;
}

/** <img> for a stored photo, with a soft placeholder while it loads. */
export function StoredImage({ path, bucket, alt = '', className = '', fallback = null, ...rest }) {
  const url = useFileUrl(path, bucket);
  if (!path) return fallback;
  return url
    ? <img src={url} alt={alt} loading="lazy" className={cn('object-cover', className)} {...rest} />
    : <div className={cn('animate-pulse bg-cream-100 dark:bg-white/5', className)} aria-hidden />;
}
