-- 0004 — "Created by" for bucket-list items (additive, safe to re-run, keeps all data).
--
--   creator_id  who originally created or suggested the dream — chosen explicitly in the form
--               (Ayvon or Aksa). It is NOT assumed from whoever is using the app, and existing
--               items are left empty (NULL) so nobody is assigned incorrectly; pick it when editing.
--   created_by  (unchanged) the account that entered the row.
--   updated_by  the account that last edited the row, set by the database on every update.

alter table public.items add column if not exists creator_id uuid references public.users(id) on delete set null;
alter table public.items add column if not exists updated_by uuid references public.users(id) on delete set null;
create index if not exists items_creator_idx on public.items (creator_id);

-- The creator must be one of the two partners in this list.
create or replace function public.items_people_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.creator_id is not null and not exists (
    select 1 from public.workspace_members m where m.workspace_id = new.workspace_id and m.user_id = new.creator_id
  ) then
    raise exception 'Created by must be one of the two of you';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.created_by := old.created_by;          -- who entered the row never changes
  else
    new.updated_by := null;
  end if;
  return new;
end $$;

drop trigger if exists items_people_guard on public.items;
create trigger items_people_guard before insert or update on public.items
  for each row execute function public.items_people_guard();
