const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
async function api(){return import("../lib/topic-recommendations.mjs");}

const sample={
  checkedAt:"2026-10-28",
  candidates:[
    {title:"실제 확인된 드라마 촬영 공간",channel:"집값쓱",type:"드라마",whyNow:"10월 말 공식 발표",readerQuestion:"실제 촬영 장소인가?",extraValue:"방송 내용과 공식 장소를 비교",sourceUrl:"https://example.org/show",publishedAt:"2026-10-27"},
    {title:"최근 새로운 동물 이야기",channel:"Paramma",type:"해외 동물",whyNow:"관련 원문 확인 필요",readerQuestion:"정말 사실일까?",extraValue:"원본 이미지와 연구 비교",sourceUrl:"javascript:alert(1)",publishedAt:""},
  ]
};

test("AI recommendation prompt actively researches new facts and rejects fabricated viral claims",async()=>{
  const {buildTopicRecommendationPrompt}=await api();
  const prompt=buildTopicRecommendationPrompt({
    channel:"전체",focus:"드라마와 실제 촬영 장소",today:"2026-10-28",
    lookbackDays:7,existingTopics:["아파트 거래량 비교","수건 쉰내"],
  });
  assert.match(prompt,/실제 웹 검색/);
  assert.match(prompt,/검색 급증/);
  assert.match(prompt,/방송·예능·드라마·영화/);
  assert.match(prompt,/최근 7일/);
  assert.match(prompt,/기존 작업 주제/);
  assert.match(prompt,/아파트 거래량 비교/);
  assert.match(prompt,/사적인 거주지/);
  assert.match(prompt,/TOPIC_RECOMMENDATIONS_JSON/);
  assert.doesNotMatch(prompt,/https:\/\/example\.org\/source/);
  const monthly=buildTopicRecommendationPrompt({channel:"Paramma",lookbackDays:30});
  assert.match(monthly,/최근 30일/);
});

test("recommendation parser extracts candidates, strips unsafe source URLs, deduplicates titles",async()=>{
  const {parseTopicRecommendations}=await api();
  const input=JSON.stringify({
    ...sample,candidates:[
      ...sample.candidates,
      {...sample.candidates[0],title:" 실제 확인된 드라마 촬영 공간 "},
      {...sample.candidates[0],title:" ",channel:"Paramma"},
      {...sample.candidates[0],title:"잘못된 채널",channel:"기타"},
    ]
  });
  const parsed=parseTopicRecommendations("[TOPIC_RECOMMENDATIONS_JSON]\n"+input+"\n[/TOPIC_RECOMMENDATIONS_JSON]");
  assert.equal(parsed.checkedAt,"2026-10-28");
  assert.equal(parsed.candidates.length,2);
  assert.equal(parsed.candidates[0].sourceUrl,"https://example.org/show");
  assert.equal(parsed.candidates[1].sourceUrl,"");
  assert.equal(parsed.candidates[1].channel,"Paramma");
  assert.equal(parseTopicRecommendations("not json"),null);
  assert.equal(parseTopicRecommendations('{"checkedAt":"2026-10-28"}'),null);
  assert.equal(parseTopicRecommendations('[]'),null);
});

test("recommended topic notes retain original URL and openly label the unverified stage",async()=>{
  const {recommendationToResearchNotes,parseTopicRecommendations}=await api();
  const item=parseTopicRecommendations(JSON.stringify(sample)).candidates[0];
  const notes=recommendationToResearchNotes(item,"2026-10-28");
  assert.match(notes,/AI가 제안한 소재/);
  assert.match(notes,/https:\/\/example.org\/show/);
  assert.match(notes,/공식 발표/);
  assert.match(notes,/2026-10-27/);
  assert.match(notes,/아직 사실 검증 완료 아님/);
});

test("site connects AI recommendations to existing five-slot workspaces with replacement confirmation",()=>{
  const ui=fs.readFileSync("app/research-studio/ResearchQueue.tsx","utf8");
  const panel=fs.readFileSync("app/research-studio/TopicRecommendationsPanel.tsx","utf8");
  assert.match(ui,/TopicRecommendationsPanel/);
  assert.match(ui,/applyRecommended/);
  assert.match(ui,/recommendationToResearchNotes/);
  assert.match(ui,/window.confirm/);
  assert.match(ui,/researchSlotKey\(i\+1\)/);
  assert.match(panel,/buildTopicRecommendationPrompt/);
  assert.match(panel,/parseTopicRecommendations/);
  assert.match(panel,/선택한 .*개를 작업 목록에 넣기/);
  assert.match(panel,/selected\.length>=5/);
  assert.match(panel,/ChatGPT 열기/);
});


test("discovery directions are editable while current settings and JSON schema remain generated",async()=>{
  const {buildTopicRecommendationPrompt,DEFAULT_TOPIC_DISCOVERY_DIRECTIONS}=await api();
  assert.match(DEFAULT_TOPIC_DISCOVERY_DIRECTIONS,/눈에 띄는 변화/);
  const custom="사용자가 직접 정한 발견 기준: 거래가격 차이를 조사한다.";
  const p=buildTopicRecommendationPrompt({channel:"집값쓱",today:"2026-10-29",lookbackDays:30,focus:"재건축",existingTopics:["기존 주제"],directions:custom});
  assert.match(p,/사용자가 직접 정한 발견 기준/);
  assert.doesNotMatch(p,/독자가 가장 알고 싶어 할 질문/);
  assert.match(p,/발행 채널: 집값쓱/);
  assert.match(p,/조사 기준일: 2026-10-29/);
  assert.match(p,/최근 30일/);
  assert.match(p,/기존 주제/);
  assert.match(p,/TOPIC_RECOMMENDATIONS_JSON/);
  const ui=fs.readFileSync("app/research-studio/TopicRecommendationsPanel.tsx","utf8");
  assert.match(ui,/setDirections\(e.target.value\)/);
  assert.match(ui,/localStorage.setItem\(DIRECTION_STORAGE_KEY,directions\)/);
  assert.match(ui,/기본 문구 복원/);
  assert.match(ui,/전체 요청서 미리보기/);
});
