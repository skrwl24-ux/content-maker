-- Keep materialized monthly statistics consistent after a trade is rematched
-- to another K-apt complex. Only the service-role synchronization client
-- can execute this cleanup; it never deletes raw transactions.
CREATE OR REPLACE FUNCTION public.cleanup_apartment_monthly_stats(
  p_region_code text,
  p_months text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  removed_count integer := 0;
BEGIN
  IF p_region_code IS NULL OR p_region_code !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid apartment region code';
  END IF;
  IF COALESCE(array_length(p_months, 1), 0) NOT BETWEEN 1 AND 12
     OR EXISTS (
       SELECT 1 FROM unnest(p_months) AS year_month
       WHERE year_month IS NULL OR year_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     ) THEN
    RAISE EXCEPTION 'Invalid apartment month window';
  END IF;

  DELETE FROM public.apt_monthly_stats m
  USING public.apt_complexes c
  WHERE c.id=m.complex_id
    AND c.region_code=p_region_code
    AND m.year_month=ANY(p_months)
    AND NOT EXISTS (
      SELECT 1 FROM public.apt_trades t
      WHERE t.complex_id=m.complex_id
        AND t.area_group=m.area_group
        AND t.contract_year_month=replace(m.year_month,'-','')
        AND t.cancelled=false
    );

  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_apartment_monthly_stats(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_apartment_monthly_stats(text, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_apartment_monthly_stats(text, text[]) TO service_role;
COMMENT ON FUNCTION public.cleanup_apartment_monthly_stats(text, text[]) IS
 'Service-role only: prune recent month/area rows no longer supported by matched, non-cancelled raw apartment trades.';
NOTIFY pgrst, 'reload schema';
