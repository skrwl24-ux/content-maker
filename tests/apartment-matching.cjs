const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const modulePromise = import("../lib/apartment-trade-matching.mjs");
const complex = (name, lot, id = name, options = {}) => ({
  id, name, normalized_name: name,
  region_code: "41285", legal_dong: "장항동",
  address: "경기도 고양시 일산동구 장항동 " + lot + " " + name,
  use_date: "1994-10-01", ...options,
});
const trade = (name, jibun, options = {}) => ({
  name, regionCode:"41285", legalDong:"장항동", jibun,
  buildYear:1994, ...options,
});

test("lot parser requires an explicit address lot directly after legal dong", async () => {
  const mod=await modulePromise;
  assert.equal(mod.extractApartmentLot("경기도 고양시 일산동구 장항동 881 장항호수마을2단지현대","장항동"),"881");
  assert.equal(mod.extractApartmentLot("경기도 고양시 장항동 산 12-3 현대아파트","장항동"),"산12-3");
  assert.equal(mod.normalizeCadastralLot(" 0881 "),"881");
  assert.equal(mod.extractApartmentLot("경기도 고양시 장항동 현대아파트","장항동"),null);
  assert.equal(mod.extractApartmentLot("경기도 고양시 장항동 1576- 현대아파트","장항동"),null);
});

test("MOLIT 호수마을(현대) matches K-apt 장항호수마을2단지현대 by unique lot 881", async () => {
  const mod=await modulePromise;
  const complexes=[
    complex("장항호수마을2단지현대","881","correct"),
    complex("호수마을1단지대우","902","other"),
  ];
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881"),complexes)?.id,"correct");
  assert.equal(mod.matchApartmentTrade(trade("호수마을(대우)","902",{buildYear:1996}),[
    {...complexes[1], use_date:"1996-02-01"}
  ])?.id,"other");
});

test("different known lots and build years never get linked by matching names", async () => {
  const mod=await modulePromise;
  const c=complex("호수마을현대","881","correct");
  assert.equal(mod.matchApartmentTrade(trade("호수마을현대","902"),[c]),null);
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881",{buildYear:2006}),[c]),null);
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881",{legalDong:"마두동"}),[c]),null);
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881",{regionCode:"41281"}),[c]),null);
});

test("shared-lot subdivisions remain unmatched unless one name exactly disambiguates", async () => {
  const mod=await modulePromise;
  const c=[complex("1단지현대","881","one"),complex("2단지현대","881","two")];
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881"),c),null);
  assert.equal(mod.matchApartmentTrade(trade("2단지현대","881"),c)?.id,"two");
});

test("name fallback works when no reliable parcel, but never overrides conflicting recorded parcel", async () => {
  const mod=await modulePromise;
  const c=complex("백두마을동성","", "lot-unknown", {address:"경기도 군포시 산본동 백두마을동성",region_code:"41410",legal_dong:"산본동"});
  assert.equal(mod.matchApartmentTrade(trade("백두마을동성","1087",{regionCode:"41410",legalDong:"산본동",buildYear:1995}),[c])?.id,"lot-unknown");
  const known={...c,address:"경기도 군포시 산본동 1090 백두마을동성"};
  assert.equal(mod.matchApartmentTrade(trade("백두마을동성","1087",{regionCode:"41410",legalDong:"산본동",buildYear:1995}),[known]),null);
  assert.equal(mod.matchApartmentTrade(trade("백두마을동성",null,{regionCode:"41410",legalDong:"산본동",buildYear:1995}),[known])?.id,"lot-unknown");
});

test("selected real complex never inherits sample apartment prices when trades cannot be linked", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  const page=fs.readFileSync("app/apartment-bulk/page.tsx","utf8");
  assert.match(server,/matchApartmentTrade\(/);
  assert.doesNotMatch(server,/matchComplex\(aptName/);
  assert.match(page,/selectedComplexNeedsMatching/);
  assert.match(page,/실거래 원본 매칭 대기/);
  assert.doesNotMatch(page,/recent \? formatWon\(recent\) : SAMPLE\.recentPrice/);
  assert.doesNotMatch(page,/representativeArea \? "전용 " \+ detail\.representativeArea : SAMPLE\.area/);
});


test("representative snapshot and most recent deal share the same area and six-point window", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  const detail=fs.readFileSync("app/api/apartment/complexes/[id]/route.ts","utf8");
  assert.match(server,/new Set\(monthLabels\(7\)\)/);
  assert.match(server,/const validMonthly = repMonthly\.filter\(\(r\) => r\.median_price != null\)\.slice\(-6\)/);
  assert.match(detail,/\.gte\("year_month", startMonth\)/);
  assert.match(detail,/\.eq\("area_group", areaGroup\)/);
  assert.match(detail,/areaGroup == null\s*\?\s*\{ data: null, error: null \}/);
});


