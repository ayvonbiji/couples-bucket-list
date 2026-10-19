// Small UI primitives shared by every screen.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Star, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { cn } from '../lib/utils.js';

export function Spinner({ className = '' }) {
  return <span role="status" aria-label="Loading" className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />;
}

/** Page header with optional back button and right-side actions. */
export function PageHeader({ title, subtitle, back, actions }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 bg-cream-50/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.9rem)] backdrop-blur dark:bg-ink-950/90">
      {back && (
        <button className="icon-btn -ml-2" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="muted truncate text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}

/** Bottom sheet on phones, centered dialog on larger screens. Closes on Escape/backdrop. */
export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input,textarea,select,button[data-autofocus]')?.focus(), 50);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px] animate-fade-up" onClick={onClose} />
      <div ref={ref} className={cn('relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-cream-50 shadow-2xl animate-fade-up dark:bg-ink-900 sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-rose-100 px-5 py-3 pb-safe dark:border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog. `danger` styles the confirm button red. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button data-autofocus className={cn(danger ? 'btn-danger' : 'btn-primary', 'flex-1')} disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); onClose(); } }}>
          {busy ? <Spinner className="h-4 w-4" /> : confirmLabel}
        </button>
      </>}>
      {message && <p className="muted text-[15px]">{message}</p>}
      {children}
    </Modal>
  );
}

/** 1–5 star input (or read-only display). Clicking the current value clears it. */
export function Stars({ value, onChange, size = 22, label = 'Rating', readOnly }) {
  return (
    <div className="flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={readOnly ? `${label}: ${value ?? 0} of 5` : label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        const icon = <Star size={size} className={on ? 'fill-gold-400 text-gold-500' : 'text-ink-700/25 dark:text-cream-100/25'} />;
        return readOnly ? <span key={n}>{icon}</span> : (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="rounded-md p-0.5 transition active:scale-90" onClick={() => onChange(value === n ? 0 : n)}>{icon}</button>
        );
      })}
    </div>
  );
}

export function MutualBadge({ small }) {
  return (
    <span className={cn('chip bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-sm', small && 'px-2 py-0.5 text-[10px]')}>
      <Heart size={small ? 10 : 12} className="fill-white" /> We both want this
    </span>
  );
}

export function EmptyState({ emoji = '💌', title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center animate-fade-up">
      <div className="mb-3 text-5xl" aria-hidden>{emoji}</div>
      <h3 className="text-xl font-bold">{title}</h3>
      {body && <p className="muted mt-1 max-w-xs text-[15px]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, max = 100, className = '', color = 'bg-rose-500' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-rose-100 dark:bg-white/10', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ pct, size = 120, stroke = 12, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-rose-100 dark:stroke-white/10" />
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
      {hint && !error && <span className="muted mt-1 block text-xs">{hint}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </label>
  );
}

/** Pill-style single choice. */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="radiogroup">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-pressed={value === v}
            className={cn('chip-toggle', size === 'lg' && 'px-3.5 py-2 text-sm')} onClick={() => onChange(v)}>{l}</button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1">
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        {description && <span className="muted block text-xs">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-rose-600' : 'bg-ink-700/20 dark:bg-white/20')}>
        <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Avatar({ user, size = 28 }) {
  const name = user?.display_name || '?';
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white" title={name}
      style={{ width: size, height: size, background: user?.avatar_color || '#e2555a', fontSize: size * 0.42 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
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
export function StoredImage({ path, alt = '', className = '', fallback = null, ...rest }) {
  const url = useFileUrl(path);
  if (!path) return fallback;
  return url
    ? <img src={url} alt={alt} loading="lazy" className={cn('object-cover', className)} {...rest} />
    : <div className={cn('animate-pulse bg-rose-100 dark:bg-white/10', className)} aria-hidden />;
}

/** Stat card used on the dashboard. */
export function StatCard({ label, value, emoji, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className="card flex min-w-0 flex-col items-center px-1 py-2.5 text-center transition active:scale-[.98]">
      <span className="text-base" aria-hidden>{emoji}</span>
      <span className="font-display text-2xl font-bold leading-tight">{value}</span>
      <span className="muted w-full truncate text-[10.5px] font-bold">{label}</span>
    </Tag>
  );
}
