// Five friendly sample items (plus a couple of important dates) inserted when a new
// workspace is created, so the app never opens to a blank screen.
import { addDays, format, subDays, subMonths } from 'date-fns';

const d = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd');

export function seedItems(meId, currency = 'INR') {
  return [
    {
      title: 'Houseboat night in Alleppey backwaters',
      description: 'Overnight kettuvallam, sunset on the lake, karimeen pollichathu for dinner.',
      category: 'Travel & Adventures', priority: 'High', status: 'Planned',
      timeframe: 'Monsoon getaway', start_date: d(26), end_date: d(27),
      location_name: 'Alappuzha, Kerala', lat: 9.4981, lng: 76.3388,
      est_cost: 18000, currency, tags: ['weekend', 'kerala', 'romantic'],
      savings_target: 18000, savings_saved: 7500,
      _subtasks: ['Shortlist 3 houseboats', 'Book the boat', 'Pack mosquito repellent'],
    },
    {
      title: 'Take a pottery class together',
      description: 'Make matching mugs (even if they come out wonky).',
      category: 'Food & Experiences', priority: 'Medium', status: 'Idea',
      timeframe: 'A rainy Sunday', time_required: 'Half day', est_cost: 3500, currency, tags: ['creative', 'cheap'],
    },
    {
      title: 'See the Northern Lights',
      description: 'Glass igloo in Finnish Lapland if we can swing it.',
      category: 'Travel & Adventures', priority: 'Low', status: 'Idea',
      timeframe: 'Winter 2027', location_name: 'Rovaniemi, Finland', lat: 66.5039, lng: 25.7294,
      est_cost: 450000, currency, tags: ['big trip', 'winter'],
      savings_target: 450000, savings_saved: 40000,
    },
    {
      title: 'Cook a 5-course dinner at home',
      description: 'Each of us plans two courses in secret, dessert together.',
      category: 'Romantic Dates', priority: 'High', status: 'In Progress',
      timeframe: 'This month', start_date: d(9), est_cost: 4000, currency, tags: ['date night', 'home'],
      _subtasks: ['Pick the menu', 'Buy candles', 'Make a playlist'],
    },
    {
      title: 'Watch the sunrise at Varkala cliff',
      description: 'Coffee in a flask, then breakfast at a cliff café.',
      category: 'Romantic Dates', priority: 'Medium', status: 'Completed',
      completed_at: format(subDays(new Date(), 40), 'yyyy-MM-dd'),
      completion_note: 'Woke up at 4:30 and it was absolutely worth it. The sky went pink, then gold.',
      would_do_again: 5, satisfaction: 5, favourite_memory: 'The first light hitting the water.', actual_cost: 1200,
      location_name: 'Varkala, Kerala', lat: 8.7379, lng: 76.7163,
      est_cost: 1500, currency, tags: ['sunrise', 'kerala'],
    },
  ].map((i) => ({ ...i, created_by: meId }));
}

export function seedDates(meId) {
  return [
    { title: 'Our anniversary', kind: 'anniversary', date: format(subMonths(addDays(new Date(), 18), 12 * 3), 'yyyy-MM-dd'), repeats_yearly: true, reminder_offset_days: 14, created_by: meId },
    { title: 'First date', kind: 'first_date', date: format(subMonths(addDays(new Date(), 64), 12 * 5), 'yyyy-MM-dd'), repeats_yearly: true, reminder_offset_days: 7, created_by: meId },
  ];
}
