# Our Bucket List

A calm, private, mobile-first app for two people to dream, plan and remember together. It has one shared bucket list with voting, photo albums, secret gifts, important dates, a memory timeline, a calendar, and **Secret Fantasy**, a private space just for the two of you.

**Stack:** React 18 · Vite · Tailwind CSS · Supabase (Auth, Postgres + Row Level Security, Storage, Realtime, one Edge Function) · Leaflet/OpenStreetMap · dnd-kit · jsPDF · JSZip

---

## Quick start (Demo Mode, local development only)

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without database settings, `npm run dev` runs **Demo Mode**: there is no login screen, and the app opens straight to Home as the first partner (Ayvon). Sample items, two important dates and a hidden gift are seeded. Everything is stored in this browser only (localStorage + IndexedDB for photos).

> **Demo Mode is never used for a deployed site.** A production build without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` shows *"The shared database isn't connected"* and saves nothing.
>
> Earlier versions silently fell back to Demo Mode. Each phone then kept its own separate list, so one partner saw an older or different list than the other.
>
> (Set `VITE_DEMO_MODE=true` only if you deliberately want a browser-only demo build.)

To see the list from the other side, open http://localhost:5173/#key=aksa. That browser then opens as Aksa, and Ayvon's surprises, hidden gifts and private fantasies disappear. Demo data lives in one browser only, so Demo Mode can't keep two phones in sync. Use Supabase for that.

## Real two-person setup (Supabase)

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Run the schema.** In the dashboard open **SQL Editor** and run these files in order:
   - [`0001_init.sql`](supabase/migrations/0001_init.sql): tables, RLS policies, RPCs, the private `photos` and `backups` buckets, realtime.
   - [`0002_secret_fantasy.sql`](supabase/migrations/0002_secret_fantasy.sql): Secret Fantasy tables, consent rules and the private `fantasy` bucket.
   - [`0003_upgrade.sql`](supabase/migrations/0003_upgrade.sql): usernames, editable categories, the new item fields and statuses, Secret Fantasy v2 (visibility, statuses, photos, "hide from my list").
   - [`0004_item_creator.sql`](supabase/migrations/0004_item_creator.sql): the **Created by** field (`creator_id`) and **last edited by** (`updated_by`). Existing items keep an empty creator until you pick one; nothing is guessed.

   All four are safe to re-run and **preserve existing data**. If you already ran the earlier files, run only the ones you haven't. `0003` maps old values rather than deleting them:
   - priorities `Must-do → High`, `Someday → Medium`, `Dream → Low`
   - old category names → the new categories (the original text is kept in `legacy_category`)
   - old fantasy statuses → visibility + status

   *With the Supabase CLI instead:* `supabase link --project-ref <ref>` then `supabase db push`.
3. **Lock down sign-ups.** In **Authentication → Providers → Email**, turn **off** "Allow new users to sign up". Only your two accounts can then open the app; there is no anonymous access.
4. **Add your public keys** (the anon key is safe in the browser; RLS protects the data):
   ```bash
   cp .env.example .env.local
   # VITE_SUPABASE_URL=https://xxxx.supabase.co
   # VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. **Create the two accounts and personal links** (see below).
6. *(Optional)* **Enable Google Calendar sync** by deploying the iCal proxy: `supabase functions deploy ical-proxy`.
7. **Deploy** (see *Deploying* below). Both phones must open the **same deployed address**, and that build must have the two `VITE_SUPABASE_*` settings.

### Deploying (Vercel, Netlify or Cloudflare Pages)

Vite reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` **when the site is built**, not when it's opened. They must therefore be set in the host's settings before the build runs:

1. **Vercel:** Project → Settings → Environment Variables. Add both for **Production** (and Preview if you use it).
2. **Redeploy** (Deployments → ⋯ → Redeploy). Changing variables does not update a build that already exists.
3. Open the site. It should show *"This is a private app"* (or Home, if this phone already has its personal link). *"The shared database isn't connected"* means the variables didn't reach the build.
4. Open each personal link once on its owner's phone.

**Dreams saved before the database was connected.** These lived only in that phone's browser. The first time you open the connected app on that phone, Home shows *"N dreams are saved only on this device"*, and one tap copies them into the shared list. Sample dreams are left unticked, and "Created by" is left for you to choose.

SPA rewrites are included (`vercel.json`, `public/_redirects`). **Never** put the service-role key in these settings.

### No login screen: personal links

The app has no login page. Each of you opens a **personal link** once on your own phone. That signs the phone in, and from then on the app always opens straight to Home as you. Each new dream records who created it (you choose Ayvon or Aksa in the form).

Create the accounts and links with the setup script, **on your own computer**. It needs the project's **service-role key**, which must never go in `.env.local`, a `VITE_` variable or the repo:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...  npm run setup-accounts
```

