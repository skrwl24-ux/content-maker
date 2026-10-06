create table if not exists public.presale_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  checked_at date not null,
  summary text not null default '',
  questions jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  created_at timestamptz not null default now()
);

alter table public.presale_discovery_runs enable row level security;
revoke all on table public.presale_discovery_runs from anon, authenticated;
grant select, insert, update, delete on table public.presale_discovery_runs to service_role;

create table if not exists public.presale_discovery_candidates (
  id text primary key,
  event_key text not null default '',
  candidate_json jsonb not null default '{}'::jsonb,
  publication_status text not null default 'queue'
    check (publication_status in ('queue', 'published')),
  origin text not null default 'ai'
    check (origin in ('baseline', 'ai', 'manual')),
  discovery_run_id uuid references public.presale_discovery_runs(id) on delete set null,
  checked_at date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.presale_discovery_candidates enable row level security;
revoke all on table public.presale_discovery_candidates from anon, authenticated;
grant select, insert, update, delete on table public.presale_discovery_candidates to service_role;

create index if not exists presale_discovery_candidates_status_idx
  on public.presale_discovery_candidates(publication_status, updated_at desc);

create index if not exists presale_discovery_candidates_run_idx
  on public.presale_discovery_candidates(discovery_run_id);

insert into public.presale_discovery_candidates
  (id, event_key, candidate_json, publication_status, origin, checked_at, published_at)
values
  ('godeok-gangil-3', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('banpo-dh-claest', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('gyeonggi-gwangju-lotte-2', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('hyangnam-lotte-signature', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('forena-jije', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('ansan-armuse-xi', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('junghwa-raon-centro', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('gwanggyo-a17', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('gangbyeon-ipark-resupply', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('gyeonghu-epit', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('incheon-gyeyang-a6', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now()),
  ('seongnam-sangdaewon-2', 'baseline-2026-10-04', '{}'::jsonb, 'published', 'baseline', '2026-10-04', now())
on conflict (id) do nothing;
