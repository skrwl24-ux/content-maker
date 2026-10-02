-- Operator review is a TWO-PHASE process. Stage has no effect on raw
-- transaction complex IDs; a second explicit approval uses one DB transaction.
CREATE OR REPLACE FUNCTION public.stage_apartment_identity_review(
 p_candidate_key text,p_target_complex_id uuid,p_evidence jsonb,
 p_expected_raw_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
AS $$
DECLARE
 c public.apt_unmatched_source_candidates%ROWTYPE;
 target public.apt_complexes%ROWTYPE;
 v_count integer;
 v_target_lot text;
BEGIN
 SELECT * INTO STRICT c FROM public.apt_unmatched_source_candidates
 WHERE candidate_key=p_candidate_key FOR UPDATE;
 IF NOT c.is_active OR c.review_status IN ('verified','excluded') THEN
   RAISE EXCEPTION 'This source identity is already resolved or is no longer active';
 END IF;
 SELECT * INTO STRICT target FROM public.apt_complexes
 WHERE id=p_target_complex_id;
 IF target.region_code<>c.region_code
   OR target.legal_dong IS DISTINCT FROM c.legal_dong THEN
   RAISE EXCEPTION 'Target apartment must be in exactly the same region and legal dong';
 END IF;
 IF p_expected_raw_count<>c.raw_trade_count OR c.raw_trade_count<1 THEN
   RAISE EXCEPTION 'Source trade counts changed. Refresh this candidate before review';
 END IF;
 SELECT count(*)::integer INTO v_count FROM public.apt_trades t
 WHERE t.complex_id IS NULL AND t.region_code=c.region_code
  AND t.legal_dong=c.legal_dong AND t.jibun=c.jibun
  AND t.source_apartment_name=c.source_apartment_name
  AND t.build_year IS NOT DISTINCT FROM c.build_year;
 IF v_count<>p_expected_raw_count THEN
   RAISE EXCEPTION 'Source records changed since candidate aggregation. Refresh and retry';
 END IF;

 -- Field-for-field comparison prevents a pasted report for another apartment
 -- from being staged on the current selection.
 IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
   OR p_evidence->>'verdict'<>'match'
   OR p_evidence->>'candidateKey' IS DISTINCT FROM c.candidate_key
   OR p_evidence->>'regionCode' IS DISTINCT FROM c.region_code
   OR p_evidence->>'legalDong' IS DISTINCT FROM c.legal_dong
   OR p_evidence->>'jibun' IS DISTINCT FROM c.jibun
   OR p_evidence->>'sourceApartmentName' IS DISTINCT FROM c.source_apartment_name
   OR ((p_evidence->>'buildYear')::integer IS DISTINCT FROM c.build_year)
   OR p_evidence->>'targetComplexId' IS DISTINCT FROM target.id::text
   OR p_evidence->>'targetComplexName' IS DISTINCT FROM target.name
   OR length(coalesce(p_evidence->>'explanation',''))<30
   OR jsonb_typeof(p_evidence->'sources') IS DISTINCT FROM 'array'
   OR jsonb_array_length(coalesce(p_evidence->'sources','[]'::jsonb))<2 THEN
   RAISE EXCEPTION 'Verification report differs from the selected source/target or lacks evidence';
 END IF;

 v_target_lot:=substring(btrim(split_part(coalesce(target.address,''),target.legal_dong,2))
       FROM '^([0-9]+(?:-[0-9]+)?)(?:[[:space:]]|$)');
 INSERT INTO public.apt_identity_review_decisions(
  candidate_key,target_complex_id,candidate_snapshot,target_snapshot,
  evidence,observed_raw_count,decision_status,created_at,updated_at
 ) VALUES (
  c.candidate_key,target.id,
  jsonb_build_object('regionCode',c.region_code,'legalDong',c.legal_dong,
   'jibun',c.jibun,'sourceApartmentName',c.source_apartment_name,
   'buildYear',c.build_year,'rawTradeCount',c.raw_trade_count),
  jsonb_build_object('name',target.name,'address',target.address,
   'useDate',target.use_date,'kaptCode',target.kapt_code,
   'targetLot',v_target_lot),
  p_evidence,v_count,'reviewing',now(),now()
 )
 ON CONFLICT(candidate_key) DO UPDATE SET
  target_complex_id=EXCLUDED.target_complex_id,
  candidate_snapshot=EXCLUDED.candidate_snapshot,
  target_snapshot=EXCLUDED.target_snapshot,
  evidence=EXCLUDED.evidence,
  observed_raw_count=EXCLUDED.observed_raw_count,
  decision_status='reviewing',updated_at=now()
 WHERE apt_identity_review_decisions.decision_status<>'approved';
 UPDATE public.apt_unmatched_source_candidates SET review_status='reviewing',
  updated_at=now() WHERE candidate_key=c.candidate_key;

 RETURN jsonb_build_object('candidateKey',c.candidate_key,'targetComplexId',target.id,
  'targetName',target.name,'sourceCount',v_count,
  'sameParcel',v_target_lot=c.jibun,'targetParcelKnown',v_target_lot IS NOT NULL,
  'sharedSourceParcel',c.same_lot_kapt_count>1,
  'targetConstructionYear',extract(year from target.use_date),
  'staged',true,'approved',false);
END;
$$;
REVOKE ALL ON FUNCTION public.stage_apartment_identity_review(text,uuid,jsonb,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_apartment_identity_review(text,uuid,jsonb,integer)
 TO service_role;

CREATE OR REPLACE FUNCTION public.approve_apartment_identity_review(
 p_candidate_key text,p_target_complex_id uuid,p_expected_raw_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
AS $$
DECLARE
 c public.apt_unmatched_source_candidates%ROWTYPE;
 target public.apt_complexes%ROWTYPE;
 d public.apt_identity_review_decisions%ROWTYPE;
 v_target_lot text;
 v_current_count integer:=0;
 v_linked integer:=0;
 v_result jsonb;
 v_trade record;
 v_date date:=(now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
 SELECT * INTO STRICT c FROM public.apt_unmatched_source_candidates
  WHERE candidate_key=p_candidate_key FOR UPDATE;
 SELECT * INTO STRICT d FROM public.apt_identity_review_decisions
  WHERE candidate_key=p_candidate_key FOR UPDATE;
 SELECT * INTO STRICT target FROM public.apt_complexes
  WHERE id=p_target_complex_id FOR SHARE;
 IF NOT c.is_active OR c.review_status<>'reviewing'
   OR d.decision_status<>'reviewing'
   OR d.target_complex_id<>target.id
   OR p_expected_raw_count<>d.observed_raw_count
   OR p_expected_raw_count<>c.raw_trade_count THEN
   RAISE EXCEPTION 'Identity review is not staged or its source snapshot changed';
 END IF;
 IF c.same_lot_kapt_count>1 OR c.classification IN (
  'multiple_kapt_same_lot','year_check_failed') THEN
   RAISE EXCEPTION 'Shared parcel or construction-year conflict requires separate building-level review';
 END IF;
 IF target.region_code<>c.region_code OR target.legal_dong IS DISTINCT FROM c.legal_dong THEN
   RAISE EXCEPTION 'Target region/legal dong differs from original transaction identity';
 END IF;
 IF d.target_snapshot->>'name' IS DISTINCT FROM target.name
   OR d.target_snapshot->>'address' IS DISTINCT FROM target.address
   OR d.target_snapshot->>'useDate' IS DISTINCT FROM target.use_date::text THEN
   RAISE EXCEPTION 'Target apartment details changed after stage; recheck sources';
 END IF;
 v_target_lot:=substring(btrim(split_part(coalesce(target.address,''),target.legal_dong,2))
       FROM '^([0-9]+(?:-[0-9]+)?)(?:[[:space:]]|$)');
 -- A known conflicting cadastral lot is NEVER overridden solely on
 -- pasted evidence. Official historical-parcel reconciliation is separate.
 IF v_target_lot IS NOT NULL AND v_target_lot<>c.jibun THEN
   RAISE EXCEPTION 'Target has a different recorded parcel. Manual parcel correction is required first';
 END IF;
 IF c.build_year IS NOT NULL AND target.use_date IS NOT NULL
   AND abs(c.build_year-extract(year from target.use_date)::integer)>2 THEN
   RAISE EXCEPTION 'Source and target construction years conflict';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.apt_verified_source_aliases a
  WHERE a.candidate_key=c.candidate_key
 ) THEN RAISE EXCEPTION 'An approved mapping already exists'; END IF;

 -- Acquire locks on all currently unlinked source records and reject any
 -- stale count or previously audited record before making a single change.
 FOR v_trade IN
  SELECT t.id FROM public.apt_trades t
  WHERE t.complex_id IS NULL AND t.region_code=c.region_code
   AND t.legal_dong=c.legal_dong AND t.jibun=c.jibun
   AND t.source_apartment_name=c.source_apartment_name
   AND t.build_year IS NOT DISTINCT FROM c.build_year
  FOR UPDATE
 LOOP
   v_current_count:=v_current_count+1;
   IF EXISTS (SELECT 1 FROM public.apt_trade_match_repair_audit a
              WHERE a.trade_id=v_trade.id) THEN
     RAISE EXCEPTION 'A trade has an earlier recovery audit record';
   END IF;
 END LOOP;
 IF v_current_count<>p_expected_raw_count OR v_current_count<1 THEN
   RAISE EXCEPTION 'New or changed source records detected; stage a fresh report';
 END IF;

 INSERT INTO public.apt_verified_source_aliases(
  candidate_key,region_code,legal_dong,jibun,source_apartment_name,build_year,target_complex_id
 ) VALUES (c.candidate_key,c.region_code,c.legal_dong,c.jibun,
           c.source_apartment_name,c.build_year,target.id);

 WITH linked AS (
  UPDATE public.apt_trades t
  SET complex_id=target.id,updated_at=now()
  WHERE t.complex_id IS NULL AND t.region_code=c.region_code
   AND t.legal_dong=c.legal_dong AND t.jibun=c.jibun
   AND t.source_apartment_name=c.source_apartment_name
   AND t.build_year IS NOT DISTINCT FROM c.build_year
  RETURNING t.id
 ), audited AS (
  INSERT INTO public.apt_trade_match_repair_audit(
   trade_id,prior_complex_id,matched_complex_id,region_code,match_rule,matched_at
  )
  SELECT id,NULL,target.id,c.region_code,'operator_approved_source_identity_v2',now() FROM linked
  RETURNING trade_id
 )
 SELECT count(*)::integer INTO v_linked FROM audited;
 IF v_linked<>v_current_count THEN RAISE EXCEPTION 'Audit count mismatch; rolling back'; END IF;

 UPDATE public.apt_identity_review_decisions
 SET decision_status='approved',approved_count=v_linked,
     approved_at=now(),updated_at=now()
 WHERE candidate_key=c.candidate_key;
 UPDATE public.apt_unmatched_source_candidates
 SET review_status='verified',is_active=false,updated_at=now()
 WHERE candidate_key=c.candidate_key;
 UPDATE public.apt_complexes
 SET match_status='matched',updated_at=now() WHERE id=target.id;

 -- All of these writes live in THIS transaction. Any SQL error reverts the
 -- alias, trade assignments, audit and aggregates together.
 v_result:=public.rebuild_verified_apartment_snapshot(target.id,v_date);
 PERFORM public.refresh_apartment_unmatched_candidates(c.region_code,v_date);
 RETURN jsonb_build_object(
  'approved',true,'candidateKey',c.candidate_key,
  'targetComplexId',target.id,'linkedTradeCount',v_linked,
  'snapshot',v_result,'auditSaved',true,'persistentAliasSaved',true
 );
END;
$$;
REVOKE ALL ON FUNCTION public.approve_apartment_identity_review(text,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_apartment_identity_review(text,uuid,integer)
 TO service_role;
NOTIFY pgrst,'reload schema';