It asks for your app's address (or reads `APP_URL`), the list name, and each partner's username and display name. Then it:
- creates both users in Supabase Auth, or **updates the existing user with that username** rather than creating a duplicate;
- links both users to one shared workspace, creating the workspace if needed;
- prints two links, like `https://your-app/#key=ayvon.<secret>`.

Send each link only to its owner and open it once on their phone.

**How the links are protected:**
- Each secret is a fresh random 256-bit value. Supabase Auth stores only its bcrypt hash.
- The key sits after `#`, so browsers never send it to any server, and the app removes it from the address bar straight away.
- The phone keeps its Supabase session and also remembers the key, so it can sign itself in again if the session ever expires.
- Anyone else who opens the app sees only "This is a private app". There is no form, and the database rejects every request without a session.
- **Treat a link like a password.** If a phone is lost, run the script again. That replaces both links, and the old ones stop working.

*(Inviting by code still works: the first user can choose **Start our list** and the partner **I have a code**. A workspace accepts at most two members, and each person can belong to only one workspace.)*

---

## Design

The interface is deliberately quiet: warm off-white (`#FAF9F7`), charcoal text (`#252326`), muted grey (`#858087`), and a single muted-rose accent (`#C65D70`, blush `#F6E9EC`) used sparingly. Borders are hairlines (`#EAE6E5`) and there are no heavy shadows. Icons are thin line icons, with no emoji.

- **Type:** body text is Inter; Instrument Serif appears only on page titles and a few hero numbers.
- **Light and dark modes:** both are fully supported, set to Automatic, Light or Dark in Settings.
- **Navigation:** Home · Bucket List · Calendar · Memories · More, as a bottom bar on phones and a sidebar on desktop. Secret Fantasy, Timeline, Surprise Me, Budget, Categories, Important dates, Gift ideas, Map, Export, Recently deleted and Settings live under More.
- **Progressive disclosure:**
  - **Lists** show only the title, a category dot, the status, one date or place, and a thumbnail.
  - **Detail pages** show every field, with the checklist, photos, notes, links and gift ideas in expandable sections.
  - **The add form** shows the essentials first, then optional sections: When, Where, Budget, Who & privacy, and Tags/photos/checklist.

## Secret Fantasy

A discreet, journal-style private space for the two of you. It is kept entirely separate from the bucket list.

- **Entries:** each has a title, description, category, interest level (1–5), an optional image, target date, personal notes, author and dates (added, planned, completed). Each row has a checkbox, like the bucket list.
- **Categories:** editable in **More → Categories → Fantasy**. You can add, rename, reorder or remove them; when you remove one, its entries move to a category you choose.
- **Statuses**, chosen directly: Idea, Saved, Want to Discuss, Mutually Agreed, Planned, In Progress, Completed, Not Interested / Archived.
- **Privacy:**
  - **Visibility is separate from status.** Every entry starts **private**, so only its author can see it. Sharing needs a confirmation, and the author can make it private again at any time.
  - **Sharing is not agreement.** A shared entry stays at its status until you both respond.
  - **Personal notes stay private to whoever wrote them**, even after sharing.
- **Reactions:** *Interested*, *Curious*, *Let's discuss* or *Not comfortable*. You can change your reaction at any time.
- **Consent:** each of you has an explicit *"I'm comfortable with this"* switch, plus a boundaries note visible to both.
  - On shared entries, **Mutually Agreed, Planned, In Progress and Completed** are available only when **both** of you are comfortable and nobody has said *Not comfortable*.
  - **Withdrawing** comfort, or reacting *Not comfortable*, moves an unfinished entry back to *Want to Discuss* and off the wishlist. Completed history is kept.
  - **No pressure:** either of you can pause, archive, or *hide it from my list* (removing your participation) at any time.
