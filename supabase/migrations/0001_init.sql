-- ═══════════════════════════════════════════════════════════════════
-- MODVerse — core schema
-- Postgres 15+ / Supabase. Idempotent where practical.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ─────────────────────────── enums ───────────────────────────

do $$ begin
  create type publish_status as enum ('draft','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type game_category as enum
    ('action','adventure','simulation','sports','racing','puzzle','arcade','strategy','rpg','casual','shooter','horror');
exception when duplicate_object then null; end $$;

do $$ begin
  create type game_collection as enum
    ('trending','latest','popular','mod-menu','premium','offline','editors-choice','recently-updated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type agent_source as enum
    ('apkmirror','apkpure','happymod','moddroid','an1','apkaward','revdl','liteapks');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_type as enum
    ('discovery','update-check','ingest-url','media-pipeline','remote-upload','seo-generate','publish','recommendation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('queued','running','completed','failed','cancelled','retrying');
exception when duplicate_object then null; end $$;

do $$ begin
  create type log_level as enum ('debug','info','warn','error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comment_status as enum ('pending','approved','spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recommendation_kind as enum ('new-game','trending','upcoming','needs-update');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recommendation_status as enum ('new','accepted','dismissed','queued');
exception when duplicate_object then null; end $$;

-- ─────────────────────── shared helpers ───────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- `array_to_string` is only STABLE, so it cannot be referenced from a
-- generated column. This IMMUTABLE wrapper makes the search vector legal.
create or replace function immutable_array_to_string(arr text[])
returns text language sql immutable parallel safe as $$
  select coalesce(array_to_string(arr, ' '), '');
$$;

-- ═══════════════════════════ games ═══════════════════════════

create table if not exists games (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  original_name      text,
  version            text not null default '1.0',
  mod_version        text,
  package_name       text not null,
  developer          text not null,
  publisher          text,
  category           game_category not null default 'action',
  genres             text[] not null default '{}',
  tags               text[] not null default '{}',
  collections        game_collection[] not null default '{}',
  android_version    text not null default '7.0+',
  requirements       text,
  size_bytes         bigint not null default 0 check (size_bytes >= 0),
  rating             numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  rating_count       integer not null default 0 check (rating_count >= 0),
  downloads          bigint not null default 0 check (downloads >= 0),
  views              bigint not null default 0 check (views >= 0),
  short_description  text not null default '',
  description        text not null default '',
  mod_features       text[] not null default '{}',
  whats_new          text,
  installation_guide text[] not null default '{}',
  release_date       timestamptz,
  updated_date       timestamptz,
  status             publish_status not null default 'draft',
  published_at       timestamptz,
  scheduled_for      timestamptz,
  featured           boolean not null default false,
  icon               jsonb,
  banner             jsonb,
  screenshots        jsonb not null default '[]'::jsonb,
  download_links     jsonb not null default '[]'::jsonb,
  virus_scan         jsonb,
  faqs               jsonb not null default '[]'::jsonb,
  seo                jsonb not null default '{}'::jsonb,
  play_store_url     text,
  original_apk_url   text,
  mod_apk_url        text,
  mega_url           text,
  source_site        agent_source,
  source_url         text,
  content_hash       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Duplicate protection: one live listing per Android package.
  constraint games_package_unique unique (package_name)
);

-- Weighted full-text search vector (name > tags/dev > description).
alter table games
  add column if not exists search_vector tsvector
  generated always as (
      setweight(to_tsvector('english'::regconfig, coalesce(name,'')), 'A')
   || setweight(to_tsvector('english'::regconfig, coalesce(original_name,'')), 'A')
   || setweight(to_tsvector('english'::regconfig, coalesce(developer,'')), 'B')
   || setweight(to_tsvector('english'::regconfig, immutable_array_to_string(tags)), 'B')
   || setweight(to_tsvector('english'::regconfig, immutable_array_to_string(genres)), 'B')
   || setweight(to_tsvector('english'::regconfig, coalesce(short_description,'')), 'C')
   || setweight(to_tsvector('english'::regconfig, coalesce(description,'')), 'D')
  ) stored;

create index if not exists games_search_idx        on games using gin (search_vector);
create index if not exists games_name_trgm_idx     on games using gin (name gin_trgm_ops);
create index if not exists games_status_pub_idx    on games (status, published_at desc nulls last);
create index if not exists games_category_idx      on games (category) where status = 'published';
create index if not exists games_collections_idx   on games using gin (collections);
create index if not exists games_tags_idx          on games using gin (tags);
create index if not exists games_genres_idx        on games using gin (genres);
create index if not exists games_developer_idx     on games (lower(developer));
create index if not exists games_downloads_idx     on games (downloads desc) where status = 'published';
create index if not exists games_views_idx         on games (views desc) where status = 'published';
create index if not exists games_rating_idx        on games (rating desc) where status = 'published';
create index if not exists games_updated_date_idx  on games (updated_date desc nulls last);
create index if not exists games_scheduled_idx     on games (scheduled_for) where status = 'scheduled';
create index if not exists games_source_url_idx    on games (source_url);
create index if not exists games_content_hash_idx  on games (content_hash);
create index if not exists games_android_ver_idx   on games (android_version);

drop trigger if exists games_updated_at on games;
create trigger games_updated_at before update on games
  for each row execute function set_updated_at();

-- ═══════════════════════ game version history ═══════════════════════

create table if not exists game_versions (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  version      text not null,
  mod_version  text,
  size_bytes   bigint,
  whats_new    text,
  mega_url     text,
  mod_apk_url  text,
  content_hash text,
  changes      text[] not null default '{}',
  released_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists game_versions_game_idx on game_versions (game_id, created_at desc);
create unique index if not exists game_versions_unique on game_versions (game_id, version, coalesce(mod_version,''));

-- ═══════════════════════════ wallpapers ═══════════════════════════

create table if not exists wallpapers (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  category   text not null default 'action',
  tags       text[] not null default '{}',
  image      jsonb not null,
  thumbnail  jsonb,
  resolution text not null default '1920x1080',
  downloads  bigint not null default 0,
  status     publish_status not null default 'published',
  seo        jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wallpapers_category_idx on wallpapers (category, created_at desc);
create index if not exists wallpapers_status_idx   on wallpapers (status);
create index if not exists wallpapers_tags_idx     on wallpapers using gin (tags);

drop trigger if exists wallpapers_updated_at on wallpapers;
create trigger wallpapers_updated_at before update on wallpapers
  for each row execute function set_updated_at();

-- ═══════════════════════════ reviews ═══════════════════════════

create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  game_id         uuid references games(id) on delete set null,
  game_slug       text,
  summary         text not null default '',
  body            text not null default '',
  score           numeric(3,1) not null default 0 check (score >= 0 and score <= 10),
  score_breakdown jsonb,
  pros            text[] not null default '{}',
  cons            text[] not null default '{}',
  verdict         text not null default '',
  cover           jsonb,
  author          text not null default 'MODVerse Editorial',
  status          publish_status not null default 'published',
  published_at    timestamptz default now(),
  seo             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists reviews_status_idx on reviews (status, published_at desc);
create index if not exists reviews_game_idx   on reviews (game_id);
create index if not exists reviews_score_idx  on reviews (score desc);

drop trigger if exists reviews_updated_at on reviews;
create trigger reviews_updated_at before update on reviews
  for each row execute function set_updated_at();

-- ═══════════════════════════ blog ═══════════════════════════

create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  category        text not null default 'news',
  excerpt         text not null default '',
  content         text not null default '',
  cover           jsonb,
  tags            text[] not null default '{}',
  author          text not null default 'MODVerse Editorial',
  reading_minutes integer not null default 4,
  status          publish_status not null default 'draft',
  published_at    timestamptz,
  scheduled_for   timestamptz,
  views           bigint not null default 0,
  seo             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists posts_status_idx   on posts (status, published_at desc nulls last);
create index if not exists posts_category_idx on posts (category);
create index if not exists posts_tags_idx     on posts using gin (tags);

alter table posts
  add column if not exists search_vector tsvector
  generated always as (
      setweight(to_tsvector('english'::regconfig, coalesce(title,'')), 'A')
   || setweight(to_tsvector('english'::regconfig, coalesce(excerpt,'')), 'B')
   || setweight(to_tsvector('english'::regconfig, coalesce(content,'')), 'C')
  ) stored;
create index if not exists posts_search_idx on posts using gin (search_vector);

drop trigger if exists posts_updated_at on posts;
create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- ═══════════════════════════ comments ═══════════════════════════

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid references games(id) on delete cascade,
  game_slug  text not null,
  author     text not null,
  email      text,
  body       text not null,
  rating     smallint check (rating between 1 and 5),
  status     comment_status not null default 'pending',
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index if not exists comments_game_idx   on comments (game_id, created_at desc);
create index if not exists comments_status_idx on comments (status, created_at desc);

-- ═══════════════════════ agent infrastructure ═══════════════════════

create table if not exists agent_jobs (
  id            uuid primary key default gen_random_uuid(),
  type          job_type not null,
  status        job_status not null default 'queued',
  source        agent_source,
  target_url    text,
  payload       jsonb not null default '{}'::jsonb,
  result        jsonb,
  error         text,
  attempts      integer not null default 0,
  max_attempts  integer not null default 3,
  progress      numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  priority      smallint not null default 5,
  scheduled_for timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists agent_jobs_status_idx  on agent_jobs (status, priority desc, created_at);
create index if not exists agent_jobs_type_idx    on agent_jobs (type, created_at desc);
create index if not exists agent_jobs_pending_idx on agent_jobs (scheduled_for) where status in ('queued','retrying');
-- Prevents two identical in-flight jobs for the same URL.
create unique index if not exists agent_jobs_inflight_unique
  on agent_jobs (type, target_url) where status in ('queued','running','retrying') and target_url is not null;

drop trigger if exists agent_jobs_updated_at on agent_jobs;
create trigger agent_jobs_updated_at before update on agent_jobs
  for each row execute function set_updated_at();

create table if not exists agent_logs (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid references agent_jobs(id) on delete cascade,
  level      log_level not null default 'info',
  scope      text not null default 'agent',
  message    text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_logs_created_idx on agent_logs (created_at desc);
create index if not exists agent_logs_level_idx   on agent_logs (level, created_at desc);
create index if not exists agent_logs_job_idx     on agent_logs (job_id, created_at desc);

create table if not exists agent_sources (
  id              agent_source primary key,
  label           text not null,
  origin          text not null,
  enabled         boolean not null default true,
  kind            text not null default 'mod',
  last_crawled_at timestamptz,
  last_success_at timestamptz,
  health          text not null default 'ok',
  error_streak    integer not null default 0,
  items_found     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists agent_sources_updated_at on agent_sources;
create trigger agent_sources_updated_at before update on agent_sources
  for each row execute function set_updated_at();

create table if not exists recommendations (
  id                 uuid primary key default gen_random_uuid(),
  kind               recommendation_kind not null,
  title              text not null,
  source             agent_source not null,
  source_url         text not null,
  score              numeric(5,2) not null default 0,
  reason             text not null default '',
  package_name       text,
  existing_game_slug text,
  meta               jsonb not null default '{}'::jsonb,
  status             recommendation_status not null default 'new',
  created_at         timestamptz not null default now()
);
create unique index if not exists recommendations_url_unique on recommendations (source_url);
create index if not exists recommendations_status_idx on recommendations (status, score desc);

-- Remote-upload (MultCloud → Mega) transfer ledger.
create table if not exists transfers (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references agent_jobs(id) on delete set null,
  game_id       uuid references games(id) on delete cascade,
  provider      text not null default 'multcloud',
  source_url    text not null,
  target_path   text,
  task_id       text,
  status        text not null default 'pending',
  progress      numeric(5,2) not null default 0,
  bytes_total   bigint,
  mega_url      text,
  error         text,
  started_at    timestamptz default now(),
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists transfers_status_idx on transfers (status, created_at desc);
create index if not exists transfers_game_idx   on transfers (game_id);

-- ═══════════════════════ analytics & settings ═══════════════════════

create table if not exists analytics_events (
  id         bigserial primary key,
  kind       text not null,           -- view | download | search | click
  entity     text not null default 'game',
  entity_id  uuid,
  slug       text,
  referrer   text,
  country    text,
  device     text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_kind_idx    on analytics_events (kind, created_at desc);
create index if not exists analytics_slug_idx    on analytics_events (slug, created_at desc);
create index if not exists analytics_created_idx on analytics_events (created_at desc);

create table if not exists settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  encrypted  boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at before update on settings
  for each row execute function set_updated_at();

create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  key_hash    text not null unique,
  prefix      text not null,
  scopes      text[] not null default '{}',
  last_used_at timestamptz,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  role       text not null default 'admin',
  created_at timestamptz not null default now()
);

-- ═══════════════════════════ functions ═══════════════════════════

-- Atomic counter bump (avoids read-modify-write races under load).
create or replace function increment_metric(p_slug text, p_field text, p_amount bigint default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_field = 'views' then
    update games set views = views + p_amount where slug = p_slug;
  elsif p_field = 'downloads' then
    update games set downloads = downloads + p_amount where slug = p_slug;
  else
    raise exception 'Unsupported metric field: %', p_field;
  end if;
end $$;

-- Publishes any game/post whose schedule has arrived. Called by cron.
create or replace function publish_due_content()
returns table (kind text, id uuid, slug text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with g as (
    update games set status = 'published', published_at = coalesce(published_at, now())
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    returning 'game'::text as kind, games.id, games.slug
  ), p as (
    update posts set status = 'published', published_at = coalesce(published_at, now())
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    returning 'post'::text as kind, posts.id, posts.slug
  )
  select * from g union all select * from p;
end $$;

-- Trending score: downloads & views decayed over time + rating boost.
create or replace function trending_score(
  p_downloads bigint, p_views bigint, p_rating numeric, p_published timestamptz
) returns numeric language sql immutable as $$
  select round(
    ((coalesce(p_downloads,0) * 1.5 + coalesce(p_views,0) * 0.4) /
      power(greatest(extract(epoch from (now() - coalesce(p_published, now()))) / 86400.0, 0.5) + 2, 1.25)
    + coalesce(p_rating,0) * 12
  )::numeric, 3);
$$;

-- Related games: same category / shared tags, ranked by overlap.
create or replace function related_games(p_slug text, p_limit int default 8)
returns setof games language sql stable as $$
  with base as (select * from games where slug = p_slug limit 1)
  select g.* from games g, base b
  where g.id <> b.id
    and g.status = 'published'
    and (g.category = b.category or g.tags && b.tags or lower(g.developer) = lower(b.developer))
  order by
    (case when g.category = b.category then 2 else 0 end)
    + cardinality(array(select unnest(g.tags) intersect select unnest(b.tags)))
    + (case when lower(g.developer) = lower(b.developer) then 1 else 0 end) desc,
    g.downloads desc
  limit p_limit;
$$;

-- ═══════════════════════════ views ═══════════════════════════

create or replace view published_games as
  select *, trending_score(downloads, views, rating, published_at) as trend
  from games where status = 'published';

create or replace view storage_usage as
  select
    count(*)::bigint as object_count,
    coalesce(sum(coalesce((icon->>'bytes')::bigint,0)
      + coalesce((banner->>'bytes')::bigint,0)
      + coalesce((select sum(coalesce((s->>'bytes')::bigint,0)) from jsonb_array_elements(screenshots) s),0)
    ),0)::bigint as used_bytes
  from games;

-- ═══════════════════════════ seed sources ═══════════════════════════

insert into agent_sources (id,label,origin,kind) values
  ('apkmirror','APKMirror','https://www.apkmirror.com','original'),
  ('apkpure','APKPure','https://apkpure.com','original'),
  ('happymod','HappyMod','https://happymod.com','mod'),
  ('moddroid','ModDroid','https://moddroid.co','mod'),
  ('an1','AN1','https://an1.com','mod'),
  ('apkaward','APKAward','https://apkaward.com','mod'),
  ('revdl','RevDL','https://www.revdl.com','mod'),
  ('liteapks','LiteAPKs','https://liteapks.com','mod')
on conflict (id) do nothing;

insert into settings (key, value) values
  ('site', '{"siteName":"MODVerse","tagline":"Premium MOD APK games, verified and updated daily.","defaultTheme":"system","downloadCountdownSeconds":10}'::jsonb)
on conflict (key) do nothing;
