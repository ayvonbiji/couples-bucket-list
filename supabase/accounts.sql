-- ===========================================================================
-- Our Bucket List — create the two accounts and print your PERSONAL LINKS.
-- Run in Supabase → SQL Editor (after the migrations; setup_all.sql already includes them).
--
--  * Creates Ayvon and Aksa in Supabase Auth, or updates them if they already exist (no duplicates).
--  * Each link carries a fresh random 256-bit secret; Supabase stores only its bcrypt hash.
--  * Links both accounts to ONE shared list (creating it if needed). Existing data is untouched.
--  * Running this again makes NEW links and the old ones stop working (use it if a phone is lost).
--
-- Change the address on the next line to your site (e.g. https://our-bucket-list.vercel.app).
-- If you forget, just put your site address in front of the "/#key=…" part of each link.
-- ===========================================================================
create temp table if not exists setup_config (site_url text);
truncate setup_config;
insert into setup_config values ('https://YOUR-SITE.vercel.app');

create temp table if not exists setup_links (person text, personal_link text);
truncate setup_links;

do $$
declare
  site    text := rtrim((select site_url from setup_config), '/');
  people  jsonb := '[{"u":"ayvon","n":"Ayvon"},{"u":"aksa","n":"Aksa"}]';
  p       jsonb;
  v_email text;
  v_id    uuid;
  v_secret text;
  ids     uuid[] := '{}';
  v_ws    uuid;
  other_ws uuid;
begin
  set local search_path = public, extensions, auth;
  for p in select * from jsonb_array_elements(people) loop
    v_email  := (p->>'u') || '@users.ourbucketlist.app';
    v_secret := rtrim(translate(replace(encode(gen_random_bytes(32), 'base64'), E'\n', ''), '+/', '-_'), '=');

    select u.id into v_id from auth.users u where lower(u.email) = v_email;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
              crypt(v_secret, gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}', jsonb_build_object('username', p->>'u', 'display_name', p->>'n'),
              now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text,
              jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
              'email', now(), now(), now());
    else
      update auth.users set encrypted_password = crypt(v_secret, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
       where id = v_id;
    end if;

    insert into public.users (id, email, username, display_name) values (v_id, v_email, p->>'u', p->>'n')
      on conflict (id) do update set username = excluded.username, display_name = excluded.display_name;

    ids := ids || v_id;
    insert into setup_links values (p->>'n', site || '/#key=' || (p->>'u') || '.' || v_secret);
  end loop;

  -- One shared list for both.
  select workspace_id into v_ws from public.workspace_members where user_id = ids[1];
  select workspace_id into other_ws from public.workspace_members where user_id = ids[2];
  if v_ws is not null and other_ws is not null and v_ws <> other_ws then
    raise exception 'Ayvon and Aksa already belong to two different lists — remove one membership first';
  end if;
  v_ws := coalesce(v_ws, other_ws);
  if v_ws is null then
    insert into public.workspaces (name, created_by) values ('Our Bucket List', ids[1]) returning id into v_ws;
  end if;
  insert into public.workspace_members (workspace_id, user_id)
    select v_ws, x from unnest(ids) x
    where not exists (select 1 from public.workspace_members m where m.user_id = x);
end $$;

-- Your two links (open each once on its owner's phone; treat them like passwords):
select person, personal_link from setup_links;
