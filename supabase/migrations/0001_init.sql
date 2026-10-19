-- =============================================================================
-- Couples Bucket List — initial schema
-- Run in Supabase: Dashboard → SQL Editor → paste & run   (or `supabase db push`)
--
-- Design notes
--  * Everything belongs to a `workspace`; a workspace has at most 2 members.
--  * Row Level Security enforces both membership AND the privacy rules:
--      - surprise items are invisible to the partner until revealed,
--      - hidden gifts are invisible to the partner until their reveal date.
--  * Items are soft-deleted (is_deleted / deleted_at). Child rows cascade only
--    on permanent delete (ON DELETE CASCADE).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users (public profile mirror of auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_color  text default '#e2555a',
  gcal_ical_url text,                 -- Google Calendar "secret address in iCal format" (read-only sync)
  created_at    timestamptz not null default now()
);

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- workspaces + membership
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default 'Our Bucket List' check (char_length(name) between 1 and 80),
  invite_code    text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  currency       text not null default 'INR' check (char_length(currency) = 3),
  share_enabled  boolean not null default false,
  share_token    text not null unique default encode(gen_random_bytes(16), 'hex'),
  last_backup_at timestamptz,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (user_id)                    -- one shared list per person
);

-- Membership check used by every policy. SECURITY DEFINER avoids RLS recursion.
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  created_by       uuid references public.users(id),
  added_by_both    boolean not null default false,       -- "Added by: Both"
  title            text not null check (char_length(trim(title)) between 1 and 140),
  description      text check (char_length(description) <= 5000),
  category         text not null default 'Experiences'
                   check (category in ('Travel','Food','Adventure','Relationship','Home','Experiences','Other')),
  priority         text not null default 'Someday' check (priority in ('Must-do','Someday','Dream')),
  status           text not null default 'Idea' check (status in ('Idea','Planned','In Progress','Completed')),
  timeframe        text check (char_length(timeframe) <= 80),   -- free text, e.g. "Spring 2027"
  start_date       date,
  end_date         date,
  location_name    text,
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  est_cost         numeric(12,2) check (est_cost >= 0),
  currency         text default 'INR',
  owner_user_id    uuid references public.users(id),   -- null = "Both"
  tags             text[] not null default '{}',
  cover_photo_id   uuid,
  is_surprise      boolean not null default false,
  reveal_date      date,
  revealed_at      timestamptz,
  savings_target   numeric(12,2) check (savings_target >= 0),
  savings_saved    numeric(12,2) not null default 0 check (savings_saved >= 0),
  reminder_at      timestamptz,
  reminder_done    boolean not null default false,
  completed_at     date,
  completion_note  text,
  would_do_again   smallint check (would_do_again between 1 and 5),
  actual_cost      numeric(12,2) check (actual_cost >= 0),
  is_deleted       boolean not null default false,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists items_ws_idx on public.items (workspace_id, is_deleted, status);

-- Can the current user see this item? (membership + surprise rule)
create or replace function public.can_see_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from items i
    where i.id = p_item and is_member(i.workspace_id)
      and ( not i.is_surprise or i.created_by = auth.uid() or i.revealed_at is not null
            or (i.reveal_date is not null and i.reveal_date <= current_date) )
  );
$$;

