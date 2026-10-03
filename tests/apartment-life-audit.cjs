const test = require("node:test");
const assert = require("node:assert/strict");

const audit = import("../lib/apartment-life-audit.mjs");
const name = "신림현대";
const before = [
  "# 신림현대 분석",
  "4월 대표값은 4.37억입니다.",
  "단지와 직접 연결되는 상가가 있습니다.",
  "서원역 접근성과 단지에 연결된 생활시설은 확인할 요소입니다.",
  "미확인 도보시간은 3분입니다.",
  "#관악구 #신림동",
].join("\n");
const originalA = "단지와 직접 연결되는 상가가 있습니다.";
const replacementA = "단지와 같은 지번에 상가가 등록돼 있습니다.";
const originalB = "서원역 접근성과 단지에 연결된 생활시설은 확인할 요소입니다.";
const replacementB = "서원역과 같은 지번에 등록된 상가는 별도로 확인할 요소입니다.";
const source = "https://news.seoul.go.kr/economy/archives/574563";

function report(checks, { webAccess = "available", requestId } = {}) {
  const id = requestId || "TEMP";
  return "[LOCAL_AUDIT_JSON]" + JSON.stringify({
    requestId: id, subjectName: name, webAccess,
    checkedAt: "2026-10-03", summary: "생활정보 확인", checks,
  }) + "[/LOCAL_AUDIT_JSON]";
}

test("source-backed conservative unverified replacements can be automatically applied without changing price text", async () => {
  const m = await audit;
  const id = m.lifeAuditRequestId(name, before);
  const checks = [
    { topic: "시설", status: "unverified", original: originalA,
      recommendedText: replacementA, sourceUrl: source, sourceTitle: "서울시 시장 현황" },
    { topic: "시설", status: "unverified", original: originalB,
      recommendedText: replacementB, sourceUrl: source, sourceTitle: "서울시 시장 현황" },
  ];
  const parsed = m.parseLifeVerificationResult(report(checks,{requestId:id}), { name, body:before });
  assert.equal(parsed.checks.length,2);
  assert.ok(parsed.checks.every(item => item.matchCount === 1 && m.isLifeVerificationChangeApplicable(item)));
  const result = m.applyLifeVerificationChanges(before,parsed,parsed.checks.map(item=>item.id));
  assert.equal(result.applied,2);
  assert.equal(result.skipped,0);
  assert.ok(result.body.includes(replacementA));
  assert.ok(result.body.includes(replacementB));
  assert.ok(result.body.includes("4월 대표값은 4.37억입니다."));
  assert.ok(result.body.includes("#관악구 #신림동"));
  assert.ok(!result.body.includes(originalA));
});

test("missing source only permits deletion of an unverified claim", async () => {
  const m = await audit;
  assert.equal(m.isLifeVerificationChangeApplicable({
    status:"unverified",original:originalA,recommendedText:replacementA,sourceUrl:""
  }),false);
  assert.equal(m.isLifeVerificationChangeApplicable({
    status:"unverified",original:originalA,recommendedText:"",sourceUrl:""
  }),true);
  assert.equal(m.isLifeVerificationChangeApplicable({
    status:"update",original:originalA,recommendedText:replacementA,sourceUrl:""
  }),false);
  assert.equal(m.isLifeVerificationChangeApplicable({
    status:"confirmed",original:originalA,recommendedText:"",sourceUrl:source
  }),false);
});

test("rejects embedded replacement URLs and unchanged text", async () => {
  const m = await audit;
  assert.equal(m.isLifeVerificationChangeApplicable({
    status:"unverified",original:originalA,recommendedText:"https://example.org",sourceUrl:source
  }),false);
  assert.equal(m.isLifeVerificationChangeApplicable({
    status:"update",original:originalA,recommendedText:originalA,sourceUrl:source
  }),false);
});

test("duplicate original text and stale audit ID are not applied", async () => {
  const m=await audit;
  const duplicated = before + "\n" + originalA;
  const parsed = m.parseLifeVerificationResult(report([{
    status:"unverified",original:originalA,recommendedText:replacementA,sourceUrl:source,
  }],{requestId:m.lifeAuditRequestId(name,duplicated)}),{name,body:duplicated});
  assert.equal(parsed.checks[0].matchCount,2);
  const unchanged=m.applyLifeVerificationChanges(duplicated,parsed,[parsed.checks[0].id]);
  assert.equal(unchanged.applied,0);
  assert.equal(unchanged.skipped,1);
  assert.equal(unchanged.body,duplicated);
  const stale=m.applyLifeVerificationChanges(before,parsed,[parsed.checks[0].id]);
  assert.equal(stale.applied,0);
  assert.equal(stale.body,before);
});

test("unavailable web access cannot masquerade as confirmed audit",async()=>{
  const m=await audit;
  const id=m.lifeAuditRequestId(name,before);
  assert.throws(()=>m.parseLifeVerificationResult(report([],{
    requestId:id,webAccess:"unavailable"
  }),{name,body:before}),/실제 웹 검색 결과가 없습니다/);
});
