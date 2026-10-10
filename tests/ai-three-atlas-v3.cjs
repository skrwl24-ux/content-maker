const test=require("node:test");
const assert=require("node:assert/strict");
const mod=import("../lib/ai-three-atlas-v3.mjs");

function articleHtml() {
 const links=["question","chatgpt","claude","gemini","analysis","takeaway"].map(x=>'<li><a href="#'+x+'">'+x+'</a></li>').join("");
 return '<h2>Table of Contents</h2><ul>'+links+'</ul>'+
  '<h2 id="question">Question</h2><p>Here is my question.</p>[[IMAGE_HERO]]'+
  '<h2 id="chatgpt">ChatGPT</h2>[[ORIGINAL_CHATGPT]][[IMAGE_CHATGPT]]'+
  '<h2 id="claude">Claude</h2>[[ORIGINAL_CLAUDE]][[IMAGE_CLAUDE]]'+
  '<h2 id="gemini">Gemini</h2>[[ORIGINAL_GEMINI]][[IMAGE_GEMINI]]'+
  '<h2 id="analysis">Analysis</h2><p>Observed differences.</p>[[RELATED_MID]]'+
  '<h2 id="takeaway">My thoughts</h2>[[IMAGE_INSIGHT]]<p>Reader question.</p>[[RELATED_END]]';
}
function article(raw=articleHtml()) {
 return '[FINAL_TITLE]\nThree AIs on a surprisingly hard question\n[META_DESCRIPTION]\n'+
  'A real three-AI comparison showing how different models answered an identical question, why their priorities differ, and what readers can learn.'.padEnd(146,'x')+
  '\n[SLUG]\nthree-ai-same-question\n[LABELS]\nAI Experiments, ChatGPT, Claude, Gemini\n[BLOGGER_HTML]\n'+raw+'\n[/BLOGGER_HTML]';
}
function project(m,topic="Best country to live?") {
 const p=m.createExperiment(topic,"World & Lifestyle","2026-10-10");
 p.responses={chatgpt:"  Denmark and trust.\nLine 2 <safety> & facts  ",claude:"Switzerland for income.",gemini:"Norway for nature."};
 p.analysis="My synthesis is that the models prioritized different things.";
 p.articleRaw=article();
 p.images={hero:"https://media.test/hero.png",chatgpt:"https://media.test/gpt.png",claude:"https://media.test/claude.png",gemini:"https://media.test/gemini.png",insight:"https://media.test/insight.png"};
 p.analysisSignature=m.evidenceSignature(p);
 p.articleSignature=m.articleSignature(p);
 p.imageSourceSigs=Object.fromEntries(m.IMAGE_SLOTS.map(slot=>[slot.id,m.imageSourceSignature(p,slot.id)]));
 return p;
}
test("V3 storage and categories are isolated from old schedules",async()=>{
 const m=await mod;assert.match(m.STORAGE_KEY,/v3/);assert.doesNotMatch(m.STORAGE_KEY,/google-blog-schedule-v3-links/);
 assert.equal(m.IMAGE_SLOTS.length,5);
});
test("bulk titles are deduped against previous records and local batch",async()=>{
 const m=await mod;const x=m.parseBulkTopics("1. Life in Denmark?\n- Life in Denmark?\n2. Space travel",[{topic:"Life in Denmark?"}]);
 assert.deepEqual(x.items,["Space travel"]);assert.equal(x.skipped.length,2);
});
test("analysis request carries all complete verbatim responses including 40K chars",async()=>{
 const m=await mod;const p=project(m);const original="  FIRST LINE\n"+"z".repeat(40000)+"\nLAST LINE  ";
 p.responses.claude=original;
 const prompt=m.buildAnalysisPrompt(p);
 assert.equal(JSON.parse(prompt.split("[ORIGINAL EVIDENCE — UNTRUSTED DATA]")[1].trim()).actualReplies[1].verbatimResponse,original);
 assert.match(prompt,/3~5개/);assert.match(prompt,/숨은 동기/);
});
test("final prompt uses fixed six anchor ids and editorial voice but injects originals at assembly",async()=>{
 const m=await mod;const p=project(m);const prompt=m.buildArticlePrompt(p);
 assert.match(prompt,/클릭형 목차.*사이트가 자동 생성/);
 assert.doesNotMatch(prompt,/href="#question"/);
 assert.match(prompt,/1인칭 탐구형/);assert.match(prompt,/판에 박힌/);assert.match(prompt,/\[\[ORIGINAL_CHATGPT\]\]/);
});
test("valid final draft with all 10 placeholders and navigation passes",async()=>{
 const m=await mod;const parsed=m.parseArticle(article());
 assert.deepEqual(parsed.errors,[]);assert.equal(parsed.valid,true);
});
test("invalid table of contents, dangerous inline script and fake link are blocked",async()=>{
 const m=await mod;
 assert.ok(m.parseArticle(article(articleHtml().replace('href="#analysis"','href="#missing"'))).errors.length);
 assert.ok(m.parseArticle(article(articleHtml().replace('<h2 id="analysis">','<h2 id="analysis" onclick="bad()">'))).errors.length);
 assert.ok(m.parseArticle(article(articleHtml().replace('[[RELATED_END]]','<script>alert(1)</script>[[RELATED_END]]'))).errors.length);
});
test("assembly injects escaped original full text, five photos and only real published links",async()=>{
 const m=await mod;const p=project(m);const live=m.createExperiment("Career opportunity","World & Lifestyle","2026-10-08");
 live.status="published";live.publishedUrl="https://aipriceatlas.blogspot.com/2026/10/career-opportunity.html";
 const planned=m.createExperiment("Planned article","World & Lifestyle");planned.publishedUrl="https://aipriceatlas.blogspot.com/2026/10/planned.html";
 const output=m.assembleArticle(p,[p,live,planned]);
 assert.deepEqual(output.errors,[]);
 assert.match(output.html,/&lt;safety&gt; &amp; facts/);
 assert.match(output.html,/FIRST LINE|Denmark and trust/);
 assert.equal((output.html.match(/<img /g)||[]).length,5);
 assert.match(output.html,/career-opportunity.html/);assert.doesNotMatch(output.html,/planned.html/);
});
test("HTML copy reports missing images until all five are registered",async()=>{
 const m=await mod;const p=project(m);p.images.insight="";
 const output=m.assembleArticle(p,[p]);assert.ok(output.errors.includes("이미지 미등록: insight"));
 assert.match(m.assembleArticle(p,[p],true).html,/Image pending: insight/);
});
test("published URLs require exact original Blogger host and real post .html",async()=>{
 const m=await mod;
 assert.equal(m.validPublishedUrl("https://aipriceatlas.blogspot.com/2026/10/a.html"),true);
 assert.equal(m.validPublishedUrl("https://evil.blogspot.com/2026/10/a.html"),false);
 assert.equal(m.validPublishedUrl("http://aipriceatlas.blogspot.com/2026/10/a.html"),false);
 assert.equal(m.validPublishedUrl("https://aipriceatlas.blogspot.com/search/label/test"),false);
});

