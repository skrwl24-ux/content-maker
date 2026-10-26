const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const {NextRequest} = require('next/server');
const keys = ['name','address','area','route','sale','listing','rent','monthly','caution','sources','notes'];
function load(env, fetch) {
 const module = {exports:{}};
 const source = ts.transpileModule(fs.readFileSync('app/api/apartment/workplace-evidence/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require,process:{env},fetch,AbortSignal,console});
 return module.exports.POST;
}
const request = body => new NextRequest('http://localhost/api/apartment/workplace-evidence',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
const body = {images:[{url:'data:image/jpeg;base64,YQ==',label:'capture.png · 구간 1'}],name:'테스트단지',place:'근무지',date:'2026-10-26'};
test('missing and malformed evidence rejected before AI call',async()=>{
 const post=load({},()=>{throw Error('must not call');});
 for(const b of [{images:[]},{images:[{url:'https://example.com/a.jpg',label:'external'}]},{images:Array(13).fill(body.images[0])},{images:[{url:body.images[0].url,label:4}]}]) assert.equal((await post(request(b))).status,400);
});
test('missing AI configuration is explicit and not a fabricated result',async()=>{
 const response=await load({},()=>{throw Error('must not call');})(request(body));
 assert.equal(response.status,503); assert.match((await response.json()).error,/AI 키/);
});
test('vision request includes supplied image, provenance, no storage; extraction returned separately',async()=>{
 const values=Object.fromEntries(keys.map(k=>[k,k==='sale'?'확인 필요(needs_check)':'']));
 const post=load({OPENAI_API_KEY:'test-only'},async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const sent=JSON.parse(options.body);
  assert.equal(sent.store,false);
  assert.equal(sent.input[0].content[2].image_url,body.images[0].url);
  assert.match(sent.input[0].content[1].text,/capture.png/);
  assert.match(sent.instructions,/계약연도/);
  return {ok:true,json:async()=>({output:[{content:[{text:JSON.stringify(values)}]}]})};
 });
 const response=await post(request(body));assert.equal(response.status,200);
 assert.deepEqual((await response.json()).values,values);
});
test('provider failure and malformed output never pass as analysis',async()=>{
 let post=load({OPENAI_API_KEY:'test-only'},async()=>({ok:false,status:429}));
 assert.equal((await post(request(body))).status,502);
 post=load({OPENAI_API_KEY:'test-only'},async()=>({ok:true,json:async()=>({output_text:'{"name":"단지"}'})}));
 assert.equal((await post(request(body))).status,502);
});
