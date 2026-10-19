// Reminders: item reminder dates + important-date reminder offsets.
// Notifications are shown with the browser Notification API while the app is open
// (or installed as a PWA). Each reminder fires once per device.
import { format } from 'date-fns';
import { inReminderWindow, nextOccurrence } from './recurrence.js';
import { toDate } from './utils.js';

const FIRED_KEY = 'cbl:firedReminders';

/** Reminders that are due now or within `aheadDays`. */
export function dueReminders(items, dates, aheadDays = 7) {
  const now = Date.now();
  const horizon = now + aheadDays * 86400000;
  const out = [];
  for (const i of items) {
    if (i.is_deleted || i.status === 'Completed' || !i.reminder_at || i.reminder_done) continue;
    const t = toDate(i.reminder_at)?.getTime();
    if (t && t <= horizon) out.push({ key: `item:${i.id}:${i.reminder_at}`, kind: 'item', id: i.id, title: i.title, at: i.reminder_at, due: t <= now });
  }
  for (const d of dates) {
    if (!inReminderWindow(d)) continue;
    const occ = format(nextOccurrence(d), 'yyyy-MM-dd');
    out.push({ key: `date:${d.id}:${occ}`, kind: 'date', id: d.id, title: d.title, at: occ, due: true });
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

/** Show a system notification for each newly-due reminder (once per device). */
export function fireDueNotifications(reminders) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  let fired = [];
  try { fired = JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'); } catch { /* ignore */ }
  const set = new Set(fired);
  for (const r of reminders.filter((x) => x.due && !set.has(x.key))) {
    try {
      new Notification(r.kind === 'date' ? `Coming up: ${r.title}` : `Reminder: ${r.title}`, {
        body: r.kind === 'date' ? `On ${r.at}` : 'Our Bucket List',
        icon: '/heart.svg',
        tag: r.key,
      });
      set.add(r.key);
    } catch { /* some mobile browsers only allow notifications from a service worker */ }
  }
  localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-200)));
}
