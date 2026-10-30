const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=(file)=>fs.readFileSync(file,"utf8");

test("visual photo endpoint searches NAVER API HUB image result without exposing secrets",()=>{
  const api=source("app/api/apartment/visual-photos/route.ts");
  assert.match(api,/naverapihub\.apigw\.ntruss\.com\/search\/v1\/image/);
  assert.match(api,/process\.env\.NAVER_API_HUB_CLIENT_ID/);
  assert.match(api,/process\.env\.NAVER_API_HUB_CLIENT_SECRET/);
  assert.match(api,/X-NCP-APIGW-API-KEY-ID/);
  assert.match(api,/X-NCP-APIGW-API-KEY/);
  assert.match(api,/네이버 이미지 검색 API/);
  assert.match(api,/name\+" 아파트 공식 조감도"/);
  assert.match(api,/name\+" 주변 생활환경 사진"/);
  assert.match(api,/MAX_RESULTS=16/);
  assert.match(api,/Cache-Control":"no-store"/);
  assert.match(api,/sourceState:"unverified"/);
  assert.match(api,/원본 페이지·사용 허락을 확인/);
  assert.match(api,/safeHttpUrl\(item\.link\)/);
});

test("photo finder displays candidate previews, original links and source verification warning",()=>{
  const ui=source("app/jibssuk-queue/JibssukPropertyPhotos.tsx");
  assert.match(ui,/visual-photos\?q=/);
  assert.match(ui,/조감도/);
  assert.match(ui,/실제 외관·생활환경/);
  assert.match(ui,/사진 후보 자동 찾기/);
  assert.match(ui,/images\.map/);
  assert.match(ui,/thumbnailUrl/);
  assert.match(ui,/candidate\.imageUrl/);
  assert.match(ui,/원본 열기/);
  assert.match(ui,/03번 자료로 선택/);
  assert.match(ui,/sourceState:"unverified"/);
  assert.match(ui,/공식 조감도나 실제 단지 사진이라는 뜻은 아닙니다/);
  assert.match(ui,/공식 자료·촬영 시점·저작권 및 재사용 허락 여부/);
  assert.match(ui,/대방건설 공식 단지 페이지 열기/);
  assert.match(ui,/compSeq=155/);
});

test("selected candidate is unverified evidence and files are never auto-attached to ChatGPT",()=>{
  const ui=source("app/jibssuk-queue/JibssukPropertyPhotos.tsx");
  const workflow=source("app/jibssuk-queue/JibssukArticleWorkflow.tsx");
  assert.match(ui,/검색 후보 · 공식 여부\/단지 동일성 미확인/);
  assert.match(ui,/이미지 원본 링크:/);
  assert.match(ui,/원본 이미지가 ChatGPT에 자동 첨부되지는 않음/);
  assert.match(ui,/onSourceChange\(/);
  assert.match(workflow,/import JibssukPropertyPhotos/);
  assert.match(workflow,/initialName=\{imageComplexName\}/);
  assert.match(workflow,/onSourceChange=\{setImagePhotoEvidence\}/);
  assert.match(workflow,/lifestyleEvidence:\[imagePhotoEvidence,imageLifestyleEvidence\]/);
  assert.match(workflow,/setImagePhotoEvidence\(text\(data\.imagePhotoEvidence,4000\)\)/);
  assert.match(workflow,/imageMapEvidence,imagePriceEvidence,imageLifestyleEvidence,imagePhotoEvidence,imageExtraEvidence/);
  assert.match(workflow,/setImageComplexName\(map\.complexName\)/);
});

test("user-supplied original is turned into exactly 1600x900 PNG with contain or cover and clipboard fallback",()=>{
  const ui=source("app/jibssuk-queue/JibssukPropertyPhotos.tsx");
  assert.match(ui,/canvas\.width=1600;canvas\.height=900/);
  assert.match(ui,/canvas\.toBlob/);
  assert.match(ui,/Math\.min:Math\.max/);
  assert.match(ui,/image\/png","image\/jpeg","image\/webp/);
  assert.match(ui,/20\*1024\*1024/);
  assert.match(ui,/이미지 파일 자체는 ChatGPT에 자동 첨부되지 않음/);
  assert.match(ui,/1600×900 PNG 복사/);
  assert.match(ui,/1600×900 PNG 저장/);
  assert.match(ui,/navigator\.clipboard\.write/);
  assert.match(ui,/Ctrl\+V/);
  assert.match(ui,/jibssuk-03-property-photo-1600x900\.png/);
});

test("photo search stays scoped to 03 image, preserving map, charts, thumbnail and optional 04",()=>{
  const workflow=source("app/jibssuk-queue/JibssukArticleWorkflow.tsx");
  assert.match(workflow,/JibssukAutoNaverMap/);
  assert.match(workflow,/JibssukPropertyPhotos/);
  assert.match(workflow,/imageBriefs\.map/);
  assert.match(workflow,/imagePriceEvidence/);
  assert.match(workflow,/imageExtraEnabled/);
  assert.match(workflow,/네이버 전체 서식 복사 \(제목 포함\)/);
  assert.match(workflow,/1600×900 \(16:9\)/);
  assert.doesNotMatch(workflow,/1254×1254/);
});
