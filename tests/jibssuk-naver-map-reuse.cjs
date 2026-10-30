const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

async function make(input){const api=await import("../lib/jibssuk-apartment-image-prompts.mjs");return api.buildJibssukApartmentImagePrompts(input);}

test("existing apartment region-search and Naver Static Map routes are reused",()=>{
  const panel=fs.readFileSync("app/jibssuk-queue/JibssukAutoNaverMap.tsx","utf8");
  const workflow=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  const mapApi=fs.readFileSync("app/api/apartment/map/route.ts","utf8");
  assert.match(panel,/fetch\("\/api\/apartment\/regions"/);
  assert.match(panel,/\/api\/apartment\/search\?regionCode=/);
  assert.match(panel,/\/api\/apartment\/map\?complexId=/);
  assert.match(panel,/네이버지도 자동 불러오기/);
  assert.match(panel,/단지 검색/);
  assert.match(panel,/navigator\.clipboard\.write/);
  assert.match(panel,/지도 PNG 저장/);
  assert.match(panel,/URL\.revokeObjectURL/);
  assert.match(panel,/straightDistanceMeters/);
  assert.match(mapApi,/STATIC_MAP_URL/);
  assert.match(mapApi,/GEOCODE_URL/);
  assert.match(workflow,/JibssukAutoNaverMap/);
  assert.match(workflow,/setImageAutoMapEvidence/);
  assert.match(workflow,/autoMapEvidence:imageAutoMapEvidence/);
  assert.match(workflow,/도보거리 아님/);
});

test("location prompt adapts to real existing API PNG without fake walking paths",async()=>{
  const input={
    title:"화서주공4단지 실거래",
    body:"화서주공4단지 59.98㎡ 매매 실거래를 정리합니다.",
    autoMapEvidence:"지도 출처: NAVER Cloud Static Map API\n선택 단지: 화서주공4단지\n단지-역 직선거리(도보거리 아님): 550m\n지도에는 실제 보행 경로 없음"
  };
  const generated=await make(input);
  assert.deepEqual(generated.map(x=>x.slot),["00","01","02","03"]);
  const map=generated[1];
  assert.equal(map.evidenceEntered,true);
  assert.match(map.sourceHint,/API PNG 준비됨/);
  assert.match(map.prompt,/실제 네이버지도 PNG/);
  assert.match(map.prompt,/화서주공4단지/);
  assert.match(map.prompt,/직선거리\(도보거리 아님\): 550m/);
  assert.match(map.prompt,/Static Map의 단지-역 표시·직선거리를 실제 도보 경로나 소요시간으로 표현하지 않는다/);
  assert.match(map.prompt,/PNG 파일을 먼저 첨부/);
  assert.doesNotMatch(map.prompt,/1254×1254/);
});

test("manual map capture remains fully supported when no API map is loaded",async()=>{
  const generated=await make({title:"과천 아파트",body:"입지 설명",mapEvidence:"도보 추천 8분 캡처 날짜 2026-10-30"});
  const map=generated[1];
  assert.equal(map.evidenceEntered,true);
  assert.match(map.prompt,/반드시 사용자가 따로 첨부한/);
  assert.match(map.prompt,/도보 추천 8분/);
  assert.doesNotMatch(map.prompt,/기존 지도 API 자동 조회 결과/);
  const missing=(await make({title:"과천 아파트",body:"입지 설명"}))[1];
  assert.equal(missing.evidenceEntered,false);
  assert.match(missing.sourceHint,/지도 API를 먼저 불러오거나/);
  assert.match(missing.prompt,/제공된 지도 원본·경로 메모 없음/);
});

test("API map metadata and additional walking route screenshot coexist without overwriting user notes",async()=>{
  const result=await make({
    title:"집값쓱",body:"전철 접근성",
    autoMapEvidence:"선택 단지: 테스트단지\n검색 역: 샘플역",
    mapEvidence:"수동 길찾기 캡처: 실제 도보 추천 경로 별도 첨부"
  });
  const map=result[1];
  assert.match(map.prompt,/기존 지도 API 자동 조회 결과/);
  assert.match(map.prompt,/사용자가 입력한 지도 보충 메모/);
  assert.match(map.prompt,/테스트단지/);
  assert.match(map.prompt,/실제 도보 추천 경로/);
});

test("the updated workflow preserves the existing article and all four default image prompts",()=>{
  const source=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  assert.match(source,/imageBriefs\.map/);
  assert.match(source,/JibssukAutoNaverMap/);
  assert.match(source,/imageMapEvidence/);
  assert.match(source,/imagePriceEvidence/);
  assert.match(source,/imageLifestyleEvidence/);
  assert.match(source,/네이버 전체 서식 복사 \(제목 포함\)/);
  assert.match(source,/version:1,topic:item.title/);
  assert.match(source,/onClear=\{\(\)=>setImageAutoMapEvidence\(""\)\}/);
});


test("a newer unlisted development can show a Naver Static Map by an explicitly supplied exact address",()=>{
  const screen=fs.readFileSync("app/jibssuk-queue/JibssukAutoNaverMap.tsx","utf8");
  const endpoint=fs.readFileSync("app/api/apartment/map/route.ts","utf8");
  const workflow=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  assert.match(screen,/manualAddress/);
  assert.match(screen,/setManualExpanded\(true\)/);
  assert.match(screen,/단지가 검색되지 않나요\? 현장 주소로 지도 찾기/);
  assert.match(screen,/\/api\/apartment\/map\?address=/);
  assert.match(screen,/해당 주소 지도 보기/);
  assert.match(screen,/네이버지도 원본 검색 열기/);
  assert.match(screen,/선택한 주소로 네이버지도 준비 완료|입력한 주소로 네이버지도 준비 완료/);
  assert.match(screen,/!\/\[0-9\]\/\.test\(address\)/);
  assert.match(endpoint,/const manualAddress = req\.nextUrl\.searchParams\.get\("address"\)/);
  assert.match(endpoint,/if \(!complexId && !manualAddress\)/);
  assert.match(endpoint,/queries = \[manualAddress\]/);
  assert.match(endpoint,/X-Map-Location-Mode/);
  assert.match(endpoint,/manualAddress \? "address" : "complex"/);
  assert.match(endpoint,/mapUrl\.searchParams\.set\("format", "png"\)/);
  assert.match(screen,/navigator\.clipboard\.write/);
  assert.match(screen,/지도 PNG 저장/);
  assert.match(workflow,/단지 DB 미등록 · 직접 입력 주소 기반 지도/);
  assert.match(workflow,/map\.mapAddress/);
});

test("fallback does not replace the existing DB-linked map or invent walking distances",()=>{
  const endpoint=fs.readFileSync("app/api/apartment/map/route.ts","utf8");
  const screen=fs.readFileSync("app/jibssuk-queue/JibssukAutoNaverMap.tsx","utf8");
  assert.match(endpoint,/\.from\("apt_complexes"\)/);
  assert.match(endpoint,/\.from\("apt_trades"\)/);
  assert.match(endpoint,/\.eq\("cancelled", false\)/);
  assert.match(screen,/\/api\/apartment\/map\?complexId=/);
  assert.match(screen,/도보 경로는 포함되지 않습니다/);
  assert.match(screen,/직접 입력한 주소 기반\(해당 단지 여부 확인 필요\)/);
  assert.match(screen,/실제 도보 경로/);
});
