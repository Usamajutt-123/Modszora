-- ═══════════════════════════════════════════════════════════════════
-- MODSzora — Row Level Security
--
-- Model: NO public user registration. The anon key may only READ
-- published content. Every write goes through the service-role key
-- (server-side API routes) or an authenticated admin in admin_users.
-- ═══════════════════════════════════════════════════════════════════

alter table games             enable row level security;
alter table game_versions     enable row level security;
alter table wallpapers        enable row level security;
alter table reviews           enable row level security;
alter table posts             enable row level security;
alter table comments          enable row level security;
alter table agent_jobs        enable row level security;
alter table agent_logs        enable row level security;
alter table agent_sources     enable row level security;
alter table recommendations   enable row level security;
alter table transfers         enable row level security;
alter table analytics_events  enable row level security;
alter table settings          enable row level security;
alter table api_keys          enable row level security;
alter table admin_users       enable row level security;

-- Is the current JWT an admin?
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users a where a.id = auth.uid());
$$;

-- ─────────────────── public read (published only) ───────────────────

drop policy if exists games_public_read on games;
create policy games_public_read on games
  for select using (status = 'published' or is_admin());

drop policy if exists game_versions_public_read on game_versions;
create policy game_versions_public_read on game_versions
  for select using (
    is_admin() or exists (select 1 from games g where g.id = game_id and g.status = 'published')
  );

drop policy if exists wallpapers_public_read on wallpapers;
create policy wallpapers_public_read on wallpapers
  for select using (status = 'published' or is_admin());

drop policy if exists reviews_public_read on reviews;
create policy reviews_public_read on reviews
  for select using (status = 'published' or is_admin());

drop policy if exists posts_public_read on posts;
create policy posts_public_read on posts
  for select using (status = 'published' or is_admin());

-- Only approved comments are visible publicly.
drop policy if exists comments_public_read on comments;
create policy comments_public_read on comments
  for select using (status = 'approved' or is_admin());

-- Visitors may submit a comment, but never self-approve.
drop policy if exists comments_public_insert on comments;
create policy comments_public_insert on comments
  for insert with check (status = 'pending');

-- ─────────────────────── admin full access ───────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'games','game_versions','wallpapers','reviews','posts','comments',
    'agent_jobs','agent_logs','agent_sources','recommendations','transfers',
    'analytics_events','settings','api_keys','admin_users'
  ]
  loop
    execute format('drop policy if exists %I_admin_all on %I;', t, t);
    execute format(
      'create policy %I_admin_all on %I for all using (is_admin()) with check (is_admin());', t, t
    );
  end loop;
end $$;

-- Analytics: allow anonymous event inserts (view/download beacons).
drop policy if exists analytics_public_insert on analytics_events;
create policy analytics_public_insert on analytics_events
  for insert with check (kind in ('view','download','search','click'));

-- Agent operational tables are never public-readable; admin policies above cover them.
-- settings/api_keys hold encrypted secrets: admin-only, no public policy at all.

-- ═══════════════════════════ storage ═══════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'modverse', 'modverse', true, 26214400,
  array['image/webp','image/png','image/jpeg','image/avif','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "modverse public read" on storage.objects;
create policy "modverse public read" on storage.objects
  for select using (bucket_id = 'modverse');

drop policy if exists "modverse admin write" on storage.objects;
create policy "modverse admin write" on storage.objects
  for insert with check (bucket_id = 'modverse' and is_admin());

drop policy if exists "modverse admin update" on storage.objects;
create policy "modverse admin update" on storage.objects
  for update using (bucket_id = 'modverse' and is_admin());

drop policy if exists "modverse admin delete" on storage.objects;
create policy "modverse admin delete" on storage.objects
  for delete using (bucket_id = 'modverse' and is_admin());
