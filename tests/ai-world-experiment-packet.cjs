const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../lib/ai-world-experiment-packet.mjs");

test("built-in fake-country fixture is complete and has exactly ten names", async () => {
  const { FAKE_COUNTRY_PACKET, canLockExperiment } = await load();
  const listed = FAKE_COUNTRY_PACKET.material.split("\n").filter(x => /^\d+\./.test(x));
  assert.equal(listed.length, 10);
  assert.equal(new Set(listed).size, 10);
  assert.match(FAKE_COUNTRY_PACKET.groundTruth, /7\. Norvessa/);
  assert.equal(canLockExperiment({ ...FAKE_COUNTRY_PACKET, sourceVerified: true }), true);
});

test("blind test prompt contains material but never discloses answer or hidden twist", async () => {
  const { buildBlindPrompt, FAKE_COUNTRY_PACKET } = await load();
  const p = buildBlindPrompt(FAKE_COUNTRY_PACKET);
  assert.match(p, /7\. Norvessa/); // a candidate name is legitimately visible
  assert.doesNotMatch(p, /invented name|correct answer must|remaining nine|UN member/i);
  assert.doesNotMatch(p, /GROUND TRUTH —|PRIVATE answer|scoring criterion/i);
  assert.match(p, /10\. Nauru/);
});

test("generic packet request mandates dataset and private answer separately", async () => {
  const { buildPacketRequest } = await load();
  const p = buildPacketRequest({ title: "Test topic", hook: "One fake item" });
  assert.match(p, /ACTUAL REPRODUCIBLE TEST MATERIAL/);
  assert.match(p, /needs_verification/);
  assert.match(p, /EXPERIMENT_PACKET_JSON/);
  assert.match(p, /Do not run the experiment/);
});

test("parser accepts a tagged complete packet and rejects missing evidence or leaked key", async () => {
  const { FAKE_COUNTRY_PACKET, parseExperimentPacket } = await load();
  const good = parseExperimentPacket("[EXPERIMENT_PACKET_JSON]\n" + JSON.stringify(FAKE_COUNTRY_PACKET) + "\n[/EXPERIMENT_PACKET_JSON]");
  assert.equal(good.error, "");
  assert.equal(good.packet.testQuestion, FAKE_COUNTRY_PACKET.testQuestion);
  assert.equal(parseExperimentPacket("{}").packet, null);
  assert.equal(parseExperimentPacket(JSON.stringify({ ...FAKE_COUNTRY_PACKET, material: FAKE_COUNTRY_PACKET.groundTruth })).packet, null);
  assert.equal(parseExperimentPacket(JSON.stringify({ ...FAKE_COUNTRY_PACKET, sourceStatus: "unknown" })).packet.sourceStatus, "needs_verification");
});

test("no material or unreviewed sources means experiment cannot be locked", async () => {
  const { FAKE_COUNTRY_PACKET, canLockExperiment } = await load();
  assert.equal(canLockExperiment({ ...FAKE_COUNTRY_PACKET, sourceVerified: false }), false);
  assert.equal(canLockExperiment({ ...FAKE_COUNTRY_PACKET, material: "", sourceVerified: true }), false);
});

