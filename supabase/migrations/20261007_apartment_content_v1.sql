create extension if not exists pgcrypto;

create or replace view public.apt_content_year_ranking
with (security_invoker = true)
as
with counts as (
  select
    t.complex_id,
    extract(year from t.contract_date)::int as year,
    count(*)::int as transaction_count
  from public.apt_trades t
  where t.complex_id is not null
    and t.cancelled = false
  group by t.complex_id, extract(year from t.contract_date)::int
)
select
  counts.complex_id,
  counts.year,
  counts.transaction_count,
  dense_rank() over (
    partition by counts.year
    order by counts.transaction_count desc, counts.complex_id
  )::int as national_rank,
  c.name,
  c.sido,
  c.sigungu,
  c.legal_dong,
  c.address,
  c.road_address,
  c.households,
  c.use_date
from counts
join public.apt_complexes c on c.id = counts.complex_id;

grant select on public.apt_content_year_ranking to authenticated;

create table if not exists public.apt_content_area_structures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  complex_id uuid not null references public.apt_complexes(id) on delete cascade,
  area_group integer not null,
  room_count integer,
  bath_count integer,
  status text not null default 'needs_check'
    check (status in ('verified', 'varies', 'needs_check')),
  source_text text not null default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, complex_id, area_group)
);

create table if not exists public.apt_content_candidate_pool (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  complex_id uuid not null references public.apt_complexes(id) on delete cascade,
  rank integer not null,
  transaction_count integer not null default 0,
  status text not null default 'ready'
    check (status in ('ready', 'reserved', 'published', 'blocked')),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, complex_id)
);

create table if not exists public.apt_content_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  complex_id uuid not null references public.apt_complexes(id) on delete restrict,
  reference_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  status text not null default 'draft'
    check (status in ('draft', 'preparing', 'ready', 'published')),
  data_status text not null default 'pending'
    check (data_status in ('pending', 'pass', 'warning')),
  data_snapshot jsonb not null default '{}'::jsonb,
  data_check_result jsonb not null default '{}'::jsonb,
  structure_mode text not null default 'include'
    check (structure_mode in ('include', 'exclude')),
  structure_snapshot jsonb not null default '[]'::jsonb,
  kick_status text not null default 'pending'
    check (kick_status in ('pending', 'verified', 'not_found')),
  kick_title text not null default '',
  kick_summary text not null default '',
  kick_source_text text not null default '',
  kick_snapshot jsonb not null default '{}'::jsonb,
  final_article text not null default '',
  naver_formatted text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apt_content_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  slot_no integer not null check (slot_no in (1, 2)),
  complex_id uuid not null references public.apt_complexes(id) on delete restrict,
  article_id uuid references public.apt_content_articles(id) on delete set null,
  status text not null default 'recommended'
    check (status in ('recommended', 'working', 'replaceable')),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, slot_no)
);

create table if not exists public.apt_content_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,
  name text not null,
  is_active boolean not null default true,
  template_text text not null default '',
  reference_image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_key)
);

create index if not exists apt_content_candidate_pool_lookup_idx
  on public.apt_content_candidate_pool (user_id, year, status, rank);
create index if not exists apt_content_articles_user_idx
  on public.apt_content_articles (user_id, created_at desc);
create index if not exists apt_content_recommendations_user_idx
  on public.apt_content_recommendations (user_id, year, slot_no);

alter table public.apt_content_area_structures enable row level security;
alter table public.apt_content_candidate_pool enable row level security;
alter table public.apt_content_articles enable row level security;
alter table public.apt_content_recommendations enable row level security;
alter table public.apt_content_prompt_templates enable row level security;

drop policy if exists "apt_content_area_structures own rows" on public.apt_content_area_structures;
create policy "apt_content_area_structures own rows"
on public.apt_content_area_structures for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "apt_content_candidate_pool own rows" on public.apt_content_candidate_pool;
create policy "apt_content_candidate_pool own rows"
on public.apt_content_candidate_pool for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "apt_content_articles own rows" on public.apt_content_articles;
create policy "apt_content_articles own rows"
on public.apt_content_articles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "apt_content_recommendations own rows" on public.apt_content_recommendations;
create policy "apt_content_recommendations own rows"
on public.apt_content_recommendations for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "apt_content_prompt_templates own rows" on public.apt_content_prompt_templates;
create policy "apt_content_prompt_templates own rows"
on public.apt_content_prompt_templates for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.apt_content_area_structures to authenticated;
grant select, insert, update, delete on public.apt_content_candidate_pool to authenticated;
grant select, insert, update, delete on public.apt_content_articles to authenticated;
grant select, insert, update, delete on public.apt_content_recommendations to authenticated;
grant select, insert, update, delete on public.apt_content_prompt_templates to authenticated;