- **Completion:** the completion date is recorded automatically, and you're asked *"How was the experience?"*. The note and rating are optional and can be edited later.
- **Photos:** a shared entry can have photos only if **both** of you allow them.
- **Shared wishlist:** you can add an entry once you have both shown interest. It has an optional planned date, and either of you can remove it.
- **Discussion:** each shared entry has a thread for talking it through.
- **Device lock (optional):** you can set a PIN, stored as a salted hash on the device, and/or use Face ID, Touch ID or fingerprint via WebAuthn where supported.
  - It auto-locks after a minute in the background, and there is a lock-now button.
  - This lock is a convenience layer only. The real protection is in the database.

**Security is enforced in Postgres, not the UI** (`0002_secret_fantasy.sql`, `0003_upgrade.sql`):
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
| **Access** | No login screen: the app opens straight to Home. Each phone is linked once with its owner's personal link. Two accounts only; no public sign-up; the database protects everything else |
| **One shared list** | Ayvon and Aksa read and write one list in one database, with no separate sides. Changes arrive instantly through Supabase Realtime. Each phone also re-fetches when the app is reopened, comes back online, or every 20 seconds, so a phone that was asleep never shows an old list |
| **Created by** | Every new dream needs an explicit **Created by: Ayvon / Aksa**; it is never assumed from whoever is using the app. It shows as a small "Created by Aksa" in list view, grid view and on the detail page, and can be changed when editing. It is stored separately from who entered the item and from who last edited it (shown as "last edited by …"). Older items without a creator show no label until you choose one |
| **One item system** | Every dream works the same way: add → save → plan → complete → record. Categories are filtered views of one list. Every row has a checkbox; ticking it records today's date and updates the stats, and unticking reopens it. Each item has edit, duplicate, delete (with confirmation) and a detail page |
| **Items** | Title, description, category + subcategory, priority (Low/Medium/High), status (Idea, Planned, In Progress, Completed, On Hold), target dates, time required, location with map pin (OSM search), estimated budget and actual cost (EUR/INR), tags, notes, links, cover photo |
| **Categories** | Add, rename, recolour, reorder or remove (entries move to a fallback category you choose). Open a category to see its list and progress |
| **Preparation** | Checklist tasks with optional due dates (overdue shown in rose) and their own progress bar |
| **Budget** | Per currency: still to fund, saved so far, spent on completed dreams |
| **Couple interactions** | ❤️ / 👍 reactions, comment thread, **Surprise** toggle (hidden from your partner until you reveal it or until an auto-reveal date) |
| **Voting** | 1–5 stars from each partner, a combined 0–100 mutual score, a **"We both want this"** badge when both vote 4★+, sorting/filtering by mutual priority, and Top Picks on the dashboard |
| **Planning** | Checklist, links/bookings, savings progress bar (with quick "+ add"), reminder date and time |
| **Completion** | "How was the experience?": completion date, rating, favourite memory, short note, optional reflection, "would do again", final cost and photos. All of it can be edited later. Completed items appear in Memories (filter by year, category, partner) and on the Timeline |
| **Photo albums** | Multi-upload with compression (max 1600px, about 0.5 MB), reorder, captions, delete, set cover, grid plus full-screen swipeable lightbox |
| **Wishlist / gifts** | Gift ideas per item (or standalone), with name, link, price, notes, who it's for, and a "Hide from partner" option with a reveal date. Also: a "Gifts for me" view and marking as gifted |
| **Important dates** | Birthdays, anniversaries, together-since, first date. Yearly repeat, reminder offset, photo, years count ("Our anniversary · 3rd"). Shown on the calendar and as dashboard countdowns |
| **Timeline** | Chronological journal of completed items, manual entries (with their own photos) and milestones. Filter by year, category or person. Includes a **Year in review** summary |
| **Surprise me** | Random pick filtered by category, budget, time required and priority (Secret Fantasy is never included). Mutual favourites are weighted slightly higher. Slot-machine reveal, then **Reroll** or **Lock it in** (status set to Planned with a date) |
| **Search & filters** | Search title, description, notes, tags and place. Filter by category, status, priority, created by, target date, completion date, budget range and time required |
| **Calendar** | Month / week / agenda views. Tap an event to change its date or open the dream. Drag and drop to reschedule (keeps trip length; undo toast). Tap a day to add an item or date. Colour by category, status or type. Countdowns, show/hide completed, read-only Google Calendar overlay |
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
  migrations/0003_upgrade.sql  Usernames, categories, item fields, Secret Fantasy v2 (non-destructive)
  functions/ical-proxy/        Edge Function: fetches Google Calendar iCal feeds (CORS)
