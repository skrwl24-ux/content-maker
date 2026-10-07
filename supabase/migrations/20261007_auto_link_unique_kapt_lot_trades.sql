-- Automatically link MOLIT source names when one exact legal-dong + cadastral
-- lot maps to exactly one K-apt management complex and construction year does
-- not conflict. Ambiguous shared-lot cases remain in the review queue.

create or replace function public.auto_link_unique_kapt_lot_trades(
  p_region_code text default null,
  p_analysis_date date default ((now() at time zone 'Asia/Seoul')::date)
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public
as $$
declare
  v_linked integer := 0;
  v_audited integer := 0;
  v_complex_ids uuid[] := array[]::uuid[];
  v_regions text[] := array[]::text[];
  v_complex_id uuid;
  v_region text;
begin
  if p_region_code is not null and p_region_code !~ '^[0-9]{5}$' then
    raise exception 'Invalid region code';
  end if;
  if p_analysis_date is null then
    raise exception 'Analysis date required';
  end if;

  with eligible as materialized (
    select
      t.id as trade_id,
      t.region_code,
      c.id as target_complex_id
    from public.apt_trades t
    join lateral (
      select x.id
      from public.apt_complexes x
      where x.region_code=t.region_code
        and x.legal_dong=t.legal_dong
        and substring(
          btrim(split_part(coalesce(x.address,''),x.legal_dong,2))
          from '^([0-9]+(?:-[0-9]+)?)(?:[[:space:]]|$)'
        )=t.jibun
      group by x.id
      having (
        select count(*)
        from public.apt_complexes y
        where y.region_code=t.region_code
          and y.legal_dong=t.legal_dong
          and substring(
            btrim(split_part(coalesce(y.address,''),y.legal_dong,2))
            from '^([0-9]+(?:-[0-9]+)?)(?:[[:space:]]|$)'
          )=t.jibun
      )=1
      limit 1
    ) c on true
    join public.apt_complexes target on target.id=c.id
    where t.complex_id is null
      and t.legal_dong is not null
      and t.jibun is not null
      and (p_region_code is null or t.region_code=p_region_code)
      and (
        t.build_year is null
        or target.use_date is null
        or abs(t.build_year-extract(year from target.use_date)::integer)<=2
      )
      and not exists (
        select 1 from public.apt_trade_match_repair_audit a
        where a.trade_id=t.id
      )
  ), updated as (
    update public.apt_trades t
    set complex_id=e.target_complex_id, updated_at=now()
    from eligible e
    where t.id=e.trade_id and t.complex_id is null
    returning t.id,t.region_code,e.target_complex_id
  ), audited as (
    insert into public.apt_trade_match_repair_audit(
      trade_id,prior_complex_id,matched_complex_id,region_code,match_rule,matched_at
    )
    select id,null,target_complex_id,region_code,'unique_kapt_lot_auto_v1',now()
    from updated
    on conflict (trade_id) do nothing
    returning trade_id,matched_complex_id,region_code
  )
  select
    (select count(*)::integer from updated),
    count(*)::integer,
    coalesce(array_agg(distinct matched_complex_id),array[]::uuid[]),
    coalesce(array_agg(distinct region_code),array[]::text[])
  into v_linked,v_audited,v_complex_ids,v_regions
  from audited;

  if v_linked<>v_audited then
    raise exception 'Auto-link audit count mismatch';
  end if;

  if coalesce(array_length(v_complex_ids,1),0)>0 then
    update public.apt_complexes
    set match_status='matched',updated_at=now()
    where id=any(v_complex_ids);

    foreach v_complex_id in array v_complex_ids loop
      perform public.rebuild_verified_apartment_snapshot(v_complex_id,p_analysis_date);
    end loop;
  end if;

  if coalesce(array_length(v_regions,1),0)>0 then
    foreach v_region in array v_regions loop
      perform public.refresh_apartment_unmatched_candidates(v_region,p_analysis_date);
    end loop;
  elsif p_region_code is not null then
    perform public.refresh_apartment_unmatched_candidates(p_region_code,p_analysis_date);
  end if;

  return jsonb_build_object(
    'linkedTradeCount',v_linked,
    'affectedComplexCount',coalesce(array_length(v_complex_ids,1),0),
    'affectedRegionCount',coalesce(array_length(v_regions,1),0),
    'rule','unique_kapt_lot_auto_v1'
  );
end;
$$;

revoke all on function public.auto_link_unique_kapt_lot_trades(text,date)
from public,anon,authenticated;
grant execute on function public.auto_link_unique_kapt_lot_trades(text,date)
to service_role;

comment on function public.auto_link_unique_kapt_lot_trades(text,date) is
  'Safely links unassigned MOLIT trades when legal dong + cadastral lot identifies exactly one K-apt management complex and construction year does not conflict.';

select public.auto_link_unique_kapt_lot_trades(null, ((now() at time zone 'Asia/Seoul')::date));

notify pgrst,'reload schema';
