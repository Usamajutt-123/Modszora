-- ═══════════════════════════════════════════════════════════════════
-- MODSzora 0003 — Gaming CMS expansion
--
-- Adds the columns the admin CMS needs (featured/trending flags, media
-- dimensions, blog galleries, review prose sections), plus tables for
-- AI suggestions and the media library.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

/* ─────────────────────────── wallpapers ─────────────────────────── */

alter table wallpapers add column if not exists width         integer;
alter table wallpapers add column if not exists height        integer;
alter table wallpapers add column if not exists views         bigint  not null default 0;
alter table wallpapers add column if not exists featured      boolean not null default false;
alter table wallpapers add column if not exists trending      boolean not null default false;
alter table wallpapers add column if not exists game_slug     text;
alter table wallpapers add column if not exists source_url    text;
alter table wallpapers add column if not exists published_at  timestamptz default now();
alter table wallpapers add column if not exists scheduled_for timestamptz;

create index if not exists wallpapers_featured_idx  on wallpapers (featured) where status = 'published';
create index if not exists wallpapers_trending_idx  on wallpapers (trending) where status = 'published';
create index if not exists wallpapers_game_idx      on wallpapers (game_slug);
create index if not exists wallpapers_downloads_idx on wallpapers (downloads desc);
create index if not exists wallpapers_scheduled_idx on wallpapers (scheduled_for) where status = 'scheduled';

-- Full-text search over wallpaper titles and tags.
alter table wallpapers
  add column if not exists search_vector tsvector
  generated always as (
      setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A')
   || setweight(to_tsvector('english'::regconfig, immutable_array_to_string(tags)), 'B')
   || setweight(to_tsvector('english'::regconfig, coalesce(category, '')), 'C')
  ) stored;
create index if not exists wallpapers_search_idx on wallpapers using gin (search_vector);

/* ─────────────────────────── reviews ─────────────────────────── */

alter table reviews add column if not exists gameplay      text;
alter table reviews add column if not exists graphics      text;
alter table reviews add column if not exists performance   text;
alter table reviews add column if not exists featured      boolean not null default false;
alter table reviews add column if not exists scheduled_for timestamptz;
alter table reviews add column if not exists views         bigint not null default 0;

create index if not exists reviews_featured_idx  on reviews (featured) where status = 'published';
create index if not exists reviews_scheduled_idx on reviews (scheduled_for) where status = 'scheduled';

alter table reviews
  add column if not exists search_vector tsvector
  generated always as (
      setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A')
   || setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'B')
   || setweight(to_tsvector('english'::regconfig, coalesce(body, '')), 'C')
  ) stored;
create index if not exists reviews_search_idx on reviews using gin (search_vector);

/* ─────────────────────────── posts ─────────────────────────── */

alter table posts add column if not exists gallery           jsonb   not null default '[]'::jsonb;
alter table posts add column if not exists featured          boolean not null default false;
alter table posts add column if not exists is_news           boolean not null default false;
alter table posts add column if not exists related_game_slug text;

create index if not exists posts_featured_idx on posts (featured) where status = 'published';
create index if not exists posts_is_news_idx  on posts (is_news, published_at desc);

/* ═══════════════════════ AI suggestions ═══════════════════════ */

