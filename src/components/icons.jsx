// Thin line icons for categories and date kinds (replaces the old emoji set).
import { Cake, CalendarHeart, Compass, Gem, Heart, House, Mountain, Plane, Sparkles, Ticket, UtensilsCrossed, Users, Wine } from 'lucide-react';
import { CATEGORY_META } from '../lib/constants.js';
import { cn } from '../lib/utils.js';

const CATEGORY_ICONS = {
  Travel: Plane, Food: UtensilsCrossed, Adventure: Mountain, Relationship: Heart,
  Home: House, Experiences: Ticket, Other: Sparkles,
};
const DATE_ICONS = { birthday: Cake, anniversary: Gem, together_since: Users, first_date: Wine, other: CalendarHeart };

export function CategoryIcon({ category, size = 16, className, strokeWidth = 1.6 }) {
  const Icon = CATEGORY_ICONS[category] || Compass;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

export function DateKindIcon({ kind, size = 16, className, strokeWidth = 1.6 }) {
  const Icon = DATE_ICONS[kind] || CalendarHeart;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

/** Small coloured dot + optional label: the quiet category indicator. */
export function CategoryDot({ category, label = true, className }) {
  const color = (CATEGORY_META[category] || CATEGORY_META.Other).color;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] text-ink-500', className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      {label && category}
    </span>
  );
}

/** Image placeholder: soft tinted square with a thin category icon. */
export function CategoryPlaceholder({ category, size = 22, className }) {
  const color = (CATEGORY_META[category] || CATEGORY_META.Other).color;
  return (
    <div className={cn('grid h-full w-full place-items-center', className)} style={{ background: `${color}14`, color }}>
      <CategoryIcon category={category} size={size} strokeWidth={1.4} />
    </div>
  );
}
