-- Gunpo Geumjeong-dong parcel 875 contains TWO independently listed K-apt
-- complexes, even though the cadastral lot is identical:
-- 1st: kapt A43575803 / MOLIT 351~359 / 1993 / 41.85,42.75m2
-- 2nd: kapt A43582405 / MOLIT 360~368 / 1995 / 37.67,39.87m2
-- Do not rewrite the source text, source key, transaction ID, or original audit.
CREATE TABLE IF NOT EXISTS public.apt_trade_identity_correction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.apt_trades(id) ON DELETE RESTRICT,
  from_complex_id uuid REFERENCES public.apt_complexes(id) ON DELETE RESTRICT,
  to_complex_id uuid NOT NULL REFERENCES public.apt_complexes(id) ON DELETE RESTRICT,
  correction_reason text NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id,to_complex_id,correction_reason)
);
ALTER TABLE public.apt_trade_identity_correction_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apt_trade_identity_correction_log FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.apt_trade_identity_correction_log TO service_role;

-- Fail closed when any importer, including the currently deployed legacy
-- importer, attempts to assign an inconsistent building subgroup to a complex.
-- This guard intentionally fails an outdated Gunpo sync, rather than allowing
-- stale aggregates to be recomputed from the wrong complex ID.
CREATE OR REPLACE FUNCTION public.protect_geumjeong_shared_parcel_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_first uuid;
  v_second uuid;
  v_expected uuid;
  v_dong text;
  v_dong_number integer;
  v_min integer;
  v_max integer;
BEGIN
  IF NEW.region_code<>'41410' OR NEW.legal_dong IS DISTINCT FROM '금정동'
    THEN RETURN NEW; END IF;
  SELECT id INTO v_first FROM public.apt_complexes WHERE kapt_code='A43575803';
  SELECT id INTO v_second FROM public.apt_complexes WHERE kapt_code='A43582405';
  IF NEW.source_apartment_name NOT IN ('퇴계주공(351~359동)','퇴계주공(360~368동)')
    AND NEW.complex_id IS DISTINCT FROM v_first
    AND NEW.complex_id IS DISTINCT FROM v_second THEN RETURN NEW; END IF;
  IF v_first IS NULL OR v_second IS NULL THEN
    RAISE EXCEPTION 'Gunpo shared parcel: K-apt first/second group is absent; hold for review';
  END IF;
  IF NEW.jibun IS DISTINCT FROM '875' THEN
    RAISE EXCEPTION 'Gunpo shared parcel: conflicting cadastral lot, hold for review';
  END IF;
  v_dong:=btrim(coalesce(NEW.raw->>'aptDong',''));
  IF NEW.source_apartment_name='퇴계주공(351~359동)' THEN
    IF NEW.build_year IS DISTINCT FROM 1993 OR NEW.exclusive_area NOT IN (41.85,42.75) THEN
      RAISE EXCEPTION 'Gunpo 1st: construction year or exclusive area conflicts';
    END IF;
    v_expected:=v_first;v_min:=351;v_max:=359;
  ELSIF NEW.source_apartment_name='퇴계주공(360~368동)' THEN
    IF NEW.build_year IS DISTINCT FROM 1995 OR NEW.exclusive_area NOT IN (37.67,39.87) THEN
      RAISE EXCEPTION 'Gunpo 2nd: construction year or exclusive area conflicts';
    END IF;
    v_expected:=v_second;v_min:=360;v_max:=368;
  ELSE
    RAISE EXCEPTION 'Gunpo shared parcel: unknown building subgroup; hold for review';
  END IF;
  IF v_dong<>'' THEN
    IF v_dong !~ '^[0-9]{3}(동)?$' THEN
      RAISE EXCEPTION 'Gunpo shared parcel: invalid source building number';
    END IF;
    v_dong_number:=substring(v_dong FROM '^[0-9]{3}')::integer;
    IF v_dong_number<v_min OR v_dong_number>v_max THEN
      RAISE EXCEPTION 'Gunpo shared parcel: source building number conflicts';
    END IF;
  END IF;
  IF NEW.complex_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Gunpo shared parcel: wrong complex ID for source building group; update importer before sync';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_geumjeong_shared_parcel_identity_trigger ON public.apt_trades;
