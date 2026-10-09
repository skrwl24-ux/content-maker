"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";
import { FAKE_COUNTRY_PACKET, FAKE_COUNTRY_TITLE, buildPacketRequest, parseExperimentPacket, buildBlindPrompt, buildWorkPdfRequest, suggestedExperimentQuestion, mismatchedExperimentQuestion, getExperimentWorkflowStatus } from "@/lib/ai-world-experiment-packet.mjs";
import { storeExperimentPdf, getExperimentPdf } from "@/lib/ai-world-experiment-files.mjs";
import type { PdfMeta } from "@/lib/ai-world-experiment-files.mjs";

type ProviderId = "chatgpt" | "claude" | "gemini";
type ProviderRun = {
  model: string;
  testedAt: string;
  usedSamePdf: boolean;
  response: string;
  finalAnswer: string;
  verdict: "" | "correct" | "incorrect" | "partial" | "uncertain";
  highlight: string;
  accuracy: number | null;
  instruction: number | null;
  hallucinations: number | null;
  reviewed: boolean;
  weirdestMistake: string;
  notes: string;
};
type ExperimentState = {
  scheduleId: string;
  scheduleDate: string;
  title: string;
  category: string;
  hook: string;
  keyword: string;
  testQuestion: string;
  material: string;
  fixtureMode: "pdf" | "text";
  pdf: PdfMeta | null;
  hiddenTwist: string;
  groundTruth: string;
  sources: string;
  sourceVerified: boolean;
  sourceStatus: string;
  lockedAt: string;
  commonPrompt: string;
  runs: Record<ProviderId, ProviderRun>;
};

const STORAGE_KEY = "ai-world-experiment-studio-v1";
const SEED_TRANSFER_KEY = "ai-world-experiment-seed-v1";
const QUEUE_TRANSFER_KEY = "ai-price-atlas-lab-queue-transfer-v1";

const PROVIDERS: Array<{id: ProviderId; label: string; url: string}> = [
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", label: "Claude", url: "https://claude.ai/" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/" },
];

const STARTERS = [
  { category: "Maps & Geography", title: "Can AI Guess the Country From a Supermarket Receipt?", hook: "Remove the store name and country. Keep products, currency clues and tax lines.", keyword: "AI guess country receipt" },
  { category: "World & Geography", title: "I Gave AI 10 Countries — One Was Fake. Would It Notice?", hook: "Use nine real countries and one invented country with plausible-looking facts.", keyword: "AI fake country test" },
  { category: "Food", title: "Can AI Identify 20 Foods From Around the World With the Names Removed?", hook: "Give short ingredient descriptions or unlabeled images and count exact vs partial matches.", keyword: "AI world food challenge" },
  { category: "Languages", title: "Can AI Guess a Language From Just One Sentence?", hook: "Mix common and less obvious languages, plus one constructed fake sample.", keyword: "AI language guessing test" },
  { category: "Travel", title: "Can AI Guess the City From a Subway Map With Station Names Hidden?", hook: "Use cropped public transit diagrams or simplified station patterns without city labels.", keyword: "AI subway map city test" },
  { category: "Animals", title: "I Mixed Real and Fake Animal Facts — Could AI Catch Them?", hook: "Build a balanced list with sourced facts and believable inventions.", keyword: "AI animal fact test" },
  { category: "Weather", title: "Can AI Guess the City From 12 Months of Weather Data?", hook: "Hide the location and give temperature/rainfall normals from clearly sourced datasets.", keyword: "AI weather city guessing test" },
  { category: "History", title: "Can AI Put 15 World Events in the Right Order Without Dates?", hook: "Remove the years but keep concise event descriptions from public historical sources.", keyword: "AI history timeline test" },
  { category: "Prices", title: "Can AI Tell Which Country Has the Higher Grocery Bill?", hook: "Give comparable baskets with country names hidden and reveal purchasing clues after the guess.", keyword: "AI grocery price country test" },
  { category: "Images", title: "Can AI Spot the One Fake Landmark in a List of Real Places?", hook: "Use nine verifiable landmarks and one invented but plausible place name.", keyword: "AI fake landmark test" },
  { category: "Statistics", title: "I Gave AI 12 Weird World Records — Which Ones Did It Believe?", hook: "Mix sourced records with fabricated claims and score confidence vs accuracy.", keyword: "AI world records fact check" },
  { category: "Numbers", title: "Can AI Find the One Impossible Number in a Real-Looking Data Table?", hook: "Create a small synthetic table with one mathematically inconsistent row and keep the answer key private.", keyword: "AI data table error test" },
];

function emptyRun(): ProviderRun {
  return { model: "", testedAt:"", usedSamePdf:false, response: "", finalAnswer:"", verdict:"", highlight:"", accuracy: null, instruction: null, hallucinations: null, reviewed: false, weirdestMistake: "", notes: "" };
}
function emptyState(): ExperimentState {
  return {
    scheduleId: "",
    scheduleDate: "",
    title: STARTERS[0].title,
    category: STARTERS[0].category,
    hook: STARTERS[0].hook,
    keyword: STARTERS[0].keyword,
    testQuestion: suggestedExperimentQuestion(STARTERS[0].title),
    material: "",
    fixtureMode: "pdf",
    pdf: null,
    hiddenTwist: "",
    groundTruth: "",
    sources: "",
    sourceVerified: false,
    sourceStatus: "needs_verification",
    lockedAt: "",
    commonPrompt: "",
    runs: { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() },
  };
}
function today() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function slugify(value: string) {
  return value.toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90);
}
function safeScore(value: number) {
  return Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0));
}
function validRunScores(run: ProviderRun) {
  return typeof run.accuracy === "number" && Number.isFinite(run.accuracy) && run.accuracy >= 0 && run.accuracy <= 10 &&
    typeof run.instruction === "number" && Number.isFinite(run.instruction) && run.instruction >= 0 && run.instruction <= 10 &&
    typeof run.hallucinations === "number" && Number.isSafeInteger(run.hallucinations) && run.hallucinations >= 0;
}
function buildIdeaPrompt() {
  return `Find 10 unusual AI experiments for an English-language global website.

Goal: attract readers worldwide with curiosity-driven "Can AI...?" or "I gave AI..." experiments using real, verifiable world data.

Use current web research when needed, but prefer experiment ideas whose ground truth can be checked from public or primary sources.

Mix categories such as:
- countries / geography / maps
- food
- languages
- animals
- travel
- weather
- history
- prices
- statistics
- images
- everyday documents

Rules:
- The experiment must be understandable to people in many countries.
- Avoid topics that require private personal data.
- Avoid medical, legal, political persuasion, dangerous or illegal testing.
- Prefer a surprising hidden twist: one fake item, names removed, labels hidden, conflicting clues, one impossible value, etc.
- The result must be objectively checkable.
- Do not propose generic "ask AI trivia" tests.
- Each experiment should be practical to run manually with ChatGPT, Claude and Gemini.

Return a compact table with:
1. English title
2. Category
3. What AI sees
4. Hidden twist
5. How to establish ground truth
6. Why people would click
7. Suggested English search phrase

Then choose the best 3 ideas for global curiosity and explain why.`;
}
function defaultCommonPrompt(s: ExperimentState) {
  return buildBlindPrompt({testQuestion:s.testQuestion, material:s.fixtureMode==="pdf" ? "Analyze the attached PDF exactly as provided. Use only details that are actually visible in this document. If the attachment is missing or unreadable, say so." : s.material});
}

