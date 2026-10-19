-- =============================================================================
-- Secret Fantasy — private space for the two partners
-- Additive migration: does not touch any existing table or row.
--
-- Privacy model (enforced here, not in the UI):
--   * A fantasy is visible ONLY to its author while status = 'private'.
--   * Once shared, both partners can see it; the author can make it private again.
--   * Each partner's personal notes are visible only to that partner.
--   * "Agreed"/"Completed" and the shared wishlist require explicit consent from
--     BOTH partners. Withdrawing consent automatically moves it back to "discussing"
--     and off the wishlist — no assumption of consent.
--   * Images live in a separate private bucket readable only by people who can see
--     the fantasy.
--   * Nothing here is included in exports, backups, search or notifications.
-- =============================================================================

create table if not exists public.fantasies (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  created_by     uuid not null references public.users(id) on delete cascade,
  title          text not null check (char_length(trim(title)) between 1 and 140),
  description    text check (char_length(description) <= 5000),
  category       text not null default 'Romance'
                 check (category in ('Romance','Intimacy','Sensual','Adventure','Getaway','Roleplay','Other')),
  interest_level smallint check (interest_level between 1 and 5),
  status         text not null default 'private'
                 check (status in ('private','shared','discussing','agreed','completed')),
  on_wishlist    boolean not null default false,
  planned_date   date,
  completed_at   date,
  image_path     text,
  shared_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists fantasies_ws_idx on public.fantasies (workspace_id, status);

-- Each partner's reaction, explicit consent and boundaries for a fantasy.
create table if not exists public.fantasy_responses (
  fantasy_id   uuid not null references public.fantasies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  reaction     text check (reaction in ('love','curious','discuss','not_comfortable')),
  comfortable  boolean not null default false,          -- explicit "I'm comfortable with this"
  boundaries   text check (char_length(boundaries) <= 2000),
  updated_at   timestamptz not null default now(),
  primary key (fantasy_id, user_id)
);

-- Personal notes — visible only to the person who wrote them.
create table if not exists public.fantasy_notes (
  fantasy_id   uuid not null references public.fantasies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  notes        text check (char_length(notes) <= 5000),
  updated_at   timestamptz not null default now(),
  primary key (fantasy_id, user_id)
);

-- Discussion thread on a shared fantasy.
create table if not exists public.fantasy_comments (
  id           uuid primary key default gen_random_uuid(),
  fantasy_id   uuid not null references public.fantasies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  body         text not null check (char_length(trim(body)) between 1 and 2000),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_see_fantasy(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fantasies f
    where f.id = p_id and is_member(f.workspace_id)
      and (f.created_by = auth.uid() or f.status <> 'private'));
$$;

-- Both partners exist, both said "comfortable", nobody said "not comfortable".
create or replace function public.fantasy_has_consent(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from workspace_members m join fantasies f on f.workspace_id = m.workspace_id where f.id = p_id) = 2
    and (select count(distinct r.user_id) from fantasy_responses r
           join fantasies f on f.id = r.fantasy_id
           join workspace_members m on m.workspace_id = f.workspace_id and m.user_id = r.user_id
          where r.fantasy_id = p_id and r.comfortable) = 2
    and not exists (select 1 from fantasy_responses r where r.fantasy_id = p_id and r.reaction = 'not_comfortable');
$$;

-- The partner (not the author) has shown interest and nobody objected.
create or replace function public.fantasy_mutual_interest(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from fantasy_responses r join fantasies f on f.id = r.fantasy_id
      where r.fantasy_id = p_id and r.user_id <> f.created_by and r.reaction in ('love','curious'))
    and not exists (select 1 from fantasy_responses r where r.fantasy_id = p_id and r.reaction = 'not_comfortable');
$$;

-- ---------------------------------------------------------------------------
-- rules on fantasies
-- ---------------------------------------------------------------------------
create or replace function public.fantasy_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'private' then raise exception 'New fantasies start private'; end if;
    new.on_wishlist := false;
    return new;
  end if;

  -- The partner may move it through the conversation, but never edit its content or hide it.
  if auth.uid() is distinct from old.created_by then
    if new.title is distinct from old.title or new.description is distinct from old.description
       or new.category is distinct from old.category or new.interest_level is distinct from old.interest_level
       or new.image_path is distinct from old.image_path or new.created_by is distinct from old.created_by
       or new.workspace_id is distinct from old.workspace_id then
      raise exception 'Only the author can edit this fantasy';
    end if;
    if new.status = 'private' then raise exception 'Only the author can make it private again'; end if;
  end if;

  if old.status = 'private' and new.status not in ('private','shared') then
    raise exception 'Share it first';
  end if;
  if old.status = 'private' and new.status = 'shared' then new.shared_at := now(); end if;

  if new.status = 'private' then
    new.on_wishlist := false;
    new.shared_at := null;
  end if;

  if new.status in ('agreed','completed') and old.status is distinct from new.status
     and not fantasy_has_consent(new.id) then
    raise exception 'Both of you need to say you are comfortable first';
  end if;

  if new.on_wishlist and not old.on_wishlist and not fantasy_mutual_interest(new.id) then
    raise exception 'Both of you need to be interested to add it to the wishlist';
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists fantasy_guard_ins on public.fantasies;
create trigger fantasy_guard_ins before insert on public.fantasies for each row execute function public.fantasy_guard();
drop trigger if exists fantasy_guard_upd on public.fantasies;
create trigger fantasy_guard_upd before update on public.fantasies for each row execute function public.fantasy_guard();

-- When a response changes: withdraw "agreed"/wishlist if consent or interest is gone;
-- "Let's discuss" moves a shared fantasy to "discussing".
create or replace function public.fantasy_after_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare fid uuid := coalesce(new.fantasy_id, old.fantasy_id);
begin
  update fantasies set status = 'discussing' where id = fid and status = 'agreed' and not fantasy_has_consent(fid);
  update fantasies set on_wishlist = false where id = fid and on_wishlist and not fantasy_mutual_interest(fid);
  if tg_op <> 'DELETE' and new.reaction = 'discuss' then
    update fantasies set status = 'discussing' where id = fid and status = 'shared';
  end if;
  return null;
end $$;

drop trigger if exists fantasy_response_changed on public.fantasy_responses;
create trigger fantasy_response_changed after insert or update or delete on public.fantasy_responses
  for each row execute function public.fantasy_after_response();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.fantasies         enable row level security;
alter table public.fantasy_responses enable row level security;
alter table public.fantasy_notes     enable row level security;
alter table public.fantasy_comments  enable row level security;

drop policy if exists fantasies_select on public.fantasies;
create policy fantasies_select on public.fantasies for select
  using (is_member(workspace_id) and (created_by = auth.uid() or status <> 'private'));
drop policy if exists fantasies_insert on public.fantasies;
create policy fantasies_insert on public.fantasies for insert
  with check (is_member(workspace_id) and created_by = auth.uid());
drop policy if exists fantasies_update on public.fantasies;
create policy fantasies_update on public.fantasies for update
  using (is_member(workspace_id) and (created_by = auth.uid() or status <> 'private'))
  with check (is_member(workspace_id));
drop policy if exists fantasies_delete on public.fantasies;
create policy fantasies_delete on public.fantasies for delete
  using (is_member(workspace_id) and created_by = auth.uid());

drop policy if exists fresp_select on public.fantasy_responses;
create policy fresp_select on public.fantasy_responses for select
  using (is_member(workspace_id) and can_see_fantasy(fantasy_id));
drop policy if exists fresp_insert on public.fantasy_responses;
create policy fresp_insert on public.fantasy_responses for insert
  with check (is_member(workspace_id) and user_id = auth.uid() and can_see_fantasy(fantasy_id));
drop policy if exists fresp_update on public.fantasy_responses;
create policy fresp_update on public.fantasy_responses for update
  using (user_id = auth.uid() and can_see_fantasy(fantasy_id)) with check (user_id = auth.uid());
drop policy if exists fresp_delete on public.fantasy_responses;
create policy fresp_delete on public.fantasy_responses for delete using (user_id = auth.uid());

drop policy if exists fnotes_all on public.fantasy_notes;
create policy fnotes_all on public.fantasy_notes for all
  using (user_id = auth.uid() and is_member(workspace_id) and can_see_fantasy(fantasy_id))
  with check (user_id = auth.uid() and is_member(workspace_id) and can_see_fantasy(fantasy_id));

drop policy if exists fcomments_select on public.fantasy_comments;
create policy fcomments_select on public.fantasy_comments for select
  using (is_member(workspace_id) and can_see_fantasy(fantasy_id));
drop policy if exists fcomments_insert on public.fantasy_comments;
create policy fcomments_insert on public.fantasy_comments for insert
  with check (is_member(workspace_id) and user_id = auth.uid() and can_see_fantasy(fantasy_id));
drop policy if exists fcomments_delete on public.fantasy_comments;
create policy fcomments_delete on public.fantasy_comments for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private storage: fantasy/<workspace_id>/<fantasy_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('fantasy', 'fantasy', false) on conflict (id) do nothing;

create or replace function public.fantasy_from_path(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return (string_to_array(p_name, '/'))[2]::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "fantasy files read" on storage.objects;
create policy "fantasy files read" on storage.objects for select to authenticated
  using (bucket_id = 'fantasy' and public.can_see_fantasy(public.fantasy_from_path(name)));
drop policy if exists "fantasy files write" on storage.objects;
create policy "fantasy files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'fantasy' and exists (
    select 1 from public.fantasies f where f.id = public.fantasy_from_path(name) and f.created_by = auth.uid()));
drop policy if exists "fantasy files delete" on storage.objects;
create policy "fantasy files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fantasy' and exists (
    select 1 from public.fantasies f where f.id = public.fantasy_from_path(name) and f.created_by = auth.uid()));

-- Realtime (RLS still applies to every change event).
do $$
declare t text;
begin
  foreach t in array array['fantasies','fantasy_responses','fantasy_comments'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