-- ---------------------------------------------------------------------------
-- per-item children
-- ---------------------------------------------------------------------------
create table if not exists public.item_votes (
  item_id      uuid not null references public.items(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  stars        smallint not null check (stars between 1 and 5),
  updated_at   timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table if not exists public.item_reactions (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  emoji        text not null check (emoji in ('heart','thumbs')),
  created_at   timestamptz not null default now(),
  unique (item_id, user_id, emoji)
);

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  body         text not null check (char_length(trim(body)) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create table if not exists public.subtasks (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 1 and 200),
  done         boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.item_links (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by   uuid references public.users(id),
  url          text not null check (url ~* '^https?://'),
  label        text,
  kind         text not null default 'inspiration' check (kind in ('inspiration','booking','other')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- journal entries (manual + auto-created when an item is completed)
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  item_id       uuid unique references public.items(id) on delete cascade,  -- null = manual entry
  created_by    uuid references public.users(id),
  title         text not null check (char_length(trim(title)) between 1 and 140),
  entry_date    date not null default current_date,
  note          text,
  rating        smallint check (rating between 1 and 5),
  category      text,
  location_name text,
  lat           double precision,
  lng           double precision,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Legacy "memories" — now just a view over journal entries linked to items.
create or replace view public.memories with (security_invoker = true) as
  select id, workspace_id, item_id, title, entry_date as completed_on, note, rating, created_at
  from public.journal_entries where item_id is not null;

-- ---------------------------------------------------------------------------
-- photos (album per item, or attached to a manual journal entry)
-- ---------------------------------------------------------------------------
create table if not exists public.item_photos (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  item_id          uuid references public.items(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete cascade,
  storage_path     text not null,            -- "<workspace_id>/<uuid>.jpg" in the `photos` bucket
  caption          text check (char_length(caption) <= 300),
  position         integer not null default 0,
  width            integer,
  height           integer,
  uploaded_by      uuid references public.users(id),
  created_at       timestamptz not null default now(),
  check (item_id is not null or journal_entry_id is not null)
);
create index if not exists item_photos_item_idx on public.item_photos (item_id, position);

-- ---------------------------------------------------------------------------
-- wishlist / gift ideas
-- ---------------------------------------------------------------------------
create table if not exists public.wishlist_entries (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id      uuid references public.items(id) on delete cascade,  -- linked bucket item (optional)
  created_by   uuid references public.users(id),
  for_user_id  uuid references public.users(id),                   -- who the gift is for
  name         text not null check (char_length(trim(name)) between 1 and 140),
  url          text check (url is null or url ~* '^https?://'),
  price        numeric(12,2) check (price >= 0),
  currency     text default 'INR',
  notes        text,
  is_hidden    boolean not null default false,
  reveal_date  date,
  is_gifted    boolean not null default false,
  gifted_at    timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- important dates
-- ---------------------------------------------------------------------------
create table if not exists public.important_dates (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  created_by           uuid references public.users(id),
  title                text not null check (char_length(trim(title)) between 1 and 100),
  date                 date not null,
  kind                 text not null default 'other'
                       check (kind in ('birthday','anniversary','together_since','first_date','other')),
  repeats_yearly       boolean not null default true,
  reminder_offset_days integer not null default 7 check (reminder_offset_days between 0 and 365),
  photo_path           text,
  notes                text,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- backups (metadata; files live in the private `backups` bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.backups (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by   uuid references public.users(id),
  kind         text not null default 'manual' check (kind in ('manual','auto','export')),
  format       text not null default 'json' check (format in ('json','csv','pdf','zip')),
  storage_path text,
  size_bytes   bigint,
  item_count   integer,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.users             enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.items             enable row level security;
alter table public.item_votes        enable row level security;
alter table public.item_reactions    enable row level security;
alter table public.comments          enable row level security;
alter table public.subtasks          enable row level security;
alter table public.item_links        enable row level security;
alter table public.journal_entries   enable row level security;
alter table public.item_photos       enable row level security;
alter table public.wishlist_entries  enable row level security;
alter table public.important_dates   enable row level security;
alter table public.backups           enable row level security;

-- users: see yourself and your partner; edit only yourself
drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (
  id = auth.uid() or exists (
    select 1 from workspace_members a join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = users.id)
);
drop policy if exists users_update on public.users;
create policy users_update on public.users for update using (id = auth.uid());

-- workspaces / members
drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select using (is_member(id));
drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update using (is_member(id));
drop policy if exists wm_select on public.workspace_members;
create policy wm_select on public.workspace_members for select using (is_member(workspace_id));

-- items: members, with the surprise rule.
-- The rule is written inline (not via can_see_item) so INSERT ... RETURNING can see the new row.
drop policy if exists items_select on public.items;
create policy items_select on public.items for select using (
  is_member(workspace_id) and (
    not is_surprise or created_by = auth.uid() or revealed_at is not null
    or (reveal_date is not null and reveal_date <= current_date))
);
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert with check (is_member(workspace_id) and created_by = auth.uid());
drop policy if exists items_update on public.items;
create policy items_update on public.items for update using (
  is_member(workspace_id) and (
    not is_surprise or created_by = auth.uid() or revealed_at is not null
    or (reveal_date is not null and reveal_date <= current_date))
) with check (is_member(workspace_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete using (
  is_member(workspace_id) and (
    not is_surprise or created_by = auth.uid() or revealed_at is not null
    or (reveal_date is not null and reveal_date <= current_date))
);

-- Generic child-table policies: member of workspace AND can see the parent item.
do $$
declare t text;
begin
  foreach t in array array['subtasks','item_links'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all
                    using (is_member(workspace_id) and can_see_item(item_id))
                    with check (is_member(workspace_id) and can_see_item(item_id))', t);
  end loop;
end $$;

-- votes & reactions: everyone in the workspace can read; you can only write your own.
do $$
declare t text;
begin
  foreach t in array array['item_votes','item_reactions','comments'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select using (is_member(workspace_id) and can_see_item(item_id))', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for insert with check (is_member(workspace_id) and user_id = auth.uid() and can_see_item(item_id))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update using (user_id = auth.uid())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (user_id = auth.uid() or (is_member(workspace_id) and can_see_item(item_id)))', t);
  end loop;
end $$;

-- photos & journal
drop policy if exists photos_all on public.item_photos;
create policy photos_all on public.item_photos for all
  using (is_member(workspace_id) and (item_id is null or can_see_item(item_id)))
  with check (is_member(workspace_id) and (item_id is null or can_see_item(item_id)));
drop policy if exists journal_all on public.journal_entries;
create policy journal_all on public.journal_entries for all
  using (is_member(workspace_id) and (item_id is null or can_see_item(item_id)))
  with check (is_member(workspace_id));

-- wishlist: hidden gifts invisible to the partner until reveal_date
drop policy if exists wishlist_select on public.wishlist_entries;
create policy wishlist_select on public.wishlist_entries for select using (
  is_member(workspace_id)
  and (item_id is null or can_see_item(item_id))
  and (not is_hidden or created_by = auth.uid() or (reveal_date is not null and reveal_date <= current_date))
);
drop policy if exists wishlist_insert on public.wishlist_entries;
create policy wishlist_insert on public.wishlist_entries for insert with check (is_member(workspace_id) and created_by = auth.uid());
drop policy if exists wishlist_update on public.wishlist_entries;
create policy wishlist_update on public.wishlist_entries for update using (
  is_member(workspace_id) and (not is_hidden or created_by = auth.uid() or (reveal_date is not null and reveal_date <= current_date)));
drop policy if exists wishlist_delete on public.wishlist_entries;
create policy wishlist_delete on public.wishlist_entries for delete using (is_member(workspace_id) and (created_by = auth.uid() or not is_hidden));

-- dates & backups
drop policy if exists dates_all on public.important_dates;
create policy dates_all on public.important_dates for all using (is_member(workspace_id)) with check (is_member(workspace_id));
drop policy if exists backups_all on public.backups;
create policy backups_all on public.backups for all using (is_member(workspace_id)) with check (is_member(workspace_id));

-- =============================================================================
-- RPCs
-- =============================================================================

-- Create a workspace for the caller (first partner).
create or replace function public.create_workspace(p_name text default 'Our Bucket List', p_currency text default 'INR')
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare ws workspaces;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from workspace_members where user_id = auth.uid()) then
    raise exception 'You already belong to a shared list';
  end if;
  insert into users (id) values (auth.uid()) on conflict do nothing;
  insert into workspaces (name, currency, created_by) values (coalesce(nullif(trim(p_name),''),'Our Bucket List'), p_currency, auth.uid())
    returning * into ws;
  insert into workspace_members (workspace_id, user_id) values (ws.id, auth.uid());
  return ws;
end $$;

-- Second partner joins with the invite code. Max two members.
create or replace function public.join_workspace(p_code text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare ws workspaces; n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into ws from workspaces where invite_code = upper(trim(p_code));
  if ws.id is null then raise exception 'That invite code was not found'; end if;
  if exists (select 1 from workspace_members where user_id = auth.uid()) then
    raise exception 'You already belong to a shared list';
  end if;
  select count(*) into n from workspace_members where workspace_id = ws.id;
  if n >= 2 then raise exception 'This list already has two partners'; end if;
  insert into users (id) values (auth.uid()) on conflict do nothing;
  insert into workspace_members (workspace_id, user_id) values (ws.id, auth.uid());
  return ws;
end $$;

-- Dashboard aggregates in one round-trip (respects the surprise rule via can_see_item).
create or replace function public.dashboard_summary(p_ws uuid)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'total',        count(*),
    'completed',    count(*) filter (where status = 'Completed'),
    'in_progress',  count(*) filter (where status = 'In Progress'),
    'planned',      count(*) filter (where status = 'Planned'),
    'ideas',        count(*) filter (where status = 'Idea'),
    'completed_this_year', count(*) filter (where status = 'Completed' and date_part('year', completed_at) = date_part('year', current_date)),
    'spent_this_year', coalesce(sum(coalesce(actual_cost, est_cost)) filter (where status = 'Completed' and date_part('year', completed_at) = date_part('year', current_date)), 0),
    'by_category',  (select coalesce(json_object_agg(category, n), '{}'::json) from (select category, count(*) n from items where workspace_id = p_ws and not is_deleted group by category) c)
  )
  from items where workspace_id = p_ws and not is_deleted;
$$;

-- Public read-only share view. Returns nothing unless sharing is switched on.
-- Excludes deleted items, surprises and all private data (gifts, comments).
create or replace function public.get_shared_list(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare w workspaces;
begin
  select * into w from workspaces where share_token = p_token and share_enabled;
  if w.id is null then return null; end if;
  return json_build_object(
    'name', w.name,
    'items', coalesce((
      select json_agg(json_build_object(
        'id', i.id, 'title', i.title, 'description', i.description, 'category', i.category,
        'priority', i.priority, 'status', i.status, 'timeframe', i.timeframe,
        'start_date', i.start_date, 'location_name', i.location_name, 'completed_at', i.completed_at
      ) order by i.created_at)
      from items i where i.workspace_id = w.id and not i.is_deleted and not i.is_surprise), '[]'::json)
  );
end $$;
grant execute on function public.get_shared_list(text) to anon, authenticated;

-- Restore from a JSON backup. Rows keep their original authors (which plain RLS
-- inserts would reject for the partner's votes/comments), so this runs as definer
-- after checking that every row targets the caller's workspace and every user
-- reference belongs to that workspace.
create or replace function public.import_rows(p_table text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n int; bad int;
begin
  if p_table not in ('items','subtasks','item_links','comments','item_votes','item_reactions',
                     'journal_entries','item_photos','wishlist_entries','important_dates') then
    raise exception 'Invalid table %', p_table;
  end if;
  select count(*) into bad from jsonb_array_elements(p_rows) r
   where not is_member((r->>'workspace_id')::uuid)
      or exists (
        select 1 from unnest(array[r->>'created_by', r->>'user_id', r->>'owner_user_id', r->>'uploaded_by', r->>'for_user_id']) u(id)
        where u.id is not null and not exists (
          select 1 from workspace_members m where m.workspace_id = (r->>'workspace_id')::uuid and m.user_id = u.id::uuid)
      );
  if bad > 0 then raise exception 'Backup rows reference a workspace or person you are not linked to'; end if;
  execute format('insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1)', p_table) using p_rows;
  get diagnostics n = row_count;
  return n;
end $$;

-- Permanently remove trash older than 30 days (rows only; the app removes photo files).
-- Optional: schedule with pg_cron →  select cron.schedule('purge-trash','0 3 * * *','select public.purge_old_trash()');
create or replace function public.purge_old_trash() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from items where is_deleted and deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- =============================================================================
-- Storage buckets (private) + policies: first path segment must be your workspace id
-- =============================================================================
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do nothing;

drop policy if exists "workspace files read" on storage.objects;
create policy "workspace files read" on storage.objects for select to authenticated
  using (bucket_id in ('photos','backups') and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "workspace files write" on storage.objects;
create policy "workspace files write" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos','backups') and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "workspace files update" on storage.objects;
create policy "workspace files update" on storage.objects for update to authenticated
  using (bucket_id in ('photos','backups') and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "workspace files delete" on storage.objects;
create policy "workspace files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('photos','backups') and public.is_member(((storage.foldername(name))[1])::uuid));

-- =============================================================================
-- Realtime: push partner changes live
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['items','item_votes','item_reactions','comments','subtasks','item_links',
                           'item_photos','wishlist_entries','important_dates','journal_entries'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