src/
  data/                        Backend layer — same interface for both modes
    backend.js                 Chooses Supabase (or Demo Mode in local dev only) from env vars
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
scripts/setup-accounts.mjs     Creates/updates the two Supabase Auth accounts (run locally, service-role key)
```

## Database

`users` · `workspaces` · `workspace_members` · `items` · `item_votes` · `item_reactions` · `comments` · `subtasks` · `item_links` · `item_photos` · `wishlist_entries` · `important_dates` · `journal_entries` · `backups` · plus a `memories` view (the legacy table merged into `journal_entries`).

From migration `0003`: `categories` (per workspace, `bucket` or `fantasy`, with RPCs `rename_category` and `delete_category`).

Secret Fantasy, from migrations `0002`/`0003`: `fantasies` · `fantasy_responses` (reaction, comfort, boundaries, hidden, allow_photos) · `fantasy_notes` (author-only) · `fantasy_comments` · `fantasy_photos`.

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

The SQL migrations were tested against PostgreSQL 16 with a stubbed Supabase `auth`/`storage` schema. The tests covered:
- partner linking and the two-member limit
- surprise and hidden-gift visibility, vote spoofing and outsider access
- validated restore, sharing and trash purge
- for `0003`: data mapping on existing rows, re-running safely, the fantasy consent and photo rules, and category rename/delete

**Shared database, two browsers.** This was tested end to end against a real Postgres + Supabase Auth (GoTrue) + PostgREST stack, run locally. The tests used two separate browsers (Ayvon's phone and Aksa's phone), each with its personal link from the real `setup-accounts` script:
- **Bug reproduced first:** with the build that was then live, the partner didn't see a new item, because it was only in browser storage.
- **Shared items:** with the fix, items added on either phone are saved to the database and appear on the other phone without a refresh (within about 20 seconds via the background refresh; Realtime was not part of the test stack).
- **Edits, completion and refreshes:** edits and completions (with date) reach both phones, and everything survives a refresh on both.
- **"Created by":**
  - it is required on new items and saved separately from who entered or last edited the item;
  - it stays when the other partner edits, and can be changed;
  - it shows in list, grid and detail;
  - older items stay empty until chosen;
  - the database rejects anyone outside the two of you.
- **Other checks:**
  - anonymous API requests get nothing, and a private fantasy stays hidden from the partner;
  - a build without settings shows "not connected";
  - re-running `setup-accounts` updates the accounts instead of duplicating them.

The app was also tested end to end in Demo Mode with Playwright (mobile and desktop):
- opening straight to Home, personal links, existing data kept after upgrading from the login version, and private fantasies staying private
- item create/edit/duplicate/delete, checkbox completion and reopen updating the stats, and editing the experience note
- categories, search and filters, the calendar event sheet, budget and memories
- fantasy privacy between partners, the consent gate, the completion prompt and the photo rule

`scripts/setup-accounts.mjs` was run against the local Supabase Auth server. Running it against your hosted project is the one step that has to happen on your side.

## Notes and limitations (MVP)

- **Reminders** use the browser Notification API and fire while the app is open or installed. Push notifications to a closed phone would need Web Push plus a scheduled Edge Function (a good v1.1).
- **Google Calendar** is read-only. You paste your calendar's *secret iCal address* in Settings, and recurring events show their first occurrence. Two-way sync is planned for v2.
- **Exports** are generated in the browser, so they work in both modes without a server.
- **Restoring a JSON backup** restores photo *records*. Photos appear if their files still exist in storage. Keep a photo ZIP for offline copies.
- **Out of scope for this version (v2):** two-way Google Calendar sync, public social sharing, in-app payments.
