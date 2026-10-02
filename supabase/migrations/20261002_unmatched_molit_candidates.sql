-- Stage MOLIT-only apartment transaction names separately from K-apt complexes.
-- These records must NEVER be treated as verified complexes or joined to
-- apt_trades.complex_id without an independent, reviewed identity check.
CREATE TABLE IF NOT EXISTS public.apt_unmatched_source_candidates (
  candidate_key text PRIMARY KEY,
  region_code text NOT NULL,
  legal_dong text NOT NULL,
  jibun text NOT NULL,
  source_apartment_name text NOT NULL,
  normalized_apartment_name text NOT NULL,
  build_year integer,
  classification text NOT NULL CHECK (classification IN (
    'kapt_lot_not_found', 'multiple_kapt_same_lot',
    'year_check_failed', 'unique_lot_unresolved'
  )),
  same_lot_kapt_count integer NOT NULL DEFAULT 0 CHECK (same_lot_kapt_count >= 0),
  year_compatible_kapt_count integer NOT NULL DEFAULT 0 CHECK (year_compatible_kapt_count >= 0),
  raw_trade_count integer NOT NULL DEFAULT 0 CHECK (raw_trade_count >= 0),
  recent_valid_trade_count integer NOT NULL DEFAULT 0 CHECK (recent_valid_trade_count >= 0),
  cancelled_trade_count integer NOT NULL DEFAULT 0 CHECK (cancelled_trade_count >= 0),
  first_contract_date date,
  latest_contract_date date,
  area_groups integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  analysis_date date NOT NULL,
  review_status text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review','reviewing','verified','excluded')),
  is_active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apt_unmatched_candidates_active_region_order_idx
  ON public.apt_unmatched_source_candidates(region_code, recent_valid_trade_count DESC, raw_trade_count DESC)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS apt_unmatched_candidates_active_name_idx
  ON public.apt_unmatched_source_candidates(source_apartment_name)
  WHERE is_active = true;

-- Aggregated source facts are public in MOLIT, but only the service role may
-- populate or change this staging table. Browser clients get read-only rows.
ALTER TABLE public.apt_unmatched_source_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apt_unmatched_source_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.apt_unmatched_source_candidates TO anon, authenticated;
GRANT ALL ON public.apt_unmatched_source_candidates TO service_role;

DROP POLICY IF EXISTS "Read active unmatched MOLIT candidates" ON public.apt_unmatched_source_candidates;
CREATE POLICY "Read active unmatched MOLIT candidates"
  ON public.apt_unmatched_source_candidates FOR SELECT
  TO anon,authenticated USING (is_active = true);

CREATE OR REPLACE FUNCTION public.refresh_apartment_unmatched_candidates(
  p_region_code text, p_analysis_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_upserted integer := 0;
  v_deactivated integer := 0;
BEGIN
  IF p_region_code IS NULL OR p_region_code !~ '^[0-9]{5}$'
    OR NOT EXISTS (SELECT 1 FROM public.apt_tracked_regions WHERE region_code=p_region_code)
    OR p_analysis_date IS NULL THEN
    RAISE EXCEPTION 'Invalid apartment candidate region/date';
  END IF;

  WITH source_groups AS MATERIALIZED (
    SELECT
      md5(jsonb_build_array(
        t.region_code,t.legal_dong,t.jibun,t.source_apartment_name,t.build_year
      )::text) AS candidate_key,
      t.region_code,
      t.legal_dong,
      t.jibun,
      t.source_apartment_name,
      min(t.normalized_apartment_name) AS normalized_apartment_name,
      t.build_year,
      count(*)::integer AS raw_trade_count,
      count(*) FILTER (
        WHERE t.cancelled=false
          AND t.contract_date BETWEEN p_analysis_date-182 AND p_analysis_date
      )::integer AS recent_valid_trade_count,
      count(*) FILTER (WHERE t.cancelled=true)::integer AS cancelled_trade_count,
      min(t.contract_date) AS first_contract_date,
      max(t.contract_date) FILTER (WHERE t.cancelled=false) AS latest_contract_date,
      coalesce(array_agg(DISTINCT t.area_group ORDER BY t.area_group)
        FILTER (WHERE t.cancelled=false), ARRAY[]::integer[]) AS area_groups
    FROM public.apt_trades t
    WHERE t.region_code=p_region_code AND t.complex_id IS NULL
      AND t.contract_date<=p_analysis_date
      AND t.legal_dong IS NOT NULL AND t.jibun IS NOT NULL
      AND t.source_apartment_name IS NOT NULL
    GROUP BY t.region_code,t.legal_dong,t.jibun,t.source_apartment_name,t.build_year
  ), staged AS (
    SELECT g.*, coalesce(k.same_lot_count,0) AS same_lot_count,
      coalesce(k.compatible_count,0) AS compatible_count,
      CASE
        WHEN coalesce(k.same_lot_count,0)=0 THEN 'kapt_lot_not_found'
        WHEN k.same_lot_count>1 THEN 'multiple_kapt_same_lot'
        WHEN k.compatible_count=0 THEN 'year_check_failed'
        ELSE 'unique_lot_unresolved'
      END AS reason
    FROM source_groups g
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS same_lot_count,
        count(*) FILTER (
          WHERE g.build_year IS NOT NULL AND c.use_date IS NOT NULL
            AND abs(g.build_year - extract(year from c.use_date)::integer)<=2
        )::integer AS compatible_count
      FROM public.apt_complexes c
      WHERE c.region_code=g.region_code
        AND c.legal_dong=g.legal_dong
        AND substring(btrim(split_part(coalesce(c.address,''),c.legal_dong,2))
          FROM '^([0-9]+(?:-[0-9]+)?)(?:[[:space:]]|$)')=g.jibun
    ) k ON true
  ), inserted AS (
    INSERT INTO public.apt_unmatched_source_candidates(
      candidate_key,region_code,legal_dong,jibun,source_apartment_name,
      normalized_apartment_name,build_year,classification,
      same_lot_kapt_count,year_compatible_kapt_count,
      raw_trade_count,recent_valid_trade_count,cancelled_trade_count,
      first_contract_date,latest_contract_date,area_groups,analysis_date,
      is_active,last_seen_at,updated_at
    )
    SELECT candidate_key,region_code,legal_dong,jibun,source_apartment_name,
      normalized_apartment_name,build_year,reason,
      same_lot_count,compatible_count,
      raw_trade_count,recent_valid_trade_count,cancelled_trade_count,
      first_contract_date,latest_contract_date,area_groups,p_analysis_date,
      true,now(),now()
    FROM staged
    ON CONFLICT(candidate_key) DO UPDATE SET
      normalized_apartment_name=EXCLUDED.normalized_apartment_name,
      classification=EXCLUDED.classification,
      same_lot_kapt_count=EXCLUDED.same_lot_kapt_count,
      year_compatible_kapt_count=EXCLUDED.year_compatible_kapt_count,
      raw_trade_count=EXCLUDED.raw_trade_count,
      recent_valid_trade_count=EXCLUDED.recent_valid_trade_count,
      cancelled_trade_count=EXCLUDED.cancelled_trade_count,
      first_contract_date=EXCLUDED.first_contract_date,
      latest_contract_date=EXCLUDED.latest_contract_date,
      area_groups=EXCLUDED.area_groups,
      analysis_date=EXCLUDED.analysis_date,
      is_active=true,
      last_seen_at=now(),updated_at=now()
    RETURNING candidate_key
  )
  SELECT count(*)::integer INTO v_upserted FROM inserted;

  -- Keep the review trail while withdrawing entries whose source records were
  -- linked or disappeared. Verification status is deliberately not changed.
  UPDATE public.apt_unmatched_source_candidates c
    SET is_active=false, updated_at=now()
  WHERE c.region_code=p_region_code AND c.is_active=true
    AND NOT EXISTS (
      SELECT 1 FROM public.apt_trades t
      WHERE t.region_code=p_region_code
        AND t.complex_id IS NULL AND t.contract_date<=p_analysis_date
        AND md5(jsonb_build_array(
          t.region_code,t.legal_dong,t.jibun,t.source_apartment_name,t.build_year
        )::text)=c.candidate_key
    );
  GET DIAGNOSTICS v_deactivated = ROW_COUNT;

  RETURN jsonb_build_object(
    'regionCode',p_region_code,'asOf',p_analysis_date,
    'activeCandidatesUpserted',v_upserted,
    'resolvedOrMissingDeactivated',v_deactivated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_apartment_unmatched_candidates(text,date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_apartment_unmatched_candidates(text,date)
  TO service_role;
COMMENT ON TABLE public.apt_unmatched_source_candidates IS
  'Read-only MOLIT-origin identity-review queue; not a verified K-apt or a publishable apartment complex.';
NOTIFY pgrst, 'reload schema';
