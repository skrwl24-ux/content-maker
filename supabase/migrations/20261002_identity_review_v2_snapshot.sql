-- Rebuild the selected target complex from its actual, non-cancelled
-- transaction records. Do not use prices from a different area group.
CREATE OR REPLACE FUNCTION public.rebuild_verified_apartment_snapshot(
 p_complex_id uuid, p_analysis_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE
 v_complex public.apt_complexes%ROWTYPE;
 v_recent integer; v_previous integer; v_six integer; v_last date;
 v_area integer; v_area_n integer; v_valid integer;
 v_first bigint; v_latest bigint; v_pct numeric;
 v_volume boolean; v_active boolean; v_price boolean; v_fresh boolean;
 v_signals integer; v_status text; v_angle text;
 v_month_start text;
BEGIN
 SELECT * INTO STRICT v_complex FROM public.apt_complexes WHERE id=p_complex_id;
 IF p_analysis_date IS NULL THEN RAISE EXCEPTION 'Analysis date required'; END IF;
 v_month_start:=to_char(date_trunc('month',p_analysis_date::timestamp)-interval '6 months','YYYY-MM');

 -- Restrict the refresh to the seven-calendar-month chart source window.
 INSERT INTO public.apt_monthly_stats
 (complex_id,area_group,year_month,trade_count,median_price,min_price,max_price,calculated_at)
 SELECT t.complex_id,t.area_group,
   substr(t.contract_year_month,1,4)||'-'||substr(t.contract_year_month,5,2),
   count(*)::integer,
   round(percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_won))::bigint,
   min(t.price_won),max(t.price_won),now()
 FROM public.apt_trades t
 WHERE t.complex_id=p_complex_id AND t.cancelled=false
  AND t.contract_date<=p_analysis_date
  AND t.contract_year_month>=replace(v_month_start,'-','')
 GROUP BY t.complex_id,t.area_group,t.contract_year_month
 ON CONFLICT(complex_id,area_group,year_month) DO UPDATE SET
  trade_count=EXCLUDED.trade_count,median_price=EXCLUDED.median_price,
  min_price=EXCLUDED.min_price,max_price=EXCLUDED.max_price,calculated_at=now();

 -- Do not retain a former monthly entry that is unsupported by raw sales.
 DELETE FROM public.apt_monthly_stats m
 WHERE m.complex_id=p_complex_id AND m.year_month>=v_month_start
  AND m.year_month<=to_char(p_analysis_date,'YYYY-MM')
  AND NOT EXISTS(
   SELECT 1 FROM public.apt_trades t
   WHERE t.complex_id=m.complex_id AND t.cancelled=false
    AND t.area_group=m.area_group
    AND t.contract_year_month=replace(m.year_month,'-','')
    AND t.contract_date<=p_analysis_date
  );

 SELECT
   count(*) FILTER(WHERE contract_date BETWEEN p_analysis_date-29 AND p_analysis_date)::integer,
   count(*) FILTER(WHERE contract_date BETWEEN p_analysis_date-59 AND p_analysis_date-30)::integer,
   count(*) FILTER(WHERE contract_date BETWEEN p_analysis_date-182 AND p_analysis_date)::integer,
   max(contract_date)
 INTO v_recent,v_previous,v_six,v_last
 FROM public.apt_trades
 WHERE complex_id=p_complex_id AND cancelled=false AND contract_date<=p_analysis_date;

 SELECT area_group,count(*)::integer INTO v_area,v_area_n
 FROM public.apt_trades
 WHERE complex_id=p_complex_id AND cancelled=false
  AND contract_date BETWEEN p_analysis_date-182 AND p_analysis_date
 GROUP BY area_group ORDER BY count(*) DESC,area_group ASC LIMIT 1;
 v_area_n:=coalesce(v_area_n,0);
 v_first:=NULL;v_latest:=NULL;v_valid:=0;
 IF v_area IS NOT NULL THEN
   SELECT
     (array_agg(median_price ORDER BY year_month ASC))[1],
     (array_agg(median_price ORDER BY year_month DESC))[1],
     count(*)::integer
   INTO v_first,v_latest,v_valid
   FROM (
     SELECT year_month,median_price FROM public.apt_monthly_stats
     WHERE complex_id=p_complex_id AND area_group=v_area
      AND year_month BETWEEN v_month_start AND to_char(p_analysis_date,'YYYY-MM')
      AND trade_count>0 AND median_price IS NOT NULL
     ORDER BY year_month DESC LIMIT 6
   ) last_six;
 END IF;
 v_pct:=CASE WHEN coalesce(v_first,0)>0 AND v_latest IS NOT NULL
   THEN round((v_latest::numeric-v_first::numeric)*100/v_first::numeric,3)
   ELSE NULL END;
 v_volume:=v_recent>=4 AND v_recent-v_previous>=2
   AND (v_previous=0 OR v_recent::numeric/v_previous>=1.5);
 v_active:=v_six>=12 AND v_recent>=3;
 v_price:=v_valid>=3 AND v_area_n>=6 AND abs(coalesce(v_pct,0))>=5;
 v_fresh:=v_last IS NOT NULL AND p_analysis_date-v_last<=14 AND v_recent>=3;
 v_signals:=v_volume::integer+v_active::integer+v_price::integer+v_fresh::integer;
 v_status:=CASE WHEN v_six>=6 AND v_last IS NOT NULL
     AND p_analysis_date-v_last<=60 AND v_signals>=1
   THEN CASE WHEN v_signals>=2 THEN 'priority' ELSE 'candidate' END
   ELSE 'hold' END;
 v_angle:=CASE WHEN v_volume THEN '최근 거래가 왜 늘었을까?'
   WHEN v_price THEN '최근 6개월 가격은 얼마나 움직였을까?'
   WHEN v_active THEN '요즘 얼마에 거래될까?'
   ELSE '최근 거래는 어떻게 움직이고 있을까?' END;

 INSERT INTO public.apt_candidate_snapshots(
  analysis_date,complex_id,region_code,households,
  recent_30_count,previous_30_count,six_month_count,days_since_last_trade,
  representative_area_group,representative_area_six_month_count,
  first_median_price,latest_median_price,six_month_change_pct,
  badge_volume_increase,badge_active_trading,badge_price_change,
  badge_recent_trade,badge_large_complex,market_signal_count,
  candidate_status,recommended_angle,created_at
 ) VALUES (
  p_analysis_date,p_complex_id,v_complex.region_code,v_complex.households,
  v_recent,v_previous,v_six,CASE WHEN v_last IS NULL THEN NULL ELSE p_analysis_date-v_last END,
  v_area,v_area_n,v_first,v_latest,v_pct,
  v_volume,v_active,v_price,v_fresh,coalesce(v_complex.households,0)>=1000,v_signals,
  v_status,v_angle,now()
 )
 ON CONFLICT(analysis_date,complex_id) DO UPDATE SET
  households=EXCLUDED.households,region_code=EXCLUDED.region_code,
  recent_30_count=EXCLUDED.recent_30_count,previous_30_count=EXCLUDED.previous_30_count,
  six_month_count=EXCLUDED.six_month_count,days_since_last_trade=EXCLUDED.days_since_last_trade,
  representative_area_group=EXCLUDED.representative_area_group,
  representative_area_six_month_count=EXCLUDED.representative_area_six_month_count,
  first_median_price=EXCLUDED.first_median_price,
  latest_median_price=EXCLUDED.latest_median_price,
  six_month_change_pct=EXCLUDED.six_month_change_pct,
  badge_volume_increase=EXCLUDED.badge_volume_increase,
  badge_active_trading=EXCLUDED.badge_active_trading,
  badge_price_change=EXCLUDED.badge_price_change,
  badge_recent_trade=EXCLUDED.badge_recent_trade,
  badge_large_complex=EXCLUDED.badge_large_complex,
  market_signal_count=EXCLUDED.market_signal_count,
  candidate_status=EXCLUDED.candidate_status,recommended_angle=EXCLUDED.recommended_angle,
  created_at=now();

 RETURN jsonb_build_object(
 'complexId',p_complex_id,'analysisDate',p_analysis_date,'sixMonthCount',v_six,
 'representativeAreaGroup',v_area,'representativeAreaCount',v_area_n,
 'firstMedianPrice',v_first,'latestMedianPrice',v_latest,'changePct',v_pct,
 'candidateStatus',v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.rebuild_verified_apartment_snapshot(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_verified_apartment_snapshot(uuid,date) TO service_role;
NOTIFY pgrst,'reload schema';