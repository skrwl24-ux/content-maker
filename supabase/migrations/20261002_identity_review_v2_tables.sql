-- Reviewed MOLIT-to-K-apt identity decisions. Not accessible to browser clients.
CREATE TABLE IF NOT EXISTS public.apt_identity_review_decisions (
 candidate_key text PRIMARY KEY REFERENCES public.apt_unmatched_source_candidates(candidate_key) ON DELETE RESTRICT,
 target_complex_id uuid NOT NULL REFERENCES public.apt_complexes(id) ON DELETE RESTRICT,
 candidate_snapshot jsonb NOT NULL,
 target_snapshot jsonb NOT NULL,
 evidence jsonb NOT NULL,
 observed_raw_count integer NOT NULL CHECK (observed_raw_count > 0),
 decision_status text NOT NULL DEFAULT 'reviewing'
   CHECK (decision_status IN ('reviewing','approved','held')),
 approved_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.apt_verified_source_aliases (
 candidate_key text PRIMARY KEY REFERENCES public.apt_identity_review_decisions(candidate_key) ON DELETE RESTRICT,
 region_code text NOT NULL,
 legal_dong text NOT NULL,
 jibun text NOT NULL,
 source_apartment_name text NOT NULL,
 build_year integer,
 target_complex_id uuid NOT NULL REFERENCES public.apt_complexes(id) ON DELETE RESTRICT,
 is_active boolean NOT NULL DEFAULT true,
 approved_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apt_verified_source_aliases_group_idx
ON public.apt_verified_source_aliases(region_code,legal_dong,jibun,source_apartment_name,build_year)
WHERE is_active=true;
ALTER TABLE public.apt_identity_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apt_verified_source_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apt_identity_review_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.apt_verified_source_aliases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.apt_identity_review_decisions TO service_role;
GRANT ALL ON public.apt_verified_source_aliases TO service_role;

-- Persist explicitly approved links across future MOLIT upserts. If a newer
-- automated matcher contradicts a reviewed identity, fail closed for human
-- intervention rather than silently reassigning transaction records.
CREATE OR REPLACE FUNCTION public.keep_approved_apartment_trade_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE v_key text; v_target uuid; v_target_lot text; v_target_dong text; v_target_region text;
BEGIN
 v_key:=md5(jsonb_build_array(NEW.region_code,NEW.legal_dong,NEW.jibun,
    NEW.source_apartment_name,NEW.build_year)::text);
 SELECT a.target_complex_id INTO v_target
 FROM public.apt_verified_source_aliases a
 WHERE a.candidate_key=v_key AND a.is_active=true;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT region_code,legal_dong,
   substring(btrim(split_part(coalesce(address,''),legal_dong,2))
     FROM '^([0-9]+(?:-[0-9]+)?)(?:[[:space:]]|$)')
 INTO v_target_region,v_target_dong,v_target_lot
 FROM public.apt_complexes WHERE id=v_target;
 IF v_target_region IS DISTINCT FROM NEW.region_code
   OR v_target_dong IS DISTINCT FROM NEW.legal_dong
   OR (v_target_lot IS NOT NULL AND v_target_lot IS DISTINCT FROM NEW.jibun) THEN
   RAISE EXCEPTION 'Verified apartment identity conflicts with refreshed source fields: %', v_key;
 END IF;
 IF NEW.complex_id IS NOT NULL AND NEW.complex_id<>v_target THEN
   RAISE EXCEPTION 'Automated apartment matcher conflicts with approved source alias: %',v_key;
 END IF;
 NEW.complex_id:=v_target;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS keep_approved_apartment_trade_identity_trigger ON public.apt_trades;
CREATE TRIGGER keep_approved_apartment_trade_identity_trigger
BEFORE INSERT OR UPDATE OF complex_id,region_code,legal_dong,jibun,source_apartment_name,build_year
ON public.apt_trades FOR EACH ROW
EXECUTE FUNCTION public.keep_approved_apartment_trade_identity();
REVOKE ALL ON FUNCTION public.keep_approved_apartment_trade_identity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.keep_approved_apartment_trade_identity() TO service_role;
COMMENT ON TABLE public.apt_identity_review_decisions IS 'Private manual-review evidence and approval trail; URL submission is not independent fact verification.';
COMMENT ON TABLE public.apt_verified_source_aliases IS 'Only explicitly approved stable government transaction identity mappings. Maintained across recurring upserts.';
NOTIFY pgrst,'reload schema';