test("regional sync reconciles unsupported month/area stats after successful upserts", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  const migration=fs.readFileSync("supabase/migrations/20261002_cleanup_apartment_monthly_stats.sql","utf8");
  const upsert=server.indexOf('await upsertInChunks(client, "apt_monthly_stats"');
  const cleanup=server.indexOf('"cleanup_apartment_monthly_stats"');
  const snapshots=server.indexOf('const analysisDate = currentAnalysisDate();');
  assert.ok(upsert>0 && cleanup>upsert && snapshots>cleanup);
  assert.match(server,/p_region_code: regionCode, p_months: monthLabels\(7\)/);
  assert.match(server,/if \(cleanupError\) throw cleanupError/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.cleanup_apartment_monthly_stats\(text, text\[\]\) TO service_role/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.cleanup_apartment_monthly_stats\(text, text\[\]\) FROM anon, authenticated/);
  assert.match(migration,/NOT EXISTS \(/);
});


test("missing K-apt details never erase a previously known address, households or move-in date", async () => {
  const { mergeKaptApartmentDetail }=await import("../lib/apartment-detail-merge.mjs");
  const old={
    name:"장항호수마을2단지현대",
    address:"경기도 고양시 일산동구 장항동 881 장항호수마을2단지현대",
    road_address:"경기도 고양시 일산동구 노루목로 100",
    households:1144, use_date:"1994-10-29", bjd_code:"4128510400",legal_dong:"장항동",
  };
  const result=mergeKaptApartmentDetail({kaptName:"장항호수마을2단지현대",as3:"장항동"},null,old);
  assert.equal(result.address,old.address);
  assert.equal(result.road_address,old.road_address);
  assert.equal(result.households,1144);
  assert.equal(result.use_date,"1994-10-29");
  assert.equal(result.detailsReceived,false);
  const partial=mergeKaptApartmentDetail(
    {kaptName:"장항호수마을2단지현대",as3:"장항동"},
    {kaptName:"장항호수마을2단지현대",hoCnt:"1,200",kaptAddr:""},
    old,
  );
  assert.equal(partial.households,1200);
  assert.equal(partial.address,old.address);
  assert.equal(partial.use_date,old.use_date);
});

test("unknown household counts and invalid K-apt dates remain null, never fake 0", async () => {
  const { mergeKaptApartmentDetail }=await import("../lib/apartment-detail-merge.mjs");
  const row={kaptName:"군포율곡",as3:"금정동"};
  const missing=mergeKaptApartmentDetail(row,null,null);
  assert.equal(missing.households,null);
  assert.equal(missing.address,null);
  assert.equal(missing.use_date,null);
  const bad=mergeKaptApartmentDetail(row,{hoCnt:"0",kaptUsedate:"20261340"},null);
  assert.equal(bad.households,null);
  assert.equal(bad.use_date,null);
  const fallback=mergeKaptApartmentDetail(
    {...row,kaptAddr:"경기도 군포시 금정동 876 군포율곡",hoCnt:"1,000",kaptUsedate:"19940430"},null,null,
  );
  assert.equal(fallback.households,1000);
  assert.equal(fallback.use_date,"1994-04-30");
  assert.match(fallback.address,/금정동 876/);
});

test("regional K-apt sync retains past detail data and tracks missing upstream responses", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  assert.match(server,/mergeKaptApartmentDetail/);
  assert.match(server,/const existingByCode = new Map/);
  assert.ok(server.indexOf('select("kapt_code,name,legal_dong,bjd_code,address,road_address,households,use_date")') <
            server.indexOf('await upsertInChunks(client, "apt_complexes"'));
  assert.match(server,/if \(!raw\) return null;/);
  assert.match(server,/kapt_detail_missing_count: kaptDetailEmpty/);
  assert.match(server,/kapt_address_missing_count: kaptAddressMissing/);
});


