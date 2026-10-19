# Our Bucket List

A calm, private, mobile-first app for two people to dream, plan and remember together. It has one shared bucket list with voting, photo albums, secret gifts, important dates, a memory timeline, a calendar, and **Secret Fantasy**, a private space just for the two of you.

**Stack:** React 18 · Vite · Tailwind CSS · Supabase (Auth, Postgres + Row Level Security, Storage, Realtime, one Edge Function) · Leaflet/OpenStreetMap · dnd-kit · jsPDF · JSZip

---

## Quick start (Demo Mode — no setup)

```bash
npm install
npm run dev
```

Open http://localhost:5173 and choose **Continue as me**. Five sample items, two important dates and a hidden gift are seeded on first load. Everything is stored in your browser (localStorage + IndexedDB for photos).

Demo Mode includes both partners. **More → Settings → Switch to My Love** shows the list from the other side, so you can see surprises, hidden gifts and private fantasies disappear.

## Real two-person setup (Supabase)

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Run the schema.** In the dashboard open **SQL Editor** and run these two files in order:
   - [`0001_init.sql`](supabase/migrations/0001_init.sql) creates the tables, RLS policies, RPCs, the private `photos` and `backups` buckets, and realtime.
   - [`0002_secret_fantasy.sql`](supabase/migrations/0002_secret_fantasy.sql) adds Secret Fantasy: its tables, consent rules and private `fantasy` bucket.

   Both are additive and safe to re-run; they never modify or delete existing rows. If you already ran `0001`, run only `0002`.
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

## Design

The interface is deliberately quiet: warm off-white (`#FAF9F7`), charcoal text (`#252326`), muted grey (`#858087`), and a single muted-rose accent (`#C65D70`, blush `#F6E9EC`) used sparingly. Borders are hairlines (`#EAE6E5`) and there are no heavy shadows. Icons are thin line icons, with no emoji.

- **Type:** body text is Inter; Instrument Serif appears only on page titles and a few hero numbers.
- **Light and dark modes:** both are fully supported, set to Automatic, Light or Dark in Settings.
- **Navigation:** Home · List · Calendar · Memories · More. Timeline, Surprise Me, Secret Fantasy, Important dates, Gift ideas, Map, Export, Recently deleted and Settings live under More.
- **Progressive disclosure:**
  - **Lists** show only the title, a category dot, the status, one date or place, and a thumbnail.
  - **Detail pages** show every field, with the checklist, photos, notes, links and gift ideas in expandable sections.
  - **The add form** shows the essentials first, then optional sections: When, Where, Budget, Who & privacy, and Tags/photos/checklist.

## Secret Fantasy

A discreet, journal-style private space for the two of you. It is kept entirely separate from the bucket list.

- **Entries:** each has a title, private description, category, interest level (1–5), an optional image, personal notes, author and date. Status moves through Private, Shared, Discussing, Agreed and Completed.
- **Privacy:**
  - Every entry starts **private**, so only its author can see it. Sharing needs a confirmation, and the author can make it private again at any time.
  - **Personal notes stay private to whoever wrote them**, even after sharing.
- **Reactions:** your partner can respond with *Love this*, *Curious*, *Let's discuss* (which moves it to Discussing) or *Not comfortable*.
- **Consent:** each of you has an explicit *"I'm comfortable with this"* switch, plus a boundaries note visible to both.
  - **Agreed and Completed** become available only when **both** of you are comfortable and nobody has said *Not comfortable*.
  - **Withdrawing** comfort, or reacting *Not comfortable*, automatically moves it back to Discussing and off the wishlist. Consent is never assumed.
- **Shared wishlist:** you can add an entry once your partner has shown interest. It has an optional planned date, and either of you can remove it.
- **Discussion:** each shared entry has a thread for talking it through.
- **Device lock (optional):** you can set a PIN, stored as a salted hash on the device, and/or use Face ID, Touch ID or fingerprint via WebAuthn where supported.
  - It auto-locks after a minute in the background, and there is a lock-now button.
  - This lock is a convenience layer only. The real protection is in the database.

**Security is enforced in Postgres, not the UI** (`0002_secret_fantasy.sql`):
- **Row Level Security** sends private entries only to their author, sends personal notes only to their writer, and keeps outsiders out entirely.
- **Triggers** enforce the rest:
  - New entries must start private.
  - Only the author can edit the content or make an entry private again.
  - Agreed and Completed require consent from both partners.
  - The wishlist requires mutual interest.
  - Withdrawing consent automatically reverses Agreed and the wishlist.
- **Images** go in a separate private `fantasy` bucket. They can be read only by people who can see the entry, and written only by its author.

Fantasy data also never reaches search, the activity feed, notifications, calendars, exports, backups or the public share link. It loads only while the section is open, and is cleared from memory when you leave or lock it. These rules were tested against PostgreSQL with both partners and an outsider.

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
| **Secret Fantasy** | Private entries, confirmed sharing, partner reactions, explicit two-way consent, boundaries, shared wishlist, discussion, private notes, optional PIN/biometric lock. See above |
| **Polish** | Mobile-first, minimal design system, light and dark modes, reduced-motion support, 44px touch targets, keyboard focus rings, friendly empty states, installable (web manifest) |

## Project structure

```
supabase/
  migrations/0001_init.sql     Tables, RLS, RPCs, storage buckets, realtime
  migrations/0002_secret_fantasy.sql  Secret Fantasy tables, RLS, consent triggers, private bucket
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
  pages/                       Home, List, Map, Item detail/edit, Calendar, Memories, More, Timeline,
                               Surprise, Important dates, Gifts, Settings, Trash, Export, Share
  fantasy/                     Secret Fantasy: lock (PIN/WebAuthn), its own data provider, list/detail/edit
```

`supabase/migrations/0002_secret_fantasy.sql` holds the Secret Fantasy tables, RLS, consent triggers and private bucket.

## Database

`users` · `workspaces` · `workspace_members` · `items` · `item_votes` · `item_reactions` · `comments` · `subtasks` · `item_links` · `item_photos` · `wishlist_entries` · `important_dates` · `journal_entries` · `backups` · plus a `memories` view (the legacy table merged into `journal_entries`).

Secret Fantasy, from migration `0002`: `fantasies` · `fantasy_responses` (reaction, comfort, boundaries) · `fantasy_notes` (author-only) · `fantasy_comments`.

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
npm test        # unit tests: scoring, privacy rules, Secret Fantasy consent rules, recurrence, filters, stats, ICS, validation
npm run build   # production build
```

The SQL migration was tested against PostgreSQL 16 with a stubbed Supabase `auth`/`storage` schema. The tests covered partner linking, the two-member limit, surprise and hidden-gift visibility, vote spoofing, outsider access, validated restore, sharing and trash purge.

## Notes and limitations (MVP)

- **Reminders** use the browser Notification API and fire while the app is open or installed. Push notifications to a closed phone would need Web Push plus a scheduled Edge Function (a good v1.1).
- **Google Calendar** is read-only. You paste your calendar's *secret iCal address* in Settings, and recurring events show their first occurrence. Two-way sync is planned for v2.
- **Exports** are generated in the browser, so they work in both modes without a server.
- **Restoring a JSON backup** restores photo *records*. Photos appear if their files still exist in storage. Keep a photo ZIP for offline copies.
- **Out of scope for this version (v2):** two-way Google Calendar sync, public social sharing, in-app payments.
