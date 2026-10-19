// Thin line icons for categories and date kinds (replaces the old emoji set).
import { Cake, CalendarHeart, Gem, Gift, Heart, House, Mountain, Plane, Sparkles, Target, Ticket, UtensilsCrossed, Users, Wine } from 'lucide-react';
import { categoryColor } from '../lib/constants.js';
import { cn } from '../lib/utils.js';

// Icon chosen from keywords in the (editable) category name.
const KEYWORD_ICONS = [
  [/travel|trip|adventure/i, Plane], [/food|dinner|cook|restaurant/i, UtensilsCrossed], [/romantic|date|love|relationship/i, Heart],
  [/home|house/i, House], [/goal|personal|growth/i, Target], [/occasion|celebrat|birthday|anniversar/i, Gift],
  [/experience|event|ticket/i, Ticket], [/outdoor|hike|mountain/i, Mountain],
];
const iconFor = (name = '') => KEYWORD_ICONS.find(([re]) => re.test(name))?.[1] || Sparkles;
const DATE_ICONS = { birthday: Cake, anniversary: Gem, together_since: Users, first_date: Wine, other: CalendarHeart };

export function CategoryIcon({ category, size = 16, className, strokeWidth = 1.6 }) {
  const Icon = iconFor(category);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

export function DateKindIcon({ kind, size = 16, className, strokeWidth = 1.6 }) {
  const Icon = DATE_ICONS[kind] || CalendarHeart;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

/** Small coloured dot + optional label: the quiet category indicator. */
export function CategoryDot({ category, label = true, className }) {
  const color = categoryColor(category);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] text-ink-500', className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      {label && category}
    </span>
  );
}

/** Image placeholder: soft tinted square with a thin category icon. */
export function CategoryPlaceholder({ category, size = 22, className }) {
  const color = categoryColor(category);
  return (
    <div className={cn('grid h-full w-full place-items-center', className)} style={{ background: `${color}14`, color }}>
      <CategoryIcon category={category} size={size} strokeWidth={1.4} />
    </div>
  );
}
