const test=require("node:test");
const assert=require("node:assert/strict");
async function studio(){return import("../lib/apartment-photo-story-v4.mjs");}
const data={
 name:"검증용 단지",region:"경기도 군포시",area:"84㎡",recentPrice:"7억",previousPrice:"6억",households:"1,000",moveIn:"2002",
 station:"산본역",locationLine:"교통 접근성은 별도 확인",
 monthly:[
  {month:"2026-05",medianPrice:610000000,tradeCount:3},
  {month:"2026-06",medianPrice:640000000,tradeCount:5},
  {month:"2026-07",medianPrice:null,tradeCount:0},
  {month:"2026-08",medianPrice:660000000,tradeCount:2},
  {month:"2026-09",medianPrice:690000000,tradeCount:1},
 ],
};

test("V4 photo & data scenes use six, seven or eight single-image slots",async()=>{
 const {apartmentV4Scenes,apartmentV4Count}=await studio();
 assert.deepEqual(apartmentV4Scenes(6).map(x=>x.slot),["00","01","02","03","04","05"]);
 assert.deepEqual(apartmentV4Scenes(7).map(x=>x.slot),["00","01","02","03","04","05","06"]);
 assert.deepEqual(apartmentV4Scenes(8).map(x=>x.slot),["00","01","02","03","04","05","06","07"]);
 assert.equal(apartmentV4Count(0),7);
 assert.equal(apartmentV4Scenes(7)[1].type,"photo");
 assert.equal(apartmentV4Scenes(7)[2].type,"data");
});

test("V4 article prompt uses ONLY original monthly numbers and explicit rights constraints",async()=>{
 const {buildApartmentV4ArticlePrompt}=await studio();
 const prompt=buildApartmentV4ArticlePrompt(data,7);
 assert.match(prompt,/610000000원/);
 assert.match(prompt,/계약일과 층이/);
 assert.match(prompt,/실제 단지 사진을 이미 확보한 것처럼 말하지 않는다/);
 assert.match(prompt,/사진마다 한 가지/);
 assert.match(prompt,/\[이미지 NN\]/);
 assert.match(prompt,/이미지 06/);
 assert.doesNotMatch(prompt,/이미지 07:/);
});

test("unmatched apartment and empty monthly series must not claim a verified price chart",async()=>{
 const {apartmentV4Snapshot,buildApartmentV4ArticlePrompt}=await studio();
 const snap=apartmentV4Snapshot({...data,matchingPending:true});
 assert.equal(snap.verifiedSeries,false);
 assert.match(buildApartmentV4ArticlePrompt({...data,matchingPending:true}),/가격 증감·거래량 숫자나 그래프를 단정하지 말 것/);
 assert.equal(apartmentV4Snapshot({...data,monthly:[]}).verifiedSeries,false);
});

test("V4 editor sees placement markers before planning memo and detects duplicates/order",async()=>{
 const {apartmentV4ArticleOnly,apartmentV4Audit}=await studio();
 const article="# 검증용 제목\n"+["01","02","03","04","05","06"].map(id=>"내용 문단\n[이미지 "+id+"]").join("\n")+"\n[이미지 기획 메모]\n[이미지 07]\n검수";
 assert.deepEqual(apartmentV4Audit(article,7).missing,[]);
 assert.deepEqual(apartmentV4Audit(article,8).missing,["07"]);
 assert.ok(!apartmentV4ArticleOnly(article).includes("이미지 07"));
 const bad="# 검증용 제목\n"+"충분한 설명 ".repeat(14)+"\n[이미지 02]\n[이미지 01]\n[이미지 02]\n[이미지 09]";
 const a=apartmentV4Audit(bad,6);
 assert.deepEqual(a.repeated,["02"]);
 assert.equal(a.outOfOrder,true);
});

test("single scene V4 prompts keep scale, area and verified-source warnings",async()=>{
 const {buildApartmentV4ImagePrompt}=await studio();
 const p=buildApartmentV4ImagePrompt({...data,matchingPending:true},"03",7,"단지 가격은 추가 확인이 필요합니다.");
 assert.match(p,/1600×900/);
 assert.match(p,/실거래 연결 미확인/);
 assert.match(p,/가격·날짜·층수 수치 임의 생성 금지/);
 assert.match(buildApartmentV4ImagePrompt(data,"00",7),/1254×1254/);
 assert.equal(buildApartmentV4ImagePrompt(data,"07",6),"");
});
