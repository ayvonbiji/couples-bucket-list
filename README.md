# 💞 Our Bucket List

A warm, mobile-first web app for two people to dream, plan and remember together — one shared bucket list with voting, photo albums, secret gifts, important dates, a memory timeline and a calendar.

**Stack:** React 18 · Vite · Tailwind CSS · Supabase (Auth, Postgres + Row Level Security, Storage, Realtime, one Edge Function) · Leaflet/OpenStreetMap · dnd-kit · jsPDF · JSZip

---

## Quick start (Demo Mode — no setup)

```bash
npm install
npm run dev
```

Open http://localhost:5173 and choose **Continue as me**. Five sample items, two important dates and a hidden gift are seeded on first load. Everything is stored in your browser (localStorage + IndexedDB for photos).

Demo Mode includes both partners: **Settings → Switch to My Love** shows the list from the other side, so you can see surprises and hidden gifts disappear.

## Real two-person setup (Supabase)

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Run the schema.** In the dashboard open **SQL Editor**, paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. It creates every table, the RLS policies, the RPCs, the private `photos` and `backups` storage buckets, and realtime publication. It is safe to re-run.
   *With the Supabase CLI instead:* `supabase link --project-ref <ref>` then `supabase db push`.
3. **Configure auth.** Go to **Authentication → URL Configuration**, set **Site URL** to where the app runs (e.g. `http://localhost:5173` or your production URL), and add it to **Redirect URLs**. Email magic links are enabled by default.
4. **Add your keys.**
   ```bash
   cp .env.example .env.local
   # VITE_SUPABASE_URL=https://xxxx.supabase.co
   # VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. *(Optional)* **Enable Google Calendar sync** by deploying the iCal proxy:
   ```bash
   supabase functions deploy ical-proxy
   ```
6. `npm run dev`, or `npm run build` and deploy `dist/` to Vercel, Netlify or Cloudflare Pages. SPA rewrites are included (`vercel.json`, `public/_redirects`).

### How the two accounts link

1. **You** sign in with your email (magic link), then choose **Start our list**. This creates a *workspace* and gives you an 8-character **invite code**, shown on the dashboard and in **Settings → Partner**.
2. **Your wife** signs in with *her* email and chooses **I have a code**, then enters the code.
3. You both now see and edit the same list, live: changes sync instantly through Supabase Realtime.

A workspace accepts at most two members. Each person can belong to only one workspace. Both rules are enforced in the `join_workspace` function.

---

## Features

| Area | What's included |
|---|---|
| **Items** | Title, notes, category, priority, status (Idea → Planned → In Progress → Completed), free-text timeframe plus start/end dates, location with map pin (OSM search), cost and currency, owner (Me/Partner/Both), "Added by", tags, cover photo |
| **Couple interactions** | ❤️ / 👍 reactions, comment thread, **Surprise** toggle (hidden from your partner until you reveal it or until an auto-reveal date) |
| **Voting** | 1–5 stars from each partner, a combined 0–100 mutual score, a **"We both want this"** badge when both vote 4★+, sorting/filtering by mutual priority, and Top Picks on the dashboard |
| **Planning** | Checklist, links/bookings, savings progress bar (with quick "+ add"), reminder date and time |
| **Completion** | Completion date, photos, journal note, "would do again" rating and actual cost. Completed items appear in Memories and on the Timeline |
| **Photo albums** | Multi-upload with compression (max 1600px, about 0.5 MB), reorder, captions, delete, set cover, grid plus full-screen swipeable lightbox |
| **Wishlist / gifts** | Gift ideas per item (or standalone), with name, link, price, notes, who it's for, and a "Hide from partner" option with a reveal date. Also: a "Gifts for me" view and marking as gifted |
| **Important dates** | Birthdays, anniversaries, together-since, first date. Yearly repeat, reminder offset, photo, years count ("Our anniversary · 3rd"). Shown on the calendar and as dashboard countdowns |
| **Timeline** | Chronological journal of completed items, manual entries (with their own photos) and milestones. Filter by year, category or person. Includes a **Year in review** summary |
| **Surprise me** | Filter-aware random pick (presets: cheap, this weekend, both 4★+, must-do). Mutual favourites are weighted slightly higher. Slot-machine reveal, then **Reroll** or **Lock it in** (status set to Planned with a date) |
| **Calendar** | Month / week / agenda views. Drag and drop to reschedule (keeps trip length; undo toast). Tap a day to add an item or date. Colour by category, status or type. Countdowns, show/hide completed, read-only Google Calendar overlay |
| **Delete** | From the detail page, swipe-left or long-press in the list, or bulk multi-select. Confirmation lists what's attached. Soft delete to **Trash** with Undo; restore or delete forever; auto-purge after 30 days |
| **Export & backup** | Styled **PDF** with photos and memories, **CSV**, **JSON** (re-importable), **photo ZIP** (per item or everything). **Back up now** to cloud storage, automatic weekly backup, restore (merge or replace) from a cloud backup or a file. Optional **read-only share link** |
| **Dashboard** | Stat cards, completion ring, status and category breakdown, Top Picks, upcoming plans with countdowns, upcoming important dates, reminders due, recent activity, year-in-review strip, partner snapshot, quick actions, motivational nudge |
| **Polish** | Mobile-first, warm palette, dark mode (system/light/dark), reduced-motion support, keyboard focus rings, friendly empty states, installable (web manifest) |

## Project structure

```
supabase/
  migrations/0001_init.sql     Tables, RLS, RPCs, storage buckets, realtime
  functions/ical-proxy/        Edge Function: fetches Google Calendar iCal feeds (CORS)
