-- =============================================================================
-- 0003 — Accounts, editable categories, richer items, Secret Fantasy v2
-- Additive & safe to re-run. Existing rows are kept; changed enum values are
-- mapped (and the original category text is kept in legacy_category).
--   Priority:   Must-do → High · Someday → Medium · Dream → Low
--   Categories: Travel, Adventure → Travel & Adventures · Food, Experiences → Food & Experiences
--               Relationship → Romantic Dates · Home → Dream Home · Other → General
--   Fantasy:    status 'private'/'shared'/'discussing' → visibility + new status
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Usernames (login is username + password through Supabase Auth)
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists username text;
create unique index if not exists users_username_key on public.users (lower(username));

-- ---------------------------------------------------------------------------
-- Editable categories (bucket list + Secret Fantasy)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind         text not null default 'bucket' check (kind in ('bucket','fantasy')),
  name         text not null check (char_length(trim(name)) between 1 and 60),
  color        text not null default '#8A8590',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (workspace_id, kind, name)
);
alter table public.categories enable row level security;
drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all using (is_member(workspace_id)) with check (is_member(workspace_id));

create or replace function public.seed_default_categories(p_ws uuid) returns void
language sql security definer set search_path = public as $$
  insert into categories (workspace_id, kind, name, color, position) values
    (p_ws, 'bucket', 'General',              '#8A8590', 0),
    (p_ws, 'bucket', 'Travel & Adventures',  '#6E8FAF', 1),
    (p_ws, 'bucket', 'Romantic Dates',       '#C65D70', 2),
    (p_ws, 'bucket', 'Dream Home',           '#8E7DA6', 3),
    (p_ws, 'bucket', 'Food & Experiences',   '#C39A62', 4),
    (p_ws, 'bucket', 'Personal Goals',       '#6F9884', 5),
    (p_ws, 'bucket', 'Special Occasions',    '#B0809A', 6),
    (p_ws, 'fantasy', 'Romantic Fantasies',            '#C65D70', 0),
    (p_ws, 'fantasy', 'Date Night Fantasies',          '#B0809A', 1),
    (p_ws, 'fantasy', 'Travel & Adventure Fantasies',  '#6E8FAF', 2),
    (p_ws, 'fantasy', 'Special Experiences',           '#C39A62', 3),
    (p_ws, 'fantasy', 'Intimacy & Connection',         '#9B6B8E', 4),
    (p_ws, 'fantasy', 'Roleplay & Imagination',        '#8E7DA6', 5),
    (p_ws, 'fantasy', 'Personal Wishes',               '#6F9884', 6),
    (p_ws, 'fantasy', 'Other',                         '#8A8590', 7)
  on conflict (workspace_id, kind, name) do nothing;
$$;

create or replace function public.workspace_seed_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform seed_default_categories(new.id); return new; end $$;
drop trigger if exists workspace_seed_categories on public.workspaces;
create trigger workspace_seed_categories after insert on public.workspaces
  for each row execute function public.workspace_seed_trigger();

do $$ declare w record; begin
  for w in select id from public.workspaces loop perform public.seed_default_categories(w.id); end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Items: priority Low/Medium/High, On Hold, category_id and new fields
-- ---------------------------------------------------------------------------
alter table public.items drop constraint if exists items_category_check;
alter table public.items drop constraint if exists items_priority_check;
alter table public.items drop constraint if exists items_status_check;

update public.items set priority = case priority when 'Must-do' then 'High' when 'Someday' then 'Medium' when 'Dream' then 'Low' else priority end
  where priority in ('Must-do','Someday','Dream');
alter table public.items alter column priority set default 'Medium';
alter table public.items alter column category set default 'General';
alter table public.items add constraint items_priority_check check (priority in ('Low','Medium','High'));
alter table public.items add constraint items_status_check check (status in ('Idea','Planned','In Progress','Completed','On Hold'));