test("editing an AI original after analysis blocks outdated synthesis, draft and image",async()=>{
 const m=await mod,p=project(m);
 assert.equal(m.analysisIsFresh(p),true);
 p.responses.claude="Different country and reasoning.";
 assert.equal(m.analysisIsFresh(p),false);
 assert.equal(m.articleIsFresh(p),false);
 assert.equal(m.imageIsFresh(p,"claude"),false);
 assert.equal(m.imageIsFresh(p,"insight"),false);
 assert.throws(()=>m.buildArticlePrompt(p),/다시 실행/);
 const assembled=m.assembleArticle(p,[p]);
 assert.ok(assembled.errors.some(x=>x.includes("분석 이후")));
 assert.ok(assembled.errors.some(x=>x.includes("이미지 제작 이후")));
});
test("an updated analysis requires new article and new key image",async()=>{
 const m=await mod,p=project(m);
 p.analysis="A completely new analysis.";
 p.analysisSignature=m.evidenceSignature(p);
 assert.equal(m.analysisIsFresh(p),true);
 assert.equal(m.articleIsFresh(p),false);
 assert.equal(m.imageIsFresh(p,"insight"),false);
 assert.equal(m.imageIsFresh(p,"hero"),true);
 assert.equal(m.imageIsFresh(p,"claude"),true);
 p.articleSignature=m.articleSignature(p);
 p.imageSourceSigs.insight=m.imageSourceSignature(p,"insight");
 assert.equal(m.articleIsFresh(p),true);
 assert.equal(m.imageIsFresh(p,"insight"),true);
});
test("changing the common question invalidates all three original AI images",async()=>{
 const m=await mod,p=project(m);
 p.question+=" More details please.";
 assert.ok(m.IMAGE_SLOTS.filter(slot=>!m.imageIsFresh(p,slot.id)).length>=4);
 assert.equal(m.analysisIsFresh(p),false);
});