function reportText(s: ExperimentState) {
  const rows = PROVIDERS.map(p => {
    const r = s.runs[p.id];
    return [
      p.label + (r.model ? " ("+r.model+")" : ""),
      "Review status: " + (r.reviewed ? "Operator reviewed" : "NOT REVIEWED"),
      "Test date: " + (r.testedAt || "not recorded"),
      "Same fixture PDF explicitly confirmed: " + (r.usedSamePdf ? "yes" : "not confirmed"),
      "Answer selected: " + (r.finalAnswer || "not independently transcribed"),
      "Correctness verdict (operator): " + (r.reviewed ? (r.verdict || "not assessed") : "UNREVIEWED"),
      "Interesting verbatim passage (operator-selected): " + (r.highlight || "not selected"),
      "Accuracy: " + (r.reviewed && r.accuracy !== null ? safeScore(r.accuracy) + "/10" : "NOT SCORED"),
      "Instruction following: " + (r.reviewed && r.instruction !== null ? safeScore(r.instruction) + "/10" : "NOT SCORED"),
      "Hallucinations: " + (r.reviewed && r.hallucinations !== null ? Math.max(0, Math.floor(r.hallucinations)) : "NOT SCORED"),
      "Weirdest mistake: " + (r.weirdestMistake || "Not recorded"),
      "Notes: " + (r.notes || "None"),
      "Original answer:\n" + (r.response || "Not collected"),
    ].join("\n");
  }).join("\n\n---\n\n");
  return [
    "AI WORLD EXPERIMENT — ORIGINAL RESULTS REPORT",
    "Date: " + today(),
    "Precommitted answer stored by Work before testing: operator responsibility (no site lock required)",
    "Fixture mode: " + s.fixtureMode,
    "Attached PDF: " + (s.pdf ? s.pdf.name + " | sha256=" + s.pdf.sha256 + " | bytes=" + s.pdf.bytes : "none"),
    "PDF must be attached separately when testing and uploaded separately if publishing. This report does not include the PDF bytes.",
    "Evidence review: " + (s.sourceVerified ? "operator checked" : "not independently checked"),
    "Experiment status: " + (s.groundTruth.trim() && s.sources.trim() && PROVIDERS.every(p => s.runs[p.id].response.trim() && s.runs[p.id].reviewed && s.runs[p.id].verdict && (s.fixtureMode !== "pdf" || s.runs[p.id].usedSamePdf)) ? "COMPLETE" : "INCOMPLETE — DO NOT PUBLISH"),
    "Title: " + s.title,
    "Category: " + s.category,
    "Hook: " + s.hook,
    "",
    "TEST QUESTION",
    s.testQuestion || s.title,
    "",
    "WHAT THE AI SAW",
    s.fixtureMode === "pdf" ? ("The PDF listed above (content must be inspected directly). " + (s.material || "")) : (s.material || "Not recorded"),
    "",
    "HIDDEN TWIST",
    s.hiddenTwist || "None",
    "",
    "GROUND TRUTH — imported from precommitted Work answer key or entered by operator after collecting responses",
    s.groundTruth || "NOT RECORDED",
    "",
    "GROUND-TRUTH SOURCES",
    s.sources || "Not recorded",
    "",
    "MODEL RESULTS",
    rows,
    "",
    "IMPORTANT LIMIT",
    "The studio does not independently prove when an answer key was created. The operator should retain the original Work answer key and verify source material. Do not generalize one experiment into an overall model ranking.",
  ].join("\n");
}
function bloggerPrompt(s: ExperimentState) {
  const report = reportText(s);
  return `Write the final English Blogger article for a global curiosity-driven AI experiment site.

[DATE]
${today()}

[PLANNED TITLE]
${s.title}

[PRIMARY SEARCH PHRASE]
${s.keyword || "AI experiment"}

[EXPERIMENT RECORD — ORIGINAL RESPONSES AND OPERATOR-ENTERED ANSWER]
${report}

[CORE RULE]
This is a real experiment write-up, not a generic AI article.
Use only the recorded experiment setup, ground truth and model results above.
Do not invent scores, model versions, answers, sources or observations.
Use the actual original answers to describe what ChatGPT, Claude and Gemini EACH selected, what their reasoning literally says, and how their approaches differ.
Present the three provider answers with individually attributed short VERBATIM excerpts, not invented quotes or an AI-written imitation.
If an excerpt was manually selected, confirm it occurs exactly in that providers original response; otherwise select a brief exact excerpt from its saved response.
If there is no noteworthy error, do not invent a weirdest mistake. Use human-confirmed verdicts for the scoreboard; numeric metrics are optional and never inferred from blank fields.
Make the reader guess before showing the private answer, but do not delay disclosure so long that the result becomes unclear.
The PDF is a local fixture, not an online link: do not fabricate a public PDF URL or claim it is embedded in Blogger HTML. PDF images and full original answer files need to be uploaded separately by the operator if they want to show those assets.
Do not change the operator's recorded scoring.
If one field is missing, omit it or clearly label it as not recorded. The answer key is supplied from Work by the operator after testing and was not independently timestamped or cryptographically locked by the studio. Do not claim otherwise.

[ARTICLE STYLE]
- English only.
- Fun, curious and readable worldwide.
- The tone can be playful, but factual claims and scores must stay precise.
- Avoid academic benchmark language unless necessary.
- Do not claim this single test proves which AI is "best."
- Make the surprise/reveal satisfying without hiding the result for too long.
- First 100 words should explain the challenge and give a reason to keep reading.

[ARTICLE STRUCTURE]
Use this as the default flow, adapting naturally:
1. Short reader-facing hook and challenge (invite readers to try themselves)
2. The identical PDF and question given to all three (include the recorded file checksum only if useful)
3. What ChatGPT Actually Said (its choice, reasoning, accurate excerpt)
4. What Claude Actually Said (its choice, reasoning, accurate excerpt)
5. What Gemini Actually Said (its choice, reasoning, accurate excerpt)
6. Where Their Reasoning Diverged (verified comparison, no invented thoughts)
7. The Big Reveal: Correct Answer and Source
8. Who Got It Right? Grounded three-row scoreboard
9. Most Surprising Real Response (only if one was actually observed)
10. What This One Experiment Does and Does Not Show
11. Final Verdict and invitation to reader

Include a compact comparison table when all three models have reviewed correctness verdicts.
Mention the ground-truth source methodology with clickable primary links where verified.
The "Weirdest Mistake" section should use only the recorded mistakes.

[IMAGE PLACEHOLDERS — exact lines]
[IMAGE 00 — Experiment hook]
[IMAGE 01 — Test setup]
[IMAGE 02 — AI answers]
[IMAGE 03 — The reveal]
[IMAGE 04 — Scoreboard]
[IMAGE 05 — Weirdest mistake]

[BLOGGER HTML]
- No H1 inside the body.
- Use simple h2/h3/p/strong/ul/ol/table/a tags.
- No style/class/id/script tags.
- Keep paragraphs short for mobile.
- No Markdown inside Blogger HTML.

[FINAL OUTPUT — exact markers]
[FINAL_TITLE]
One final English title

[META_DESCRIPTION]
140–155 character English description

[SLUG]
${slugify(s.title) || "ai-world-experiment"}

[LABELS]
4–7 comma-separated Blogger labels

[BLOGGER_HTML]
Clean Blogger-ready HTML
[/BLOGGER_HTML]

Do not write anything outside these markers.`;
}

