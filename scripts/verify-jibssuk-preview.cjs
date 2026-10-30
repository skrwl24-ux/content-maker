/* Optional browser regression: requires Playwright + Chromium outside app dependencies.
 * PREVIEW_BASE_URL must be a local server or the approved Vercel preview.
 * Uses a fresh context and synthetic localStorage only; no cloud records are written.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:3003');
if (!['localhost','127.0.0.1'].includes(base.hostname) &&
    (!base.hostname.endsWith('.vercel.app') || base.hostname === 'content-maker-chi.vercel.app')) {
  throw new Error('Use the approved preview or a local development server; production is excluded.');
}
const local = ['localhost','127.0.0.1'].includes(base.hostname);
const key = 'content-maker-jibssuk-inline-workflow-v1:browser-regression';
const queueKey = 'content-maker-jibssuk-topic-queue-v1';
const fact = (id,claim) => ({id,claim,sourceUrl:'https://example.org/'+id,publishedAt:'2026-10-29'});
const initialFacts = Array.from({length:10},(_,i)=>fact('f'+i,'독립 근거 '+String.fromCharCode(44032+i)));
const makeReport = (facts,angles) => JSON.stringify({topic:'화서주공4단지',facts,angles,gaps:['추가 원문?'],trendLinks:[]});
const originalBody = '기존 편집 원고입니다.\n\n| 계약 | 가격 |\n|---|---|\n| 첫 계약 | 5억원 |\n| 후속 계약 | 6억원 |';
const original = {
  version:1,acceptedRaw:makeReport(initialFacts,[
    {id:'a1',title:'다른 관점',readerQuestion:'다른 질문',uniqueValue:'다른 근거',factIds:['f0']},
    {id:'a2',title:'선택해 둔 관점',readerQuestion:'어떤 차이?',uniqueValue:'확인한 계약',factIds:['f1']}
  ]),angleId:'a2',articleTitle:'화서주공4단지 거래 기록',articleBody:originalBody,
  imageMapEvidence:'수동 지도 메모',imageAutoMapEvidence:'저장한 지도 API 근거',
  imagePriceEvidence:'저장한 거래 원자료',imagePhotoEvidence:'기존 사진 원본 출처',imageComplexName:'화서주공4단지'
};
async function main(){
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,
    args:['--no-sandbox'],...(!local&&process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})
  });
  try {
    const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base.origin+'/jibssuk-queue');
    if(new URL(page.url()).hostname==='vercel.com') throw new Error('Vercel preview access protection requires authorized access.');
    await page.getByRole('heading',{name:'상시 발행 목록 10개'}).waitFor();
    // Explicit test doubles: a failed startup search must not erase saved evidence.
    await page.route('**/api/apartment/regions',r=>r.fulfill({json:{regions:[]}}));
    await page.route('**/api/apartment/map-places?**',r=>r.fulfill({status:503,json:{error:'회귀 검사: 검색 실패'}}));
    await page.route('**/api/apartment/visual-photos?**',r=>r.fulfill({status:503,json:{error:'회귀 검사: 검색 실패'}}));
    await page.evaluate(({key,queueKey,original})=>{
      localStorage.setItem(queueKey,JSON.stringify({version:1,queue:[
        {title:'화서주공4단지',category:'아파트',status:'working',sourceUrl:'https://example.org',addedAt:'browser-regression'},
        {title:'별도 글감',category:'아파트',status:'waiting',sourceUrl:'https://example.org',addedAt:'separate-item'}
      ],history:[],candidates:[]}));
      localStorage.setItem(key,JSON.stringify(original));
    },{key,queueKey,original});
    await page.reload();
    const searches = Promise.all([
      page.waitForResponse(r=>r.url().includes('/map-places?')),
      page.waitForResponse(r=>r.url().includes('/visual-photos?'))
    ]);
    await page.getByRole('button',{name:/01.*화서주공4단지/}).click();
    await searches;
    await page.getByRole('button',{name:'주소 자동 찾기',exact:true}).waitFor();
    await page.getByRole('button',{name:'사진 후보 자동 찾기',exact:true}).waitFor();
    await page.getByText('추가 조사 결과 직접 붙여넣기',{exact:true}).click();
    for(let i=0;i<3;i++){
      const input=makeReport([initialFacts[0],initialFacts[1],fact('f0','새 근거 '+String.fromCharCode(45208+i))],[]);
      // Reuse of f0 in a single input is ambiguous; give the new fact a distinct incoming ID.
      const parsed=JSON.parse(input);parsed.facts[2].id='new';
      await page.getByLabel('추가 조사 결과',{exact:true}).fill('[RESEARCH_ADDENDUM_JSON]'+JSON.stringify(parsed)+'[/RESEARCH_ADDENDUM_JSON]');
      await page.getByRole('button',{name:'추가 조사 병합',exact:true}).click();
      await page.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)).researchHistory?.rounds.length===count,{key,count:i+1});
      const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
      assert.equal(saved.researchHistory.stats.added,1);assert.equal(saved.researchHistory.stats.duplicates,2);
    }
    let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.researchHistory.mergedReport.facts.length,13);
    for(const field of ['angleId','articleTitle','articleBody','imageMapEvidence','imageAutoMapEvidence','imagePriceEvidence','imagePhotoEvidence'])assert.equal(saved[field],original[field],field);
    await page.locator('#jibssuk-angle').selectOption('a1');
    await page.reload();await page.getByRole('button',{name:/01.*화서주공4단지/}).click();
    await page.locator('#jibssuk-article-body').waitFor();
    assert.equal(await page.locator('#jibssuk-article-body').inputValue(),originalBody);
    assert.equal(await page.locator('#jibssuk-angle').inputValue(),'a1');
    saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.researchHistory.mergedReport.facts.length,13);
    assert.equal(saved.imagePhotoEvidence,original.imagePhotoEvidence);
    assert.equal(await page.evaluate(queueKey=>JSON.parse(localStorage.getItem(queueKey)).queue[0].status,queueKey),'working');
    await page.getByRole('button',{name:'네이버 전체 서식 복사 (제목 포함)',exact:true}).click();
    await page.getByRole('status').filter({hasText:'서식 복사 완료'}).waitFor();
    const clipboard=await page.evaluate(async()=>{
      const items=await navigator.clipboard.read();
      for(const item of items)if(item.types.includes('text/html'))return await (await item.getType('text/html')).text();
      return '';
    });
    assert.match(clipboard,/<table/);assert.match(clipboard,/5억원/);assert.match(clipboard,/화서주공4단지/);
    console.log('PASS: research merge, saved draft/selection/notes, native rich clipboard with table');
    await page.getByText('네이버에서 표가 깨질 때 · 표 PNG 이미지 저장 (선택)',{exact:true}).click();
    const tableDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:/^표 1 PNG 저장$/}).click();
    const tablePng=await fs.readFile(await (await tableDownload).path());assert.equal(tablePng.readUInt32BE(16),1600);
    for(const slot of ['00','01','02','03'])assert.equal(await page.getByRole('button',{name:'이미지 '+slot+' 요청서 복사',exact:true}).count(),1);
    console.log('PASS: table PNG download and four image request slots');
    // A synthetic image checks the existing canvas export; no external photo is reused.
    const fixture=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.getContext('2d').fillRect(0,0,16,16);return canvas.toDataURL('image/png').split(',')[1];});
    await page.locator('#jibssuk-property-source-file').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
    const photoDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'1600×900 PNG 저장',exact:true}).click();
    const photoPng=await fs.readFile(await (await photoDownload).path());
    assert.equal(photoPng.readUInt32BE(16),1600);assert.equal(photoPng.readUInt32BE(20),900);
    await page.getByRole('button',{name:/02.*별도 글감/}).click();
    await page.getByRole('heading',{name:'1. AI 심층 조사',exact:true}).waitFor();
    assert.equal(await page.locator('#jibssuk-article-body').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: v1 migration, 10+3 facts after three duplicate merges, original draft/angle/source notes, reload, queue status, rich clipboard/table PNG, image slots/1600x900 PNG and topic isolation.');
    console.log('Map/photo startup failure paths used explicit test doubles; live remote provider access was not verified.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