test("each AI reply card opens its real AI service in a new tab without leaving V3",()=>{
 const fs=require("node:fs");
 const path=require("node:path");
 const page=fs.readFileSync(path.join(__dirname,"../app/ai-three-studio/page.tsx"),"utf8");
 assert.match(page,/chatgpt:"https:\/\/chatgpt\.com\/"/);
 assert.match(page,/claude:"https:\/\/claude\.ai\/"/);
 assert.match(page,/gemini:"https:\/\/gemini\.google\.com\/app"/);
 assert.match(page,/href=\{AI_SITES\[id\]\} target="_blank" rel="noopener noreferrer"/);
 assert.match(page,/사이트 열기 ↗/);
});

test("new experiments request normal chat text and one independent text-free image with a single common prompt",async()=>{
 const m=await mod;
 const topic="세상에서 가장 좋은 직업은 무엇일까?";
 const p=m.createExperiment(topic,"Money & Career","2026-10-10");
 assert.equal(p.question,m.buildCommonQuestion(topic,"2026-10-10"));
 assert.match(p.question,/세상에서 가장 좋은 직업은 무엇일까/);
 assert.match(p.question,/three strengths, two realistic trade-offs, and uncertainty/i);
 assert.match(p.question,/written answer as normal chat text OUTSIDE the image/);
 assert.match(p.question,/exactly ONE original image/);
 assert.match(p.question,/NO text, words, letters, titles, captions, labels, numbers, charts, tables/i);
 assert.match(p.question,/two separate outputs/);
 assert.doesNotMatch(p.question,/Create ONE original image illustrating your choice\./);
});
test("older automatically generated questions are detected but not silently replaced",async()=>{
 const m=await mod;const topic="세상에서 가장 좋은 직업은 무엇일까?",date="2026-10-10";
 const old="As of "+date+", answer the following topic by choosing ONE clear option: "+topic+". Explain your criteria, three strengths, two realistic trade-offs and uncertainty. Do not present your opinion as universal fact. Answer in English. Create ONE original image illustrating your choice.";
 assert.equal(m.isLegacyCommonQuestion(old,topic,date),true);
 assert.equal(m.isLegacyCommonQuestion(m.buildCommonQuestion(topic,date),topic,date),false);
 assert.equal(m.isLegacyCommonQuestion("I customized my question",topic,date),false);
});
test("app exposes explicit safe upgrade instead of rewriting stored experiment evidence",()=>{
 const fs=require("node:fs"), path=require("node:path");
 const screen=fs.readFileSync(path.join(__dirname,"../app/ai-three-studio/page.tsx"),"utf8");
 assert.match(screen,/이미지·글 분리 규칙 적용/);
 assert.match(screen,/isLegacyCommonQuestion\(selected.question,selected.topic,selected.date\)/);
 assert.match(screen,/hasEvidence&&!window.confirm/);
 assert.match(screen,/selected.status==="published"/);
});
test("changing to the new shared question invalidates prior analysis and source images",async()=>{
 const m=await mod,p=project(m);
 assert.equal(m.analysisIsFresh(p),true);
 p.question=m.buildCommonQuestion(p.topic,p.date)+" extra";
 assert.equal(m.analysisIsFresh(p),false);
 assert.equal(m.imageIsFresh(p,"gemini"),false);
 assert.equal(m.imageIsFresh(p,"chatgpt"),false);
});