test("Work requests one blind PDF while private answer and question remain copyable JSON text", async () => {
  const { buildWorkPdfRequest } = await load();
  const request = buildWorkPdfRequest({ title: "I Gave AI 10 Countries — One Was Fake. Would It Notice?" });
  assert.match(request, /blind_test\.pdf/);
  assert.match(request, /ONE ONLY/);
  assert.match(request, /\[EXPERIMENT_PACKET_JSON\]/);
  assert.match(request, /"testQuestion"/);
  assert.match(request, /"groundTruth"/);
  assert.match(request, /primary official source/i);
  assert.match(request, /do NOT run ChatGPT, Claude, or Gemini/i);
  assert.match(request, /don't create preview PNG/i);
  assert.match(request, /one.*PDF file/i);
  assert.match(request, /real selectable PDF text/i);
});


test("receipt topic gets receipt-specific prompt, not the fake-country question", async () => {
  const { suggestedExperimentQuestion, mismatchedExperimentQuestion } = await load();
  const title = "Can AI Guess the Country From a Supermarket Receipt?";
  const suggested = suggestedExperimentQuestion(title);
  assert.match(suggested, /supermarket receipt/i);
  assert.match(suggested, /which country/i);
  assert.doesNotMatch(suggested, /ten countries|fictional|fake/i);
  assert.equal(mismatchedExperimentQuestion(title, "Which one of these ten countries is not real? Explain briefly."), true);
  assert.equal(mismatchedExperimentQuestion(title, suggested), false);
});
test("fake country topic rejects a receipt country-identification question", async () => {
  const { suggestedExperimentQuestion, mismatchedExperimentQuestion } = await load();
  const title = "I Gave AI 10 Countries — One Was Fake. Would It Notice?";
  const suggested = suggestedExperimentQuestion(title);
  assert.match(suggested, /fictional/);
  assert.equal(mismatchedExperimentQuestion(title, "Which country issued the supermarket receipt?"), true);
  assert.equal(mismatchedExperimentQuestion(title, suggested), false);
});


test("PDF + question unlocks model testing without providing ground truth", async () => {
  const { getExperimentWorkflowStatus } = await load();
  const state = {
    title:"Can AI Guess the Country From a Supermarket Receipt?",
    testQuestion:"Which country is this supermarket receipt from?",
    commonPrompt:"Which country is this supermarket receipt from? Explain based on the attached PDF.",
    fixtureMode:"pdf", pdfSha256:"a".repeat(64), pdfName:"blind_test.pdf",
    pdfAvailable:true, groundTruth:"", sources:"",
  };
  const progress=getExperimentWorkflowStatus(state);
  assert.equal(progress.fixtureReady,true);
  assert.equal(progress.keyReady,false);
  assert.equal(progress.allScored,false);
  assert.equal(getExperimentWorkflowStatus({...state,pdfAvailable:false}).fixtureReady,false);
  assert.equal(getExperimentWorkflowStatus({...state,testQuestion:"Which one of these ten countries is fake?"}).fixtureReady,false);
});
test("three original answers are preserved for comparison; Work key and sources are needed only for article", async () => {
  const { getExperimentWorkflowStatus } = await load();
  const inputs = {
    title:"Can AI Guess the Country From a Supermarket Receipt?",
    testQuestion:"Which country is this supermarket receipt from?",
    commonPrompt:"Which country is this supermarket receipt from? Explain based on the attached PDF.",
    fixtureMode:"pdf", pdfSha256:"b".repeat(64), pdfName:"blind_test.pdf",
    pdfAvailable:true,
    runs:Object.fromEntries(["chatgpt","claude","gemini"].map(p=>[p,{
      response:"It could be Singapore from the GST line.",
      verdict:"correct", reviewed:true, usedSamePdf:true,
      highlight:"from the GST line",
    }]))
  };
  let status=getExperimentWorkflowStatus(inputs);
  assert.equal(status.fixtureReady,true);
  assert.equal(status.allAnswersCollected,true);
  assert.equal(status.allScored,false);
  status=getExperimentWorkflowStatus({...inputs,groundTruth:"Singapore",sources:"Official tax rules"});
  assert.equal(status.allScored,true);
  assert.equal(getExperimentWorkflowStatus({...inputs,groundTruth:"Singapore",sources:"",runs:inputs.runs}).allScored,false);
  const mismatch={...inputs,runs:{...inputs.runs,claude:{...inputs.runs.claude,usedSamePdf:false}}};
  assert.equal(getExperimentWorkflowStatus({...mismatch,groundTruth:"Singapore",sources:"Official tax rules"}).allScored,false);
  assert.equal(getExperimentWorkflowStatus({...inputs,groundTruth:"Singapore",sources:"Official tax rules",
    runs:{...inputs.runs,gemini:{...inputs.runs.gemini,highlight:"a made-up quote"}}}).allScored,false);
});
test("studio has no mandatory answer-lock button or lock handlers", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const src=fs.readFileSync(path.join(__dirname,"../app/google-blog-schedule/experiment/page.tsx"),"utf8");
  assert.match(src,/STEP 03/);
  assert.match(src,/공통 질문 설정/);
  assert.match(src,/정답 입력 · 사람과 AI 결과 비교/);
  assert.doesNotMatch(src,/function lockExperiment\(|function unlockExperiment\(|정답표 잠그기/);
  assert.match(src,/onChange=\{e=>updateGroundTruth\(e\.target\.value\)\}/);
});

test("human experiment workflow captures real notes, time, original photos, and optional fourth participant", () => {
  const fs=require("node:fs"), path=require("node:path");
  const src=fs.readFileSync(path.join(__dirname,"../app/google-blog-schedule/experiment/page.tsx"),"utf8");
  assert.match(src,/나도 직접 문제 풀어보기/);
  assert.match(src,/function startHumanTimer\(/);
  assert.match(src,/function stopHumanTimer\(/);
  assert.match(src,/storeHumanPhoto\(/);
  assert.match(src,/getHumanPhoto\(/);
  assert.match(src,/deleteHumanPhoto\(/);
  assert.match(src,/human\.attemptedBeforeAI/);
  assert.match(src,/human\.notes/);
  assert.match(src,/human\.photos/);
  assert.match(src,/human\.verdict/);
  assert.match(src,/ZIP으로 백업/);
  assert.match(src,/NEVER fabricate hesitations/);
  assert.match(src,/If no human answer was recorded, omit/);
  assert.doesNotMatch(src,/function lockExperiment\(/);
});
test("photo file recognizer rejects spoofed types and accepts JPG, PNG and WebP magic bytes", async () => {
  const {humanPhotoMimeType}=await import("../lib/ai-world-experiment-files.mjs");
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  const jpg=new Uint8Array([255,216,255,224,0,1,2,3,4,5,6,7]);
  const webp=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]);
  assert.equal(humanPhotoMimeType("photo.png",png),"image/png");
  assert.equal(humanPhotoMimeType("photo.JPG",jpg),"image/jpeg");
  assert.equal(humanPhotoMimeType("photo.webp",webp),"image/webp");
  assert.equal(humanPhotoMimeType("fake.pdf",png),"");
  assert.equal(humanPhotoMimeType("fake.png",jpg),"");
  assert.equal(humanPhotoMimeType("fake.jpg",new Uint8Array(12)),"");
});