alter table public.items add column if not exists category_id      uuid references public.categories(id) on delete set null;
alter table public.items add column if not exists legacy_category  text;
alter table public.items add column if not exists subcategory      text check (char_length(subcategory) <= 60);
alter table public.items add column if not exists notes            text check (char_length(notes) <= 5000);
alter table public.items add column if not exists time_required    text check (time_required in ('Few hours','Half day','Full day','Weekend','A week or more'));
alter table public.items add column if not exists satisfaction     smallint check (satisfaction between 1 and 5);
alter table public.items add column if not exists favourite_memory text check (char_length(favourite_memory) <= 1000);
alter table public.items add column if not exists reflection       text check (char_length(reflection) <= 10000);

-- Map legacy category text onto the new categories (keeps the original in legacy_category).
update public.items i set legacy_category = i.category where i.legacy_category is null and i.category_id is null;
update public.items i
   set category_id = c.id, category = c.name
  from public.categories c
 where i.category_id is null and c.workspace_id = i.workspace_id and c.kind = 'bucket'
   and c.name = case i.category
                  when 'Travel' then 'Travel & Adventures' when 'Adventure' then 'Travel & Adventures'
                  when 'Food' then 'Food & Experiences'   when 'Experiences' then 'Food & Experiences'
                  when 'Relationship' then 'Romantic Dates' when 'Home' then 'Dream Home'
                  when 'Other' then 'General' else i.category end;

alter table public.subtasks add column if not exists due_date date;
alter table public.journal_entries add column if not exists favourite_moment text check (char_length(favourite_moment) <= 1000);

create or replace function public.dashboard_summary(p_ws uuid)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'total',        count(*),
    'completed',    count(*) filter (where status = 'Completed'),
    'in_progress',  count(*) filter (where status = 'In Progress'),
    'planned',      count(*) filter (where status = 'Planned'),
    'ideas',        count(*) filter (where status = 'Idea'),
    'on_hold',      count(*) filter (where status = 'On Hold'),
    'completed_this_year', count(*) filter (where status = 'Completed' and date_part('year', completed_at) = date_part('year', current_date))
  )
  from items where workspace_id = p_ws and not is_deleted;
$$;

