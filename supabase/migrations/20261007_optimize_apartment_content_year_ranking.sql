create table if not exists public.apt_content_year_counts (
  complex_id uuid not null references public.apt_complexes(id) on delete cascade,
  year integer not null,
  transaction_count integer not null default 0 check (transaction_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (complex_id, year)
);

insert into public.apt_content_year_counts (complex_id, year, transaction_count, updated_at)
select
  t.complex_id,
  extract(year from t.contract_date)::int as year,
  count(*)::int as transaction_count,
  now()
from public.apt_trades t
where t.complex_id is not null
  and t.cancelled = false
group by t.complex_id, extract(year from t.contract_date)::int
on conflict (complex_id, year) do update
set transaction_count = excluded.transaction_count,
    updated_at = excluded.updated_at;

create or replace function public.apt_content_adjust_year_count(
  p_complex_id uuid,
  p_contract_date date,
  p_delta integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer;
begin
  if p_complex_id is null or p_contract_date is null or p_delta = 0 then
    return;
  end if;
  y := extract(year from p_contract_date)::int;
  insert into public.apt_content_year_counts (complex_id, year, transaction_count, updated_at)
  values (p_complex_id, y, greatest(p_delta, 0), now())
  on conflict (complex_id, year) do update
  set transaction_count = greatest(0, public.apt_content_year_counts.transaction_count + p_delta),
      updated_at = now();

  delete from public.apt_content_year_counts
  where complex_id = p_complex_id
    and year = y
    and transaction_count = 0;
end;
$$;

create or replace function public.apt_content_sync_year_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.complex_id is not null and new.cancelled = false then
      perform public.apt_content_adjust_year_count(new.complex_id, new.contract_date, 1);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.complex_id is not null and old.cancelled = false then
      perform public.apt_content_adjust_year_count(old.complex_id, old.contract_date, -1);
    end if;
    return old;
  else
    if old.complex_id is not null and old.cancelled = false then
      perform public.apt_content_adjust_year_count(old.complex_id, old.contract_date, -1);
    end if;
    if new.complex_id is not null and new.cancelled = false then
      perform public.apt_content_adjust_year_count(new.complex_id, new.contract_date, 1);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists apt_content_year_count_sync on public.apt_trades;
create trigger apt_content_year_count_sync
after insert or delete or update of complex_id, contract_date, cancelled
on public.apt_trades
for each row
execute function public.apt_content_sync_year_count_trigger();

create or replace view public.apt_content_year_ranking
with (security_invoker = true)
as
select
  yc.complex_id,
  yc.year,
  yc.transaction_count,
  dense_rank() over (
    partition by yc.year
    order by yc.transaction_count desc, yc.complex_id
  )::int as national_rank,
  c.name,
  c.sido,
  c.sigungu,
  c.legal_dong,
  c.address,
  c.road_address,
  c.households,
  c.use_date
from public.apt_content_year_counts yc
join public.apt_complexes c on c.id = yc.complex_id
where yc.transaction_count > 0;

alter table public.apt_content_year_counts enable row level security;

drop policy if exists "apt_content_year_counts_public_read" on public.apt_content_year_counts;
create policy "apt_content_year_counts_public_read"
on public.apt_content_year_counts for select
to anon, authenticated
using (true);

grant select on public.apt_content_year_counts to anon, authenticated;
grant select on public.apt_content_year_ranking to anon, authenticated;