src/
  data/                        Backend layer — same interface for both modes
    backend.js                 Chooses Supabase or Demo Mode from env vars
    supabaseBackend.js         Supabase client: CRUD, storage (signed URLs), realtime, RPCs
    localBackend.js            Demo Mode: localStorage tables + IndexedDB files
    tables.js                  Table list, column defaults, cascade rules
  store/AppStore.jsx           Session, workspace, all data, every action (CRUD, delete/restore, upload…)
  lib/                         Pure logic (unit-tested): scoring, visibility, recurrence, stats,
                               validation, export (PDF/CSV/JSON/ZIP + restore plan), ICS parser, image compression
  components/                  UI primitives, item views, photo album + lightbox, wishlist, filters, Surprise me…
  pages/                       Dashboard, List, Map, Item detail/edit, Calendar, Timeline, Memories,
                               Important dates, Gifts, Settings, Trash, Export, Share
```

## Database

`users` · `workspaces` · `workspace_members` · `items` · `item_votes` · `item_reactions` · `comments` · `subtasks` · `item_links` · `item_photos` · `wishlist_entries` · `important_dates` · `journal_entries` · `backups` · plus a `memories` view (the legacy table merged into `journal_entries`).

**Privacy is enforced in the database, not just the UI.**
- **Surprise items** (and their photos, votes and comments) are invisible to the partner until `revealed_at` is set or `reveal_date` passes.
- **Hidden gifts** stay invisible to the partner until their `reveal_date`.
- **Storage** objects are readable only by members of the workspace whose id prefixes the file path.

**RPCs:** `create_workspace`, `join_workspace`, `dashboard_summary`, `get_shared_list` (public share link: no surprises, gifts or comments), `import_rows` (validated restore), `purge_old_trash`.

**CRUD:** The app uses Supabase's auto-generated REST API (via `supabase-js`) with RLS, so every table has create/read/update/delete. Items use **soft delete** (`is_deleted`, `deleted_at`); restore clears those fields. Permanent delete removes the row, and `ON DELETE CASCADE` removes subtasks, comments, photos, gifts, votes and the journal entry. The app also deletes the photo files from storage.

To purge the trash on the server as well (the app already purges on open), enable `pg_cron` and run:
```sql
select cron.schedule('purge-trash', '0 3 * * *', 'select public.purge_old_trash()');
```

## Testing

```bash
npm test        # unit tests for scoring, privacy rules, recurrence, filters, stats, ICS, validation
npm run build   # production build
```

The SQL migration was tested against PostgreSQL 16 with a stubbed Supabase `auth`/`storage` schema. The tests covered partner linking, the two-member limit, surprise and hidden-gift visibility, vote spoofing, outsider access, validated restore, sharing and trash purge.

## Notes and limitations (MVP)

- **Reminders** use the browser Notification API and fire while the app is open or installed. Push notifications to a closed phone would need Web Push plus a scheduled Edge Function (a good v1.1).
- **Google Calendar** is read-only. You paste your calendar's *secret iCal address* in Settings, and recurring events show their first occurrence. Two-way sync is planned for v2.
- **Exports** are generated in the browser, so they work in both modes without a server.
- **Restoring a JSON backup** restores photo *records*. Photos appear if their files still exist in storage. Keep a photo ZIP for offline copies.
- **Out of scope for this version (v2):** two-way Google Calendar sync, public social sharing, in-app payments.