do $$ begin
  create type suggestion_kind as enum (
    'new-game','game-update','trending-blog','trending-wallpaper',
    'trending-keyword','low-competition-keyword','missing-screenshots',
    'broken-link','duplicate-game'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type suggestion_status as enum ('new','accepted','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists suggestions (
  id           uuid primary key default gen_random_uuid(),
  kind         suggestion_kind not null,
  title        text not null,
  detail       text not null default '',
  score        numeric(5,2) not null default 50,
  severity     text not null default 'info',
  action_href  text,
  action_label text,
  entity_slug  text,
  -- Stable identity so re-running analysis updates rather than duplicates.
  dedupe_key   text not null,
  meta         jsonb not null default '{}'::jsonb,
  status       suggestion_status not null default 'new',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists suggestions_dedupe_unique on suggestions (dedupe_key);
create index if not exists suggestions_status_idx on suggestions (status, score desc);
create index if not exists suggestions_kind_idx   on suggestions (kind, created_at desc);

drop trigger if exists suggestions_updated_at on suggestions;
create trigger suggestions_updated_at before update on suggestions
  for each row execute function set_updated_at();

/* ═══════════════════════ media library ═══════════════════════ */

-- Indexes every object uploaded to storage so the library can search and
-- filter without paging the storage API on every request.
create table if not exists media_assets (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  name        text not null,
  url         text not null,
  folder      text not null default 'uploads',
  bytes       bigint not null default 0,
  width       integer,
  height      integer,
  mime_type   text not null default 'image/webp',
  owner_slug  text,
  owner_kind  text,
  created_at  timestamptz not null default now()
);

create index if not exists media_folder_idx  on media_assets (folder, created_at desc);
create index if not exists media_owner_idx   on media_assets (owner_slug);
create index if not exists media_created_idx on media_assets (created_at desc);
create index if not exists media_name_trgm   on media_assets using gin (name gin_trgm_ops);

/* ═══════════════════════ functions ═══════════════════════ */

-- Extends 0001's publish_due_content() to cover wallpapers and reviews.
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
  ), w as (
    update wallpapers set status = 'published', published_at = coalesce(published_at, now())
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    returning 'wallpaper'::text as kind, wallpapers.id, wallpapers.slug
  ), r as (
    update reviews set status = 'published', published_at = coalesce(published_at, now())
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    returning 'review'::text as kind, reviews.id, reviews.slug
  )
  select * from g
  union all select * from p
  union all select * from w
  union all select * from r;
end $$;

-- Atomic counter bump for any content type.
create or replace function increment_content_metric(
  p_table text, p_slug text, p_field text, p_amount bigint default 1
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_table not in ('games','wallpapers','posts','reviews') then
    raise exception 'Unsupported table: %', p_table;
  end if;
  if p_field not in ('views','downloads') then
    raise exception 'Unsupported field: %', p_field;
  end if;
  -- reviews/posts have no downloads column; ignore silently.
  if p_field = 'downloads' and p_table in ('posts','reviews') then
    return;
  end if;
  execute format('update %I set %I = %I + $1 where slug = $2', p_table, p_field, p_field)
    using p_amount, p_slug;
end $$;

-- Content totals for the dashboard in a single round trip.
create or replace function cms_totals()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'games',            (select count(*) from games),
    'gamesPublished',   (select count(*) from games where status = 'published'),
    'gamesDraft',       (select count(*) from games where status = 'draft'),
    'gamesScheduled',   (select count(*) from games where status = 'scheduled'),
    'wallpapers',       (select count(*) from wallpapers),
    'wallpapersPublished', (select count(*) from wallpapers where status = 'published'),
    'reviews',          (select count(*) from reviews),
    'reviewsPublished', (select count(*) from reviews where status = 'published'),
    'posts',            (select count(*) from posts where is_news = false),
    'news',             (select count(*) from posts where is_news = true),
    'postsPublished',   (select count(*) from posts where status = 'published'),
    'comments',         (select count(*) from comments),
    'commentsPending',  (select count(*) from comments where status = 'pending'),
    'mediaAssets',      (select count(*) from media_assets),
    'mediaBytes',       (select coalesce(sum(bytes),0) from media_assets),
    'suggestionsNew',   (select count(*) from suggestions where status = 'new'),
    'totalDownloads',   (select coalesce(sum(downloads),0) from games),
    'totalViews',       (select coalesce(sum(views),0) from games)
  );
$$;

/* ═══════════════════════ RLS ═══════════════════════ */

alter table suggestions   enable row level security;
alter table media_assets  enable row level security;

-- Admin-only: neither table is ever exposed to anonymous visitors.
drop policy if exists suggestions_admin_all on suggestions;
create policy suggestions_admin_all on suggestions
  for all using (is_admin()) with check (is_admin());

drop policy if exists media_admin_all on media_assets;
create policy media_admin_all on media_assets
  for all using (is_admin()) with check (is_admin());

/* ═══════════════════════ new agent job types ═══════════════════════ */

-- The agent now runs content jobs in addition to game ingestion.
do $$ begin alter type job_type add value if not exists 'blog-generate';      exception when others then null; end $$;
do $$ begin alter type job_type add value if not exists 'wallpaper-generate'; exception when others then null; end $$;
do $$ begin alter type job_type add value if not exists 'review-generate';    exception when others then null; end $$;
do $$ begin alter type job_type add value if not exists 'content-analysis';   exception when others then null; end $$;
