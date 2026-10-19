// Minimal iCalendar (.ics) parser for read-only Google Calendar sync.
// Handles line folding, all-day and timed DTSTART/DTEND, SUMMARY, LOCATION, UID.
// Recurring events (RRULE) show their first occurrence only — fine for an overlay.

export function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.start) events.push(cur);
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(';')[0];
      const val = line.slice(idx + 1);
      if (key === 'SUMMARY') cur.title = unescape(val);
      else if (key === 'LOCATION') cur.location = unescape(val);
      else if (key === 'UID') cur.id = val;
      else if (key === 'DTSTART') cur.start = icsDate(val);
      else if (key === 'DTEND') cur.end = icsDate(val);
    }
  }
  return events.map((e, i) => ({ id: e.id || `gcal-${i}`, title: e.title || '(busy)', location: e.location, start: e.start, end: e.end || e.start }));
}

const unescape = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');

/** "20261024" or "20261024T093000Z" → "2026-10-24" (local calendar day). */
function icsDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  if (m[4] && m[8]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]));
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}