CREATE TRIGGER protect_geumjeong_shared_parcel_identity_trigger
BEFORE INSERT OR UPDATE OF complex_id,region_code,legal_dong,jibun,
 source_apartment_name,build_year,exclusive_area,raw
ON public.apt_trades FOR EACH ROW
EXECUTE FUNCTION public.protect_geumjeong_shared_parcel_identity();
REVOKE ALL ON FUNCTION public.protect_geumjeong_shared_parcel_identity()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_geumjeong_shared_parcel_identity() TO service_role;

-- Atomic, narrowly scoped correction.  Empty new installations skip the data
-- repair; an unexpected partial/changed production source fails the migration.
DO $$
DECLARE
  v_first uuid;v_second uuid;
  v_count_first integer;v_count_second integer;v_bad integer;v_moved integer;
  v_asof date:=(now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  SELECT id INTO v_first FROM public.apt_complexes WHERE kapt_code='A43575803';
  SELECT id INTO v_second FROM public.apt_complexes WHERE kapt_code='A43582405';
  SELECT count(*) INTO v_count_first FROM public.apt_trades
   WHERE region_code='41410' AND legal_dong='금정동' AND jibun='875'
     AND source_apartment_name='퇴계주공(351~359동)';
  SELECT count(*) INTO v_count_second FROM public.apt_trades
   WHERE region_code='41410' AND legal_dong='금정동' AND jibun='875'
     AND source_apartment_name='퇴계주공(360~368동)';
  IF v_count_first=0 AND v_count_second=0 THEN RETURN; END IF;
  IF v_first IS NULL OR v_second IS NULL OR v_count_first<>64 OR v_count_second<>72 THEN
    RAISE EXCEPTION 'Unexpected Gunpo source snapshot (first %, second %); no repair performed',
      v_count_first,v_count_second;
  END IF;
  SELECT count(*) INTO v_bad FROM public.apt_trades t
  WHERE t.region_code='41410' AND t.legal_dong='금정동' AND t.jibun='875'
    AND (
     (t.source_apartment_name='퇴계주공(351~359동)'
      AND (t.complex_id IS DISTINCT FROM v_second OR t.build_year IS DISTINCT FROM 1993
       OR t.exclusive_area NOT IN (41.85,42.75)
       OR (coalesce(t.raw->>'aptDong','')<>'' AND
          (t.raw->>'aptDong' !~ '^35[1-9](동)?$'))))
     OR
     (t.source_apartment_name='퇴계주공(360~368동)'
      AND (t.complex_id IS DISTINCT FROM v_second OR t.build_year IS DISTINCT FROM 1995
       OR t.exclusive_area NOT IN (37.67,39.87)
       OR (coalesce(t.raw->>'aptDong','')<>'' AND
          (t.raw->>'aptDong' !~ '^(36[0-8])(동)?$'))))
    );
  IF v_bad<>0 THEN
    RAISE EXCEPTION 'Gunpo source subgroup contains % conflicting rows; no repair performed',v_bad;
  END IF;

  WITH old_rows AS MATERIALIZED (
    SELECT id,complex_id FROM public.apt_trades
    WHERE region_code='41410' AND legal_dong='금정동' AND jibun='875'
      AND source_apartment_name='퇴계주공(351~359동)' FOR UPDATE
  ), moved AS (
    UPDATE public.apt_trades t SET complex_id=v_first,updated_at=now()
    FROM old_rows o WHERE t.id=o.id
    RETURNING t.id AS trade_id,o.complex_id AS from_id,t.region_code
  )
  INSERT INTO public.apt_trade_identity_correction_log
    (trade_id,from_complex_id,to_complex_id,correction_reason)
  SELECT trade_id,from_id,v_first,
    'parcel_875_verified_molit_351_359_vs_360_368_20261002'
  FROM moved;
  GET DIAGNOSTICS v_moved=ROW_COUNT;
  IF v_moved<>64 THEN RAISE EXCEPTION 'Expected 64 corrected first-group trades; got %',v_moved; END IF;

  UPDATE public.apt_complexes SET match_status='matched',updated_at=now()
    WHERE id IN (v_first,v_second);
  PERFORM public.rebuild_verified_apartment_snapshot(v_first,v_asof);
  PERFORM public.rebuild_verified_apartment_snapshot(v_second,v_asof);
  PERFORM public.refresh_apartment_unmatched_candidates('41410',v_asof);
END;
$$;
NOTIFY pgrst,'reload schema';