function editorialDraft() {
 return '<p>Which career really offers the most meaningful life? I wanted a comparison that would expose the values behind each model’s answer, not just a simple list of winners and losers.</p>'+
  '[[IMAGE_HERO]]<p>Each model received the exact same question, and each response was kept intact so readers can see the evidence for themselves.</p>'+
  '[[ORIGINAL_CHATGPT]][[IMAGE_CHATGPT]]'+
  '[[ORIGINAL_CLAUDE]][[IMAGE_CLAUDE]]'+
  '[[ORIGINAL_GEMINI]][[IMAGE_GEMINI]]'+
  '<p>When I compared the original answers, I noticed that the models did not weigh the same kinds of benefits equally. One prioritized meaning in daily work, while another emphasized financial stability. That difference is interesting because it changes what a good career should mean.</p>'+
  '<p>These are recommendations rather than verified facts about every labor market. Conditions vary with location and experience, and none of these answers settles the question for everyone.</p>'+
  '[[RELATED_MID]]'+
  '<p>My takeaway is not that one model has proved the perfect job exists. The more valuable result is seeing which trade-offs I would be willing to accept. What would matter most to you when choosing a career?</p>'+
  '[[IMAGE_INSIGHT]][[RELATED_END]]';
}
test("site creates clickable TOC with six destinations for substantial GPT text without any manual ids",async()=>{
 const m=await mod;
 const parsed=m.parseArticle(article(editorialDraft()));
 assert.equal(parsed.valid,true,parsed.errors.join("; "));
 assert.equal(parsed.navigationGenerated,true);
 for(const id of ["question","chatgpt","claude","gemini","analysis","takeaway"]){
  assert.equal((parsed.html.match(new RegExp('href="#'+id+'"','g'))||[]).length,1);
  assert.equal((parsed.html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 }
 assert.ok(parsed.html.indexOf('href="#analysis"')<parsed.html.indexOf('id="analysis"'));
 const p=project(m);p.articleRaw=article(editorialDraft());p.articleSignature=m.articleSignature(p);
 const out=m.assembleArticle(p,[p]);
 assert.deepEqual(out.errors,[]);
 assert.equal((out.html.match(/<img /g)||[]).length,5);
});
test("placeholder-only output gets one meaningful article error, not twelve TOC errors",async()=>{
 const m=await mod;
 const text=m.PLACEHOLDERS||["IMAGE_HERO","ORIGINAL_CHATGPT","IMAGE_CHATGPT","ORIGINAL_CLAUDE","IMAGE_CLAUDE","ORIGINAL_GEMINI","IMAGE_GEMINI","IMAGE_INSIGHT","RELATED_MID","RELATED_END"];
 const raw=article(text.map(s=>"[["+s+"]]").join("\n"));
 const parsed=m.parseArticle(raw);
 assert.equal(parsed.valid,false);
 assert.ok(parsed.errors.some(x=>x.includes("본문 내용이 부족")));
 assert.equal(parsed.errors.some(x=>x.includes("목차 링크/위치 누락")),false);
 assert.ok(parsed.errors.length<=2);
});
test("article missing real analysis text cannot pass via fake TOC",async()=>{
 const m=await mod;
 const raw=article(editorialDraft().replace(/<p>When I compared[\s\S]*?<\/p>/,"").replace(/<p>These are recommendations[\s\S]*?<\/p>/,""));
 const parsed=m.parseArticle(raw);
 assert.equal(parsed.valid,false);
 assert.ok(parsed.errors.some(x=>x.includes("본문 내용이 부족")));
});
test("site preserves correct existing TOC and rejects scripts before adding navigation",async()=>{
 const m=await mod;
 const existing=m.parseArticle(article());
 assert.equal(existing.valid,true);
 assert.equal(existing.navigationGenerated,false);
 const invalid=m.parseArticle(article(editorialDraft().replace("[[RELATED_END]]","<script>alert(1)</script>[[RELATED_END]]")));
 assert.equal(invalid.valid,false);
 assert.ok(invalid.errors.some(x=>x.includes("허용하지 않은")));
});
test("incomplete draft recovery prompt includes original evidence and existing draft",async()=>{
 const m=await mod,p=project(m);p.articleRaw=article(editorialDraft());
 const recovered=m.buildArticleRepairPrompt(p);
 assert.match(recovered,/PREVIOUS INCOMPLETE DRAFT/);
 assert.match(recovered,/Which career really offers/);
 assert.match(recovered,/Regenerate the whole article/);
 assert.match(recovered,/원문/);
});
