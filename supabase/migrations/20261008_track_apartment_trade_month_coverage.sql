
create table if not exists public.apt_trade_month_coverage (
  region_code text not null,
  year_month text not null,
  fetched_at timestamptz not null default now(),
  raw_trade_count integer not null default 0,
  source text not null default 'molit_api',
  primary key (region_code, year_month),
  constraint apt_trade_month_coverage_month_check
    check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint apt_trade_month_coverage_count_check
    check (raw_trade_count >= 0)
);

create index if not exists idx_apt_trade_month_coverage_fetched
  on public.apt_trade_month_coverage (region_code, fetched_at desc);

alter table public.apt_trade_month_coverage enable row level security;

drop policy if exists "authenticated can read apartment trade month coverage"
  on public.apt_trade_month_coverage;

create policy "authenticated can read apartment trade month coverage"
  on public.apt_trade_month_coverage
  for select
  to authenticated
  using (true);

grant select on public.apt_trade_month_coverage to authenticated;

comment on table public.apt_trade_month_coverage is
  'Tracks MOLIT month fetch completion separately from whether a month had any apartment trades.';

notify pgrst,'reload schema';
