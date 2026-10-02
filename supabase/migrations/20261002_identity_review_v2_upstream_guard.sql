-- Never silently detach or re-identify an already approved source record
-- when a future upstream sync modifies one of its stable grouping fields.
CREATE OR REPLACE FUNCTION public.keep_approved_apartment_trade_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE
 v_key text;
 v_old_key text;
 v_target uuid;
 v_target_lot text;
 v_target_dong text;
 v_target_region text;
BEGIN
 v_key:=md5(jsonb_build_array(NEW.region_code,NEW.legal_dong,NEW.jibun,
    NEW.source_apartment_name,NEW.build_year)::text);

 IF TG_OP='UPDATE' THEN
   v_old_key:=md5(jsonb_build_array(OLD.region_code,OLD.legal_dong,OLD.jibun,
       OLD.source_apartment_name,OLD.build_year)::text);
   IF v_old_key<>v_key AND EXISTS(
     SELECT 1 FROM public.apt_verified_source_aliases a
     WHERE a.candidate_key=v_old_key AND a.is_active=true
   ) THEN
     RAISE EXCEPTION 'Approved source identity fields changed during new government-data sync: %. Manual review is required.',v_old_key;
   END IF;
 END IF;

 SELECT a.target_complex_id INTO v_target FROM public.apt_verified_source_aliases a
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
   RAISE EXCEPTION 'Approved target apartment identity conflicts with refreshed source fields: %',v_key;
 END IF;
 IF NEW.complex_id IS NOT NULL AND NEW.complex_id<>v_target THEN
   RAISE EXCEPTION 'Automatic apartment matching conflicts with approved source alias: %',v_key;
 END IF;
 NEW.complex_id:=v_target;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_approved_apartment_trade_identity()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.keep_approved_apartment_trade_identity() TO service_role;
