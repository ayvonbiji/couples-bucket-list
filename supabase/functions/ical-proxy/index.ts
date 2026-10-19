// Supabase Edge Function: fetch a Google Calendar iCal feed server-side (browsers block it via CORS).
// Deploy:  supabase functions deploy ical-proxy
// Only signed-in users can call it (Supabase verifies the JWT by default), and only
// calendar.google.com / *.icloud.com / outlook URLs are allowed, so it can't be used as an open proxy.

const ALLOWED_HOSTS = [/^calendar\.google\.com$/, /^p\d+-caldav\.icloud\.com$/, /^outlook\.(live|office365)\.com$/];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { url } = await req.json();
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(u.hostname))) {
      return new Response(JSON.stringify({ error: 'Only Google, iCloud or Outlook calendar feeds are allowed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const res = await fetch(u, { headers: { Accept: 'text/calendar' } });
    if (!res.ok) throw new Error(`Calendar responded ${res.status}`);
    const ics = await res.text();
    if (ics.length > 5_000_000) throw new Error('Calendar feed is too large');
    return new Response(JSON.stringify({ ics }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