-- Rename / remove a category for everyone (updates the denormalised name on items and fantasies).
create or replace function public.rename_category(p_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare c categories;
begin
  select * into c from categories where id = p_id;
  if c.id is null or not is_member(c.workspace_id) then raise exception 'Category not found'; end if;
  update categories set name = trim(p_name) where id = p_id;
  perform set_config('app.bypass_fantasy_guard', 'on', true);
  if c.kind = 'bucket' then update items set category = trim(p_name) where category_id = p_id;
  else update fantasies set category = trim(p_name) where category_id = p_id; end if;
end $$;

create or replace function public.delete_category(p_id uuid, p_fallback uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c categories; f categories;
begin
  select * into c from categories where id = p_id;
  select * into f from categories where id = p_fallback;
  if c.id is null or not is_member(c.workspace_id) then raise exception 'Category not found'; end if;
  if f.id is null or f.workspace_id <> c.workspace_id or f.kind <> c.kind or f.id = c.id then raise exception 'Choose another category to move entries into'; end if;
  perform set_config('app.bypass_fantasy_guard', 'on', true);
  if c.kind = 'bucket' then update items set category_id = f.id, category = f.name where category_id = p_id;
  else update fantasies set category_id = f.id, category = f.name where category_id = p_id; end if;
  delete from categories where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Secret Fantasy v2: visibility separate from status
--   visibility: private | shared
--   status:     idea | saved | discuss | agreed | planned | in_progress | completed | archived
-- ---------------------------------------------------------------------------
alter table public.fantasies drop constraint if exists fantasies_category_check;
alter table public.fantasies add column if not exists category_id       uuid references public.categories(id) on delete set null;
alter table public.fantasies add column if not exists legacy_category   text;
alter table public.fantasies add column if not exists experience_note   text check (char_length(experience_note) <= 5000);
alter table public.fantasies add column if not exists experience_rating smallint check (experience_rating between 1 and 5);

alter table public.fantasy_responses add column if not exists hidden       boolean not null default false; -- "archived for me"
alter table public.fantasy_responses add column if not exists allow_photos boolean not null default false; -- consent to keep photos

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fantasies' and column_name = 'visibility') then
    alter table public.fantasies disable trigger fantasy_guard_upd;
    alter table public.fantasies drop constraint if exists fantasies_status_check;
    alter table public.fantasies add column visibility text not null default 'private';
    update public.fantasies set visibility = case when status = 'private' then 'private' else 'shared' end,
                                status = case status when 'private' then 'idea' when 'shared' then 'saved' when 'discussing' then 'discuss' else status end;
    alter table public.fantasies enable trigger fantasy_guard_upd;
  end if;
end $$;

alter table public.fantasies drop constraint if exists fantasies_status_check;
alter table public.fantasies drop constraint if exists fantasies_visibility_check;
alter table public.fantasies alter column status set default 'idea';
alter table public.fantasies add constraint fantasies_visibility_check check (visibility in ('private','shared'));
alter table public.fantasies add constraint fantasies_status_check
  check (status in ('idea','saved','discuss','agreed','planned','in_progress','completed','archived'));

-- Map fantasy categories (keeps the original text in legacy_category).
alter table public.fantasies disable trigger fantasy_guard_upd;
update public.fantasies f set legacy_category = f.category where f.legacy_category is null and f.category_id is null;
update public.fantasies f
   set category_id = c.id, category = c.name
  from public.categories c
 where f.category_id is null and c.workspace_id = f.workspace_id and c.kind = 'fantasy'
   and c.name = case f.category
                  when 'Romance' then 'Romantic Fantasies' when 'Intimacy' then 'Intimacy & Connection'
                  when 'Sensual' then 'Intimacy & Connection' when 'Adventure' then 'Travel & Adventure Fantasies'
                  when 'Getaway' then 'Travel & Adventure Fantasies' when 'Roleplay' then 'Roleplay & Imagination'
                  else 'Other' end;
alter table public.fantasies enable trigger fantasy_guard_upd;
alter table public.fantasies alter column category set default 'Other';

create or replace function public.can_see_fantasy(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from fantasies f where f.id = p_id and is_member(f.workspace_id)
                 and (f.created_by = auth.uid() or f.visibility = 'shared'));
$$;

-- Statuses that mean "we are doing this together" need both partners' consent.
create or replace function public.fantasy_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.bypass_fantasy_guard', true) = 'on' then return new; end if;  -- category rename/delete RPCs

  if tg_op = 'INSERT' then
    if new.visibility <> 'private' then raise exception 'New fantasies start private'; end if;
    if new.status = 'agreed' then raise exception 'Share it first to agree together'; end if;
    new.on_wishlist := false;
    if new.status = 'completed' then new.completed_at := coalesce(new.completed_at, current_date); end if;
    return new;
  end if;

  -- The partner may move it through the conversation, but never edit its content or change who can see it.
  if auth.uid() is distinct from old.created_by then
    if new.title is distinct from old.title or new.description is distinct from old.description
       or new.category is distinct from old.category or new.category_id is distinct from old.category_id
       or new.interest_level is distinct from old.interest_level or new.image_path is distinct from old.image_path
       or new.created_by is distinct from old.created_by or new.workspace_id is distinct from old.workspace_id then
      raise exception 'Only the author can edit this fantasy';
    end if;
    if new.visibility is distinct from old.visibility then raise exception 'Only the author can change who sees this'; end if;
  end if;

  if old.visibility = 'private' and new.visibility = 'shared' then new.shared_at := now(); end if;
  if new.visibility = 'private' then
    new.on_wishlist := false;
    new.shared_at := null;
    -- Unsharing: conversation-only statuses fall back to "saved".
    if old.visibility = 'shared' and new.status in ('discuss','agreed') then new.status := 'saved'; end if;
  end if;

  if new.status is distinct from old.status then
    if new.visibility = 'private' and new.status = 'agreed' then raise exception 'Share it first to agree together'; end if;
    if new.visibility = 'shared' and new.status in ('agreed','planned','in_progress','completed') and not fantasy_has_consent(new.id) then
      raise exception 'Both of you need to say you are comfortable first';
    end if;
    if new.status = 'completed' then new.completed_at := coalesce(new.completed_at, current_date);
    elsif old.status = 'completed' then new.completed_at := null; end if;
  end if;

  if new.on_wishlist and not old.on_wishlist and (new.visibility <> 'shared' or not fantasy_mutual_interest(new.id)) then
    raise exception 'Both of you need to be interested to add it to the wishlist';
  end if;

  new.updated_at := now();
  return new;
end $$;

-- Withdrawn consent unwinds anything that assumed it; "Let's discuss" moves early ideas to discussion.
create or replace function public.fantasy_after_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare fid uuid := coalesce(new.fantasy_id, old.fantasy_id);
begin
  update fantasies set status = 'discuss'
   where id = fid and visibility = 'shared' and status in ('agreed','planned','in_progress') and not fantasy_has_consent(fid);
  update fantasies set on_wishlist = false where id = fid and on_wishlist and not fantasy_mutual_interest(fid);
  if tg_op <> 'DELETE' and new.reaction = 'discuss' then
    update fantasies set status = 'discuss' where id = fid and visibility = 'shared' and status in ('idea','saved');
  end if;
  return null;
end $$;

drop policy if exists fantasies_select on public.fantasies;
create policy fantasies_select on public.fantasies for select
  using (is_member(workspace_id) and (created_by = auth.uid() or visibility = 'shared'));
drop policy if exists fantasies_update on public.fantasies;
create policy fantasies_update on public.fantasies for update
  using (is_member(workspace_id) and (created_by = auth.uid() or visibility = 'shared'))
  with check (is_member(workspace_id));

-- Photos of a fantasy: the author alone for private entries; for shared ones only when BOTH agreed to keep photos.
create or replace function public.fantasy_photos_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when f.visibility = 'private' then f.created_by = auth.uid()
    else (select count(distinct r.user_id) from fantasy_responses r
            join workspace_members m on m.workspace_id = f.workspace_id and m.user_id = r.user_id
           where r.fantasy_id = p_id and r.allow_photos) = 2
  end
  from fantasies f where f.id = p_id;
$$;

create table if not exists public.fantasy_photos (
  id           uuid primary key default gen_random_uuid(),
  fantasy_id   uuid not null references public.fantasies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by  uuid references public.users(id) on delete set null,
  storage_path text not null,
  caption      text check (char_length(caption) <= 300),
  created_at   timestamptz not null default now()
);
alter table public.fantasy_photos enable row level security;
drop policy if exists fphotos_select on public.fantasy_photos;
create policy fphotos_select on public.fantasy_photos for select using (is_member(workspace_id) and can_see_fantasy(fantasy_id));
drop policy if exists fphotos_insert on public.fantasy_photos;
create policy fphotos_insert on public.fantasy_photos for insert
  with check (is_member(workspace_id) and uploaded_by = auth.uid() and can_see_fantasy(fantasy_id) and fantasy_photos_allowed(fantasy_id));
drop policy if exists fphotos_delete on public.fantasy_photos;
create policy fphotos_delete on public.fantasy_photos for delete
  using (is_member(workspace_id) and can_see_fantasy(fantasy_id)
         and (uploaded_by = auth.uid() or exists (select 1 from fantasies f where f.id = fantasy_id and f.created_by = auth.uid())));

-- Storage: anyone allowed to add photos may upload; delete by uploader or author.
drop policy if exists "fantasy files write" on storage.objects;
create policy "fantasy files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'fantasy' and public.can_see_fantasy(public.fantasy_from_path(name)) and (
    exists (select 1 from public.fantasies f where f.id = public.fantasy_from_path(name) and f.created_by = auth.uid())
    or public.fantasy_photos_allowed(public.fantasy_from_path(name))));
drop policy if exists "fantasy files delete" on storage.objects;
create policy "fantasy files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fantasy' and public.can_see_fantasy(public.fantasy_from_path(name)) and (
    owner = auth.uid()
    or exists (select 1 from public.fantasies f where f.id = public.fantasy_from_path(name) and f.created_by = auth.uid())));

do $$
declare t text;
begin
  foreach t in array array['categories','fantasy_photos'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