test("MOLIT-only source candidates never flow into publishable complex IDs", () => {
  const migration=fs.readFileSync(
    "supabase/migrations/20261002_unmatched_molit_candidates.sql","utf8"
  );
  const sync=fs.readFileSync("lib/apartment-server.ts","utf8");
  const api=fs.readFileSync("app/api/apartment/unmatched-candidates/route.ts","utf8");
  const ui=fs.readFileSync("app/apartment-bulk/unmatched/page.tsx","utf8");
  const main=fs.readFileSync("app/apartment-bulk/page.tsx","utf8");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.apt_unmatched_source_candidates/);
  assert.match(migration,/WHERE t\.region_code=p_region_code AND t\.complex_id IS NULL/);
  assert.match(migration,/md5\(jsonb_build_array\(/);
  assert.match(migration,/review_status text NOT NULL DEFAULT 'needs_review'/);
  assert.match(migration,/ON CONFLICT\(candidate_key\) DO UPDATE SET/);
  assert.match(migration,/is_active=false/);
  assert.match(migration,/TO service_role/);
  assert.match(migration,/GRANT SELECT ON public\.apt_unmatched_source_candidates TO anon, authenticated/);
  assert.doesNotMatch(migration,/UPDATE public\.apt_trades/);
  assert.doesNotMatch(migration,/INSERT INTO public\.apt_complexes/);
  assert.match(sync,/"refresh_apartment_unmatched_candidates"/);
  assert.ok(sync.indexOf('"refresh_apartment_unmatched_candidates"') >
            sync.indexOf('await upsertInChunks(client, "apt_candidate_snapshots"'));
  assert.match(api, /\.eq\("is_active", true\)/);
  assert.match(api, /createApartmentReadClient/);
  assert.doesNotMatch(api, /createApartmentAdminClient/);
  assert.match(ui, /검증 요청서 복사/);
  assert.match(ui, /자동 연결·발행 기능은 없습니다/);
  assert.match(main, /href="\/apartment-bulk\/unmatched"/);
});


test("V2 review keeps source reports private and requires two deliberate phases", () => {
  const tables=fs.readFileSync("supabase/migrations/20261002_identity_review_v2_tables.sql","utf8");
  const snapshots=fs.readFileSync("supabase/migrations/20261002_identity_review_v2_snapshot.sql","utf8");
  const approval=fs.readFileSync("supabase/migrations/20261002_identity_review_v2_approval.sql","utf8");
  const api=fs.readFileSync("app/api/apartment/unmatched-candidates/review/route.ts","utf8");
  const targets=fs.readFileSync("app/api/apartment/unmatched-candidates/targets/route.ts","utf8");
  const page=fs.readFileSync("app/apartment-bulk/unmatched/page.tsx","utf8");
  const sync=fs.readFileSync("lib/apartment-server.ts","utf8");

  assert.match(tables,/CREATE TABLE IF NOT EXISTS public\.apt_identity_review_decisions/);
  assert.match(tables,/CREATE TABLE IF NOT EXISTS public\.apt_verified_source_aliases/);
  assert.match(tables,/BEFORE INSERT OR UPDATE OF complex_id,region_code,legal_dong,jibun,source_apartment_name,build_year/);
  assert.match(tables,/NEW\.complex_id:=v_target/);
  assert.match(tables,/REVOKE ALL ON public\.apt_identity_review_decisions FROM PUBLIC, anon, authenticated/);
  assert.match(snapshots,/CREATE OR REPLACE FUNCTION public\.rebuild_verified_apartment_snapshot/);
  assert.match(snapshots,/representative_area_group/);
  assert.match(snapshots,/ON CONFLICT\(analysis_date,complex_id\) DO UPDATE SET/);
  assert.match(approval,/CREATE OR REPLACE FUNCTION public\.stage_apartment_identity_review/);
  assert.match(approval,/CREATE OR REPLACE FUNCTION public\.approve_apartment_identity_review/);
  const stage=approval.slice(approval.indexOf("CREATE OR REPLACE FUNCTION public.stage_apartment_identity_review"),
    approval.indexOf("CREATE OR REPLACE FUNCTION public.approve_apartment_identity_review"));
  assert.doesNotMatch(stage,/UPDATE public\.apt_trades/);
  assert.match(approval,/IF c\.same_lot_kapt_count>1/);
  assert.match(approval,/FOR UPDATE/);
  assert.match(approval,/IF v_linked<>v_current_count THEN RAISE EXCEPTION/);
  assert.match(approval,/PERFORM public\.refresh_apartment_unmatched_candidates/);
  assert.match(approval,/public\.rebuild_verified_apartment_snapshot/);
  assert.match(api,/timingSafeEqual/);
  assert.match(api,/APARTMENT_REVIEW_SECRET \|\| process\.env\.APARTMENT_SYNC_SECRET/);
  assert.match(api,/stage_apartment_identity_review/);
  assert.match(api,/approve_apartment_identity_review/);
  assert.match(api,/confirmedSourceName\.trim\(\)/);
  assert.match(api,/new Set\(authorities\)\.size<2/);
  assert.doesNotMatch(api,/CRON_SECRET/);
  assert.match(targets,/createApartmentReadClient/);
  assert.match(targets,/\.eq\("region_code",c\.region_code\)\.eq\("legal_dong",c\.legal_dong\)/);
  assert.match(page,/검증 결과 붙여넣기·승인/);
  assert.match(page,/관리자 최종 승인 · 실거래 재연결/);
  assert.match(page,/type="password" value=\{adminSecret\}/);
  assert.doesNotMatch(page,/localStorage\.setItem\([^)]*adminSecret/);
  const approvedLookup=sync.indexOf('.from("apt_verified_source_aliases")');
  const upsert=sync.indexOf('await upsertInChunks(client, "apt_trades"');
  const aggregation=sync.indexOf("const activeTrades = normalized.filter");
  assert.ok(approvedLookup>0 && upsert>approvedLookup && aggregation>upsert);
  assert.match(sync,/if \(row\.complex_id && row\.complex_id !== approved\)/);
});


test("approved source record drift is blocked before any monthly/snapshot overwrite", () => {
 const guard=fs.readFileSync(
  "supabase/migrations/20261002_identity_review_v2_upstream_guard.sql","utf8"
 );
 assert.match(guard,/v_old_key<>v_key AND EXISTS/);
 assert.match(guard,/Manual review is required/);
 assert.match(guard,/Automatic apartment matching conflicts with approved source alias/);
});

test("Gunpo shared parcel 875 never combines 351~359 and 360~368 K-apt complexes", async () => {
  const mod=await modulePromise;
  const first={id:"first",kapt_code:"A43575803",name:"산본주공퇴계1차아파트",
    normalized_name:"산본주공퇴계1차",region_code:"41410",legal_dong:"금정동",
    address:null,use_date:null};
  const second={id:"second",kapt_code:"A43582405",name:"금정퇴계2차",
    normalized_name:"금정퇴계2차",region_code:"41410",legal_dong:"금정동",
    address:"경기도 군포시 금정동 875 금정퇴계2차",use_date:"1995-04-22"};
  const input=(name,buildingDong,exclusiveArea,buildYear)=>({
    name,regionCode:"41410",legalDong:"금정동",jibun:"875",
    buildingDong,exclusiveArea,buildYear,
  });
  const one="퇴계주공(351~359동)",two="퇴계주공(360~368동)";
  assert.equal(mod.matchApartmentTrade(input(one,"351",42.75,1993),[first,second])?.id,"first");
  assert.equal(mod.matchApartmentTrade(input(one,null,41.85,1993),[first,second])?.id,"first");
  assert.equal(mod.matchApartmentTrade(input(two,"368",37.67,1995),[first,second])?.id,"second");
  assert.equal(mod.matchApartmentTrade(input(two,null,39.87,1995),[first,second])?.id,"second");
  assert.equal(mod.matchApartmentTrade(input(one,"351",42.75,1993),[second]),null);
  assert.equal(mod.matchApartmentTrade(input(two,"361",39.87,1995),[first]),null);
  assert.equal(mod.matchApartmentTrade(input(one,"365",42.75,1993),[first,second]),null);
  assert.equal(mod.matchApartmentTrade(input(two,"355",39.87,1995),[first,second]),null);
  assert.equal(mod.matchApartmentTrade(input(one,"351",39.87,1993),[first,second]),null);
  assert.equal(mod.matchApartmentTrade(input(two,"360",42.75,1995),[first,second]),null);
  assert.equal(mod.matchApartmentTrade(input(one,"351",42.75,1995),[first,second]),null);
  assert.equal(mod.matchApartmentTrade(input("퇴계주공",null,42.75,1993),[first,second]),null);
});
test("raw MOLIT building number and area must reach the source identity matcher", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  assert.match(server,/buildingDong: text\(item\.aptDong\) \|\| null, exclusiveArea: area/);
});