export default function AiWorldExperimentStudio() {
  const [state, setState] = useState<ExperimentState>(() => emptyState());
  const [activeProvider, setActiveProvider] = useState<ProviderId>("chatgpt");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [packetInput, setPacketInput] = useState("");
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let next = raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
      const seedRaw = localStorage.getItem(SEED_TRANSFER_KEY);
      if (seedRaw) {
        const seed = JSON.parse(seedRaw);
        const caseKey = "ai-world-experiment-case:" + String(seed.scheduleId || slugify(String(seed.title || "")));
        const remembered = localStorage.getItem(caseKey);
        const recovered = remembered ? JSON.parse(remembered) as ExperimentState : null;
        next = recovered && recovered.title === seed.title ? { ...emptyState(), ...recovered } : {
          ...emptyState(),
          scheduleId: typeof seed.scheduleId === "string" ? seed.scheduleId : "",
          scheduleDate: typeof seed.date === "string" ? seed.date : "",
          title: typeof seed.title === "string" ? seed.title : next.title,
          keyword: typeof seed.keyword === "string" ? seed.keyword : next.keyword,
          category: typeof seed.category === "string" ? seed.category : "Global Curiosity",
          hook: typeof seed.hook === "string" ? seed.hook : "",
        };
        localStorage.removeItem(SEED_TRANSFER_KEY);
        setNotice(remembered ? "이전 실험 작업을 복원했습니다. PDF와 답변 기록을 확인하세요." : "새 실험 주제를 불러왔습니다. Work에서 PDF부터 준비하세요.");
      }
      if (!next.lockedAt && !String(next.testQuestion || "").trim() && suggestedExperimentQuestion(next.title)) next.testQuestion = suggestedExperimentQuestion(next.title);
      next.runs = Object.fromEntries(PROVIDERS.map(p => [p.id, { ...emptyRun(), ...(next.runs?.[p.id] || {}) }])) as ExperimentState["runs"];
      setState(next);
    } catch {
      setState(emptyState());
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        const caseId = state.scheduleId || slugify(state.title);
        if (caseId) localStorage.setItem("ai-world-experiment-case:" + caseId, JSON.stringify(state));
      } catch {}
    }, 350);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || !state.pdf?.sha256) { setPdfAvailable(false); return; }
    let alive=true;
    getExperimentPdf(state.pdf.sha256).then(blob=>{if(alive)setPdfAvailable(Boolean(blob));}).catch(()=>{if(alive)setPdfAvailable(false);});
    return ()=>{alive=false;};
  }, [hydrated, state.pdf?.sha256]);
  const commonPrompt = state.commonPrompt.trim() || defaultCommonPrompt(state);
  const report = useMemo(() => reportText(state), [state]);
  const articlePrompt = useMemo(() => bloggerPrompt(state), [state]);
  const completed = PROVIDERS.filter(p => state.runs[p.id].response.trim()).length;
  const suggestedQuestion = suggestedExperimentQuestion(state.title);
  const {mismatchedQuestion, noKeyLeak, fixtureReady, allAnswersCollected, keyReady, allScored} = getExperimentWorkflowStatus({
    title:state.title, testQuestion:state.testQuestion, commonPrompt,
    fixtureMode:state.fixtureMode, pdfSha256:state.pdf?.sha256 || "",
    pdfName:state.pdf?.name || "", pdfAvailable, material:state.material,
    groundTruth:state.groundTruth, hiddenTwist:state.hiddenTwist, sources:state.sources,
    runs:state.runs
  });

  function patch<K extends keyof ExperimentState>(key: K, value: ExperimentState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }
  function patchRun(id: ProviderId, value: Partial<ProviderRun>) {
    if (!fixtureReady && !state.runs[id].response.trim()) return;
    setState(prev => {
      const old = prev.runs[id];
      const resetVerdict = "response" in value || "finalAnswer" in value;
      const nextVerdict = "verdict" in value ? (value.verdict || "") : (resetVerdict ? "" : old.verdict);
      return {...prev, runs:{...prev.runs,[id]:{...old,...value,
        ...("response" in value ? {finalAnswer:"",highlight:""} : {}),
        verdict: nextVerdict, reviewed: Boolean(nextVerdict)
      }}};
    });
  }
  function updateGroundTruth(next: string) {
    setState(prev=>({...prev,groundTruth:next,
      runs:next!==prev.groundTruth?Object.fromEntries(PROVIDERS.map(p=>[p.id,{
        ...prev.runs[p.id], verdict:"", reviewed:false
      }])) as ExperimentState["runs"]:prev.runs}));
  }

  function hasResponses() { return PROVIDERS.some(p => state.runs[p.id].response.trim()); }
  function updateQuestion(next: string) {
    if (next !== state.testQuestion && hasResponses() && !window.confirm("공통 질문을 바꾸면 이전 실험과 조건이 달라집니다. 이미 저장된 AI 답변·판정을 초기화할까요?")) return;
    setState(prev => ({ ...prev, testQuestion: next, commonPrompt:"", runs: next !== prev.testQuestion && hasResponses() ? {chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()} : prev.runs }));
  }
  function updateCommonPrompt(next: string) {
    if (next !== state.commonPrompt && hasResponses() && !window.confirm("AI에 전달할 공통 프롬프트를 변경하면 기존 답변과 비교할 수 없습니다. 이전 답변을 초기화할까요?")) return;
    setState(prev => ({ ...prev, commonPrompt:next, runs: next !== prev.commonPrompt && hasResponses() ? {chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()} : prev.runs }));
  }
  function updateMaterial(next: string) {
    if (next !== state.material && hasResponses() && !window.confirm("AI에게 제공할 텍스트 자료를 바꾸면 답변 기록이 초기화됩니다. 계속할까요?")) return;
    setState(prev=>({...prev,material:next,runs:next!==prev.material && hasResponses()?{chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()}:prev.runs}));
  }
  function changeFixtureMode(next: ExperimentState["fixtureMode"]) {
    if (state.fixtureMode === next) return;
    if (hasResponses() && !window.confirm("테스트 자료 방식을 변경하면 수집한 AI 답변이 초기화됩니다. 계속할까요?")) return;
    setState(prev => ({...prev,fixtureMode:next,sourceVerified:false,
      runs:{chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()}}));
  }
  function applyPacket(packet: typeof FAKE_COUNTRY_PACKET, preset = false) {
    if (!preset && packet.title && packet.title.trim().toLowerCase() !== state.title.trim().toLowerCase()) {
      setNotice("Work의 JSON 제목이 현재 실험과 다릅니다. 같은 PDF에서 나온 비공개 정답표인지 확인해 주세요."); return;
    }
    if (!preset && mismatchedExperimentQuestion(state.title, packet.testQuestion)) {
      setNotice("가져온 질문이 현재 실험 주제와 맞지 않습니다."); return;
    }
    const promptChanged = preset || packet.testQuestion !== state.testQuestion ||
      (state.fixtureMode === "text" && packet.material !== state.material);
    if (hasResponses() && promptChanged && !window.confirm("Work의 JSON에 기존 테스트와 다른 질문·자료가 있습니다. 지금 가져오면 기존 AI 답변이 초기화됩니다. 계속할까요?")) return;
    setState(prev => ({ ...prev, title: packet.title || prev.title,
      testQuestion: packet.testQuestion, material: packet.material, hiddenTwist: packet.hiddenTwist,
      groundTruth: packet.groundTruth, sources: packet.sources,
      sourceStatus: packet.sourceStatus, sourceVerified: false, lockedAt: "", commonPrompt: promptChanged ? "" : prev.commonPrompt,
      fixtureMode: preset ? "text" : prev.fixtureMode, pdf: preset ? null : prev.pdf,
      runs: promptChanged ? { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() } : (packet.groundTruth !== prev.groundTruth ? Object.fromEntries(PROVIDERS.map(p=>[p.id,{...prev.runs[p.id],verdict:"" as const,reviewed:false}])) as ExperimentState["runs"] : prev.runs) }));
    setNotice(preset ? "텍스트 예제 입력 완료. PDF 실험과는 별개입니다." :
      (hasResponses() && !promptChanged ? "기존 세 AI 답변은 유지하고 비공개 정답·출처만 가져왔습니다." : "Work 질문·비공개 정답·출처를 가져왔습니다. PDF와 질문이 맞는지 확인하세요."));
  }
  function importPacket() {
    const parsed = parseExperimentPacket(packetInput);
    if (!parsed.packet) { setNotice(parsed.error); return; }
    applyPacket(parsed.packet);
  }
  async function uploadPdf(file: File | null) {
    if (!file || pdfBusy) return;
    setPdfBusy(true);
    try {
      const meta = await storeExperimentPdf(file);
      const isIdentical = meta.sha256 === state.pdf?.sha256 && state.fixtureMode === "pdf";
      if (!isIdentical && hasResponses() && !window.confirm("기존 PDF와 다른 파일입니다. PDF가 바뀌면 세 AI의 답변과 판정도 초기화해야 합니다. 계속할까요?")) {
        setNotice("PDF 변경을 취소했습니다. 기존 AI 답변은 그대로 보관됩니다."); return;
      }
      setPdfAvailable(true);
      setState(prev => ({ ...prev, fixtureMode: "pdf", pdf: meta,
        sourceVerified: isIdentical ? prev.sourceVerified : false,
        lockedAt: "",
        runs: isIdentical ? prev.runs : {chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()} }));
      setNotice(isIdentical ? "동일 PDF 재등록 완료. 기존 AI 답변은 유지됩니다." :
        "PDF 등록 완료. 공통 질문을 확인하고 세 AI 답변을 받아오세요. 정답 입력은 나중에 해도 됩니다.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "PDF 등록 실패"); }
    finally { setPdfBusy(false); }
  }
  async function accessPdf(download: boolean) {
    if (!state.pdf) return;
    try {
      const blob = await getExperimentPdf(state.pdf.sha256);
      if (!blob) { setPdfAvailable(false); setNotice("저장된 PDF 원본을 찾을 수 없습니다. 같은 PDF를 다시 등록하세요."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      if (download) { a.download = state.pdf.name; } else {a.target = "_blank"; a.rel="noopener noreferrer";}
      document.body.appendChild(a); a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch { setNotice("PDF 원본을 열지 못했습니다. 이 브라우저의 IndexedDB 저장소를 확인하세요."); }
  }
  async function exportEvidenceZip() {
    if (!fixtureReady || archiving) return;
    setArchiving(true);
    try {
      const zip = new JSZip();
      if (state.fixtureMode === "pdf") {
        const blob = state.pdf ? await getExperimentPdf(state.pdf.sha256) : null;
        if (!blob || !state.pdf) throw new Error("PDF 원본을 찾을 수 없습니다.");
        zip.file("01_BLIND_TEST/" + state.pdf.name, blob);
      } else zip.file("01_BLIND_TEST/material.txt", state.material);
      zip.file("02_EXACT_TEST_QUESTION.txt", commonPrompt);
      zip.file("03_PRIVATE_ANSWER_KEY_DO_NOT_UPLOAD.txt", ["Title: "+state.title,
        "Ground Truth: "+state.groundTruth,"Hidden twist: "+state.hiddenTwist,
        "Sources and derivation: "+state.sources,"Answer key came from original Work fixture; no site lock required."].join("\n\n"));
      PROVIDERS.forEach(p=>{const r=state.runs[p.id];zip.file("04_ORIGINAL_AI_ANSWERS/"+p.id+".txt",
        "Model: "+(r.model||"not recorded")+"\nDate: "+(r.testedAt||"not recorded")+
        "\nSame PDF verified by operator: "+(r.usedSamePdf?"yes":"not verified")+"\n\n"+(r.response||"NO ANSWER COLLECTED"));});
      zip.file("05_OPERATOR_RESULTS/report.txt",report);
      zip.file("05_OPERATOR_RESULTS/records.json",JSON.stringify(state,null,2));
      zip.file("06_BLOGGER/article_request.txt",articlePrompt);
      zip.file("README.txt","PRIVATE EVIDENCE ARCHIVE. Never give the whole ZIP or the PRIVATE answer key to a test AI before collecting replies. Only submit the identical blind PDF and exact question. PDF file integrity is recorded by SHA-256; the operator must actually attach the same file to each model. Original responses are manually pasted, never fabricated.");
      const archive=await zip.generateAsync({type:"blob"});
      const url=URL.createObjectURL(archive),a=document.createElement("a");
      a.href=url;a.download=(slugify(state.title)||"ai-world-experiment")+"-evidence.zip";a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setNotice("PDF·비공개 정답·질문·원문 답변·블로그 요청서를 ZIP으로 보관했습니다.");
    }catch(e){setNotice(e instanceof Error?e.message:"ZIP 백업 실패");}
    finally{setArchiving(false);}
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setNotice(label + " 복사 완료"); }
    catch { setNotice("복사 실패 · 브라우저 클립보드 권한을 확인하세요."); }
  }
  function openPrompt(text: string) {
    const encoded = encodeURIComponent(text);
    if (encoded.length > 7000) {
      void navigator.clipboard.writeText(text);
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      setNotice("긴 요청서를 복사했습니다. 열린 ChatGPT에서 Ctrl+V 하세요.");
    } else {
      window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
    }
  }
  function loadStarter(index: number) {
    if ((state.pdf || state.material.trim() || hasResponses()) && !window.confirm("다른 실험으로 변경하면 현재 화면의 자료·답변이 초기화됩니다. 필요하면 먼저 ZIP으로 백업하세요. 계속할까요?")) return;
    const item = STARTERS[index];
    setState(prev => ({
      ...prev,
      scheduleId: "",
      scheduleDate: "",
      title: item.title,
      category: item.category,
      hook: item.hook,
      keyword: item.keyword,
      testQuestion: suggestedExperimentQuestion(item.title),
      material: "",
      fixtureMode: "pdf",
      pdf: null,
      hiddenTwist: "",
      groundTruth: "",
      sources: "",
      sourceVerified: false,
      sourceStatus: "needs_verification",
      lockedAt: "",
      commonPrompt: "",
      runs: { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() },
    }));
    setPacketInput("");
    setNotice("실험 아이디어를 불러왔습니다. STEP 02에서 실험 자료부터 준비하세요.");
  }
  function sendToQueue() {
    if (!allScored) {
      setNotice("세 AI의 답변과 판정, Work에서 정한 비공개 정답 및 출처를 입력한 뒤 글을 제작할 수 있습니다.");
      return;
    }
    const pending = {
      id: state.scheduleId || ("world-exp-" + Date.now()),
      kind: "experiment",
      date: state.scheduleDate || today(),
      title: state.title,
      keyword: state.keyword || "AI experiment",
      slug: slugify(state.title),
      note: "Global curiosity experiment · Work-precommitted ground truth entered for final comparison · ChatGPT/Claude/Gemini tested with common fixture",
      labVersion: "WORLD-LAB-V1",
      labReport: report,
      labPrompt: articlePrompt,
      experimentCategory: state.category,
      experimentHook: state.hook,
    };
    try {
      localStorage.setItem(QUEUE_TRANSFER_KEY, JSON.stringify(pending));
      window.location.href = "/google-blog-schedule?fromLab=1";
    } catch {
      setNotice("발행 큐 전달 실패 · 브라우저 저장소를 확인하세요.");
    }
  }
  function reset() {
    if (!window.confirm("현재 실험 설계와 AI 답변을 모두 초기화할까요?")) return;
    setState(emptyState());
    setActiveProvider("chatgpt");
  }

  const run = state.runs[activeProvider];

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <a href="/google-blog-schedule">← Google Blog 제작실</a>
      <div>
        <a href="/google-blog-schedule/lab">숫자·PDF 검증실</a>
        <span>자동 저장</span>
      </div>
    </header>

    <section className={styles.hero}>
      <span>GLOBAL AI EXPERIMENT STUDIO</span>
      <h1>전 세계가 궁금해할<br/>엉뚱한 AI 실험을 만듭니다.</h1>
      <p>나라·지도·음식·언어·동물·날씨·가격·통계처럼 누구나 이해할 수 있는 자료로 AI를 시험하고, Ground Truth와 실제 답변을 근거로 영어 글을 만듭니다.</p>
      <div className={styles.heroBadges}><b>정답은 마지막에 입력</b><b>Same prompt</b><b>3 AI answers</b><b>Global curiosity</b></div>
    </section>

    {notice && <div className={styles.notice}>{notice}<button onClick={() => setNotice("")}>×</button></div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 01</span><h2>실험 주제 고르기</h2><p>검색형 정보글보다 “이걸 AI가 맞힐까?”라는 호기심을 먼저 만듭니다.{state.scheduleId ? " · 발행리스트에서 선택한 주제를 작업 중입니다." : ""}</p></div>
        <div className={styles.actions}>
          <button onClick={() => void copy(buildIdeaPrompt(), "글로벌 실험 주제 요청서")}>주제 10개 요청서 복사</button>
          <button className={styles.primary} onClick={() => openPrompt(buildIdeaPrompt())}>GPT에서 아이디어 찾기</button>
        </div>
      </div>
      <div className={styles.starters}>
        {STARTERS.map((item, index) => <button key={item.title} onClick={() => loadStarter(index)}>
          <small>{item.category}</small><strong>{item.title}</strong><span>{item.hook}</span>
        </button>)}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 02</span><h2>Work에서 만든 PDF 한 장 등록</h2><p>Work에서 내려받을 파일은 블라인드 PDF 1개면 됩니다. 비공개 정답·출처·공통 질문은 Work 답변의 JSON 텍스트를 복사해 보관합니다.</p></div><em className={state.fixtureMode==="pdf"?(state.pdf&&pdfAvailable?styles.good:styles.wait):(state.material.trim()?styles.good:styles.wait)}>{state.fixtureMode==="pdf"?(state.pdf&&pdfAvailable?"PDF 원본 등록됨":"PDF 원본 필요"):(state.material.trim()?"텍스트 자료 준비됨":"텍스트 자료 필요")}</em></div>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={() => void copy(buildWorkPdfRequest(state), "Work용 PDF 제작 요청서")}>① Work용 PDF 제작 요청서 복사</button>
        <button onClick={() => void copy(buildPacketRequest(state), "텍스트 실험 자료 제작 요청서")}>텍스트만 쓰는 경우 요청서 복사</button>
      </div>
      <p>ChatGPT <strong>Work 모드</strong>에서 <strong>blind_test.pdf 한 개만</strong> 내려받으세요. Work가 채팅에 표시한 비공개 JSON은 아래 칸에 복사합니다. 세 AI에는 PDF와 공통 질문만 전달하고 JSON은 보여주지 않습니다.</p>
      <div className={styles.fixtureChoice}>
        <label><input type="radio" name="fixtureMode" checked={state.fixtureMode==="pdf"} onChange={()=>setState(prev=>({...prev,fixtureMode:"pdf",sourceVerified:false}))} /> PDF 실험 (권장)</label>
        <label><input type="radio" name="fixtureMode" checked={state.fixtureMode==="text"} onChange={()=>setState(prev=>({...prev,fixtureMode:"text",sourceVerified:false}))} /> 텍스트 실험</label>
      </div>
      {state.fixtureMode==="pdf" ? <div className={styles.pdfPanel}>
        <label><strong>② Work에서 받은 원본 PDF 업로드</strong>
          <input type="file" accept=".pdf,application/pdf" disabled={pdfBusy} onChange={e=>{void uploadPdf(e.target.files?.[0] || null);e.currentTarget.value="";}} />
        </label>
        {state.pdf ? <div className={styles.pdfMeta}><strong>{state.pdf.name}</strong><span>{state.pdf.bytes.toLocaleString()} bytes · SHA-256: <code>{state.pdf.sha256}</code></span>
          <div className={styles.actions}><button disabled={!pdfAvailable} onClick={()=>void accessPdf(false)}>PDF 열어보기</button><button disabled={!pdfAvailable} onClick={()=>void accessPdf(true)}>동일 PDF 다운로드 ↓</button></div>
          {!pdfAvailable && <small>이 브라우저에서 원본 파일이 확인되지 않습니다. PDF를 다시 업로드하세요.</small>}
        </div> : <p>PDF를 업로드하면 브라우저에 파일을 저장하고 SHA-256 지문을 기록합니다. 서버로 전송하지 않습니다.</p>}
      </div> : <div className={styles.actions}>
        {(state.title===FAKE_COUNTRY_TITLE || state.title.toLowerCase().includes("10 countries")) && <button onClick={()=>applyPacket(FAKE_COUNTRY_PACKET,true)}>텍스트 국가 10개 예제 채우기</button>}
      </div>}
      <details className={styles.advanced}>
        <summary>선택 기능 · Work 비공개 JSON 가져오기</summary>
        <p className={styles.muted}>필수 단계가 아닙니다. Work 답변에서 JSON을 복사하면 질문·정답·출처가 자동으로 채워집니다. 정답만 나중에 입력해도 됩니다.</p>
        <label className={styles.field}><span>Work의 비공개 [EXPERIMENT_PACKET_JSON] 블록</span><textarea value={packetInput} onChange={e=>setPacketInput(e.target.value)} placeholder="[EXPERIMENT_PACKET_JSON] ... [/EXPERIMENT_PACKET_JSON]" /></label>
        <div className={styles.actions}><button disabled={!packetInput.trim()} onClick={importPacket}>질문·정답·출처 자동 입력</button></div>
      </details>
      <p>Work에서 정답은 PDF 제작 시 확정해 보관하세요. 사이트에는 세 AI의 답변을 모은 후 입력해도 됩니다. AI에 정답표를 보여주지 마세요.</p>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 03</span><h2>공통 질문 설정</h2><p>PDF에 맞는 질문을 확인하세요. 정답을 입력하거나 잠그지 않아도 실험할 수 있습니다.</p></div><em className={fixtureReady?styles.good:styles.wait}>{fixtureReady?"✓ 실험 준비됨":"PDF·질문 확인 필요"}</em></div>
      <details className={styles.advanced}><summary>제목 · 카테고리 · 키워드 · 후킹 포인트 수정 (선택)</summary>
        <div className={styles.grid2}>
          <label><span>영문 제목</span><input value={state.title} onChange={e=>patch("title",e.target.value)} /></label>
          <label><span>카테고리</span><input value={state.category} onChange={e=>patch("category",e.target.value)} /></label>
          <label><span>검색 문구</span><input value={state.keyword} onChange={e=>patch("keyword",e.target.value)} /></label>
          <label><span>후킹 포인트</span><input value={state.hook} onChange={e=>patch("hook",e.target.value)} /></label>
        </div>
      </details>
      <label className={styles.field}><span>AI에게 물을 영어 질문</span><textarea value={state.testQuestion} onChange={e=>updateQuestion(e.target.value)} placeholder={suggestedQuestion || "이 PDF에 맞는 영어 질문을 입력하세요."} /></label>
      {suggestedQuestion && <div className={styles.actions}><button onClick={()=>updateQuestion(suggestedQuestion)}>현재 주제의 추천 질문 사용</button></div>}
      {mismatchedQuestion && <p className={styles.questionWarning} role="alert">실험 주제와 질문이 다릅니다. 영수증 PDF로 가짜 국가 찾기 질문을 내면 올바른 실험이 아닙니다.</p>}
      {!noKeyLeak && <p className={styles.questionWarning} role="alert">질문이나 PDF 파일명에서 비공개 정답이 노출될 위험이 있습니다. 확인해 주세요.</p>}
      {state.fixtureMode==="text" && <label className={styles.field}><span>AI에게 보여줄 텍스트 자료</span><textarea value={state.material} onChange={e=>updateMaterial(e.target.value)} placeholder="실제 테스트에 전달할 텍스트 자료" /></label>}
      <p className={styles.muted}>PDF 실험에서는 별도의 텍스트 자료를 복사할 필요가 없습니다. 정답은 STEP 05에서 입력합니다.</p>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 04</span><h2>ChatGPT · Claude · Gemini 답변 모으기</h2><p>PDF와 질문을 똑같이 제공하고 실제 원문을 붙여넣으세요. 정답은 아직 필요 없습니다.</p></div><strong>{completed}/3 답변</strong></div>
      <label className={styles.field}><span>공통 테스트 프롬프트 · 비어 있으면 아래 예시가 자동 적용됩니다</span><textarea value={state.commonPrompt} onChange={e=>updateCommonPrompt(e.target.value)} placeholder={defaultCommonPrompt(state)} /></label>
      <div className={styles.actions}>
        <button disabled={!fixtureReady} onClick={() => void copy(commonPrompt, "공통 테스트 프롬프트")}>공통 질문 복사</button>
        {state.fixtureMode==="pdf" && <button disabled={!fixtureReady || !pdfAvailable} onClick={()=>void accessPdf(true)}>세 AI에게 줄 동일 PDF 다운로드</button>}
        {!fixtureReady && <small>PDF 또는 텍스트 자료와 공통 질문을 확인하면 바로 테스트할 수 있습니다.</small>}
      </div>
      <div className={styles.providerTabs}>
        {PROVIDERS.map(p => <button key={p.id} className={activeProvider===p.id?styles.providerActive:""} onClick={()=>setActiveProvider(p.id)}>
          <strong>{p.label}</strong><small>{state.runs[p.id].response.trim() ? "답변 저장됨" : "대기"}</small>
        </button>)}
      </div>
      <div className={styles.providerBox}>
        <div className={styles.providerHead}><h3>{PROVIDERS.find(p=>p.id===activeProvider)?.label}</h3><a href={PROVIDERS.find(p=>p.id===activeProvider)?.url} target="_blank" rel="noopener noreferrer">AI 사이트 열기 ↗</a></div>
        <label><span>표시된 모델명</span><input disabled={!fixtureReady} value={run.model} onChange={e=>patchRun(activeProvider,{model:e.target.value})} placeholder="서비스 화면에 표시된 실제 모델명" /></label>
        <label className={styles.field}><span>실험 날짜</span><input disabled={!fixtureReady} type="date" value={run.testedAt} onChange={e=>patchRun(activeProvider,{testedAt:e.target.value})} /></label>
        {state.fixtureMode==="pdf" && <label className={styles.checkLine}><input type="checkbox" disabled={!fixtureReady} checked={run.usedSamePdf} onChange={e=>patchRun(activeProvider,{usedSamePdf:e.target.checked})}/><span>위 사이트의 <strong>{PROVIDERS.find(p=>p.id===activeProvider)?.label}</strong> 새 채팅에, 위의 동일 PDF를 첨부하고 공통 질문을 입력했습니다.</span></label>}
        <label className={styles.field}><span>AI 실제 답변 전체</span><textarea disabled={!fixtureReady} className={styles.answer} value={run.response} onChange={e=>patchRun(activeProvider,{response:e.target.value})} placeholder="받은 답변을 그대로 붙여넣기" /></label>
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 05</span><h2>정답 입력 · 세 AI 결과 비교</h2><p>세 AI의 실제 답변을 모은 뒤 Work에서 PDF 제작 때 미리 정한 정답을 입력하세요. 사이트에서 따로 잠글 필요는 없습니다.</p></div><em className={allScored?styles.good:styles.wait}>{allScored?"✓ 결과 비교 완료":"정답·결과 확인"}</em></div>
      <div className={styles.truthGrid}>
        <label><span>정답 (Work에서 PDF 제작할 때 확정한 원래 답)</span><textarea value={state.groundTruth} onChange={e=>updateGroundTruth(e.target.value)} placeholder="예: 국기 문제라면 가상 국가의 번호·이름. 영수증 문제라면 사전 결정된 국가·근거." /></label>
        <label><span>정답 출처·근거</span><textarea value={state.sources} onChange={e=>patch("sources",e.target.value)} placeholder="Work 원본 답안의 공식 출처 URL, 제작 근거, 판정 기준과 검증이 필요한 점을 입력하세요." /></label>
      </div>
      <details className={styles.advanced}><summary>실험의 숨은 설정 메모 (선택)</summary>
        <label className={styles.field}><span>비공개 트릭 · 테스트 AI에게 전달하지 않음</span><textarea value={state.hiddenTwist} onChange={e=>patch("hiddenTwist",e.target.value)} placeholder="필요할 때만 기록" /></label>
      </details>
      {!keyReady && <p className={styles.muted}>답변 수집에는 필요하지 않습니다. 최종 글을 만들 때 Work의 원래 정답과 근거를 입력하세요.</p>}
      <div className={styles.scoreCards}>
        {PROVIDERS.map(p => {
          const r=state.runs[p.id];
          return <article key={p.id}>
            <h3>{p.label}</h3>
            <label><span>AI가 고른 답 (선택)</span><input disabled={!r.response.trim()} value={r.finalAnswer} onChange={e=>patchRun(p.id,{finalAnswer:e.target.value})} placeholder="예: 7. Norvessa" /></label>
            <label><span>실제 원문과 정답을 비교한 판정 (필수)</span><select disabled={!keyReady || !r.response.trim()} value={r.verdict} onChange={e=>patchRun(p.id,{verdict:e.target.value as ProviderRun["verdict"]})}>
              <option value="">판정을 선택하세요</option><option value="correct">정답</option><option value="incorrect">오답</option><option value="partial">부분 정답</option><option value="uncertain">판정 보류</option>
            </select></label>
            <label><span>독자에게 보여줄 흥미로운 원문 인용 (선택)</span><textarea disabled={!r.response.trim()} value={r.highlight} onChange={e=>patchRun(p.id,{highlight:e.target.value})} placeholder="실제 AI 답변에서 문장을 그대로 복사하세요. 새로운 해석이나 추측으로 바꾸지 마세요." /></label>
            {r.highlight && r.response && !r.response.includes(r.highlight.trim()) && <small className={styles.quoteWarn}>선택한 인용 문구가 답변 원문에 정확히 일치하지 않습니다. 확인해 주세요.</small>}
            <label><span>결과 메모 (선택)</span><textarea disabled={!r.response.trim()} value={r.notes} onChange={e=>patchRun(p.id,{notes:e.target.value})} placeholder="이 AI가 어떤 단서로 판단했는지 / 다른 AI와 어떤 점이 달랐는지 원문에 근거하여 기록" /></label>
            <details className={styles.advanced}><summary>추가 세부 평가 (선택)</summary>
              <div className={styles.scoreGrid}>
                <label><span>정확도 /10</span><input disabled={!r.response.trim()} type="number" min="0" max="10" value={r.accuracy ?? ""} onChange={e=>patchRun(p.id,{accuracy:e.target.value === "" ? null : Number(e.target.value)})}/></label>
                <label><span>지시 준수 /10</span><input disabled={!r.response.trim()} type="number" min="0" max="10" value={r.instruction ?? ""} onChange={e=>patchRun(p.id,{instruction:e.target.value === "" ? null : Number(e.target.value)})}/></label>
                <label><span>환각 개수</span><input disabled={!r.response.trim()} type="number" min="0" value={r.hallucinations ?? ""} onChange={e=>patchRun(p.id,{hallucinations:e.target.value === "" ? null : Number(e.target.value)})}/></label>
              </div>
              <label><span>실제로 관찰한 특이한 오류</span><textarea disabled={!r.response.trim()} value={r.weirdestMistake} onChange={e=>patchRun(p.id,{weirdestMistake:e.target.value})} placeholder="없으면 공란으로 둡니다." /></label>
            </details>
            <small className={styles.muted}>원래 정답과 원문을 비교해 판정을 선택하면 자동으로 저장됩니다. 추가 확인 체크는 필요 없습니다.</small>
          </article>;
        })}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 06</span><h2>세 AI의 실제 답변으로 영문 글 만들기</h2><p>독자에게 먼저 문제를 보여주고 → 세 AI의 선택과 원문 이유를 비교하고 → 마지막에 정답과 뜻밖의 반응을 공개하는 글 요청서를 만듭니다.</p></div></div>
      <div className={styles.summaryRow}>{PROVIDERS.map(p=>{const r=state.runs[p.id];return <div key={p.id}><strong>{p.label}</strong><span>{r.reviewed && r.verdict ? {correct:"정답",incorrect:"오답",partial:"부분 정답",uncertain:"판정 보류"}[r.verdict] : "답변 또는 검토 필요"}</span><small>{r.finalAnswer || "선택한 답 미기록"}</small></div>})}</div>
      <div className={styles.actions}>
        <button disabled={!allScored} onClick={()=>void copy(report,"실험 검증 리포트")}>검증 리포트 복사</button>
        <button disabled={!allScored} onClick={()=>void copy(articlePrompt,"영문 Blogger 요청서")}>영문 글 요청서 복사</button>
        <button className={styles.primary} disabled={!allScored} onClick={()=>openPrompt(articlePrompt)}>GPT에서 최종 글 만들기</button>
        <button className={styles.queue} disabled={!allScored} onClick={sendToQueue}>최종 글 제작을 발행리스트로 보내기 →</button>
        <button disabled={!fixtureReady || archiving || (state.fixtureMode==="pdf" && !pdfAvailable)} onClick={()=>void exportEvidenceZip()}>비공개 원본·PDF·답변 ZIP 백업 ↓</button>
      </div>
      <details className={styles.preview}><summary>검증 리포트 미리보기</summary><pre>{report}</pre></details>
      <details className={styles.preview}><summary>최종 글 요청서 미리보기</summary><textarea readOnly value={articlePrompt}/></details>
      <div className={styles.resetRow}><button onClick={reset}>현재 실험 초기화</button><small>실험 설계와 답변은 이 브라우저에 자동 저장됩니다.</small></div>
    </section>
  </main>;
}
