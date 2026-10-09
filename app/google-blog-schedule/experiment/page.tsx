"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";
import { FAKE_COUNTRY_PACKET, FAKE_COUNTRY_TITLE, buildPacketRequest, parseExperimentPacket, buildBlindPrompt, canLockExperiment, buildWorkPdfRequest } from "@/lib/ai-world-experiment-packet.mjs";
import { storeExperimentPdf, getExperimentPdf } from "@/lib/ai-world-experiment-files.mjs";
import type { PdfMeta } from "@/lib/ai-world-experiment-files.mjs";

type ProviderId = "chatgpt" | "claude" | "gemini";
type ProviderRun = {
  model: string;
  testedAt: string;
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
  return { model: "", testedAt:"", response: "", finalAnswer:"", verdict:"", highlight:"", accuracy: null, instruction: null, hallucinations: null, reviewed: false, weirdestMistake: "", notes: "" };
}
function emptyState(): ExperimentState {
  return {
    scheduleId: "",
    scheduleDate: "",
    title: STARTERS[0].title,
    category: STARTERS[0].category,
    hook: STARTERS[0].hook,
    keyword: STARTERS[0].keyword,
    testQuestion: "",
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
  return buildBlindPrompt({testQuestion:s.testQuestion, material:s.fixtureMode==="pdf" ? "Analyze the same attached PDF provided with this prompt. Use the numbered entries exactly as shown. If the attachment is missing or unreadable, say so." : s.material});
}

function reportText(s: ExperimentState) {
  const rows = PROVIDERS.map(p => {
    const r = s.runs[p.id];
    return [
      p.label + (r.model ? " ("+r.model+")" : ""),
      "Review status: " + (r.reviewed ? "Operator reviewed" : "NOT REVIEWED"),
      "Test date: " + (r.testedAt || "not recorded"),
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
    "AI WORLD EXPERIMENT — VERIFIED REPORT",
    "Date: " + today(),
    "Pre-answer fixture locked: " + (s.lockedAt || "NOT LOCKED"),
    "Fixture mode: " + s.fixtureMode,
    "Attached PDF: " + (s.pdf ? s.pdf.name + " | sha256=" + s.pdf.sha256 + " | bytes=" + s.pdf.bytes : "none"),
    "PDF must be attached separately when testing and uploaded separately if publishing. This report does not include the PDF bytes.",
    "Evidence manually verified: " + (s.sourceVerified ? "yes" : "no"),
    "Experiment status: " + (s.lockedAt && PROVIDERS.every(p => s.runs[p.id].response.trim() && s.runs[p.id].reviewed && s.runs[p.id].verdict) ? "COMPLETE" : "INCOMPLETE — DO NOT PUBLISH"),
    "Title: " + s.title,
    "Category: " + s.category,
    "Hook: " + s.hook,
    "",
    "TEST QUESTION",
    s.testQuestion || s.title,
    "",
    "WHAT THE AI SAW",
    s.material || "Not recorded",
    "",
    "HIDDEN TWIST",
    s.hiddenTwist || "None",
    "",
    "GROUND TRUTH — established before judging model answers",
    s.groundTruth || "NOT RECORDED",
    "",
    "GROUND-TRUTH SOURCES",
    s.sources || "Not recorded",
    "",
    "MODEL RESULTS",
    rows,
    "",
    "IMPORTANT LIMIT",
    "Scores are the operator's recorded evaluation for this single experiment. Do not generalize them into an overall model ranking.",
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

[VERIFIED EXPERIMENT RECORD]
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
The PDF is a local fixture, not an online link: do not fabricate a public PDF URL or claim it is embedded in Blogger HTML.
Do not change the operator's recorded scoring.
If one field is missing, omit it or clearly label it as not recorded.

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
  const sourceReady = canLockExperiment({ ...state, material: state.fixtureMode === "pdf" ? (state.pdf?.sha256 || "") : state.material }) && (state.fixtureMode !== "pdf" || (Boolean(state.pdf) && pdfAvailable));
  const noKeyLeak = !((state.groundTruth.trim() && commonPrompt.includes(state.groundTruth.trim())) || (state.hiddenTwist.trim() && commonPrompt.includes(state.hiddenTwist.trim()))) && !(state.fixtureMode === "pdf" && /answer|solution|private|norvessa|fake/i.test(state.pdf?.name || ""));
  const lockReady = sourceReady && noKeyLeak;
  const truthReady = Boolean(state.lockedAt && lockReady);
  const allScored = truthReady && PROVIDERS.every(p => {
    const r = state.runs[p.id];
    return Boolean(r.response.trim() && r.reviewed && r.verdict);
  });

  function patch<K extends keyof ExperimentState>(key: K, value: ExperimentState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }
  function patchRun(id: ProviderId, value: Partial<ProviderRun>) {
    if (!state.lockedAt) return;
    setState(prev => ({ ...prev, runs: { ...prev.runs, [id]: { ...prev.runs[id], ...value, ...("response" in value ? {verdict:"" as const,finalAnswer:"",highlight:""} : {}), reviewed: "response" in value ? false : ("reviewed" in value ? Boolean(value.reviewed) : prev.runs[id].reviewed) } } }));
  }
  function applyPacket(packet: typeof FAKE_COUNTRY_PACKET, preset = false) {
    if (state.lockedAt) { setNotice("잠긴 실험의 자료는 수정할 수 없습니다. 먼저 잠금을 해제하세요."); return; }
    if (PROVIDERS.some(p => state.runs[p.id].response.trim()) && !window.confirm("새 자료로 바꾸면 기존 AI 답변과 채점이 초기화됩니다. 계속할까요?")) return;
    setState(prev => ({ ...prev, title: packet.title || prev.title,
      testQuestion: packet.testQuestion, material: packet.material, hiddenTwist: packet.hiddenTwist,
      groundTruth: packet.groundTruth, sources: packet.sources,
      sourceStatus: packet.sourceStatus, sourceVerified: preset, lockedAt: "", commonPrompt: "", fixtureMode:"text", pdf:null,
      runs: { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() } }));
    setNotice(preset ? "검증된 국가 목록·정답표·출처를 채웠습니다. 잠그면 실험을 시작할 수 있습니다." : "실험 패킷을 가져왔습니다. 근거를 직접 확인하고 체크한 뒤 잠그세요.");
  }
  function importPacket() {
    const parsed = parseExperimentPacket(packetInput);
    if (!parsed.packet) { setNotice(parsed.error); return; }
    applyPacket(parsed.packet);
  }
  function lockExperiment() {
    if (!lockReady) { setNotice("테스트 자료·질문·정답·출처를 채우고 근거를 직접 확인하세요. 정답이 공통 질문에 노출되어도 안 됩니다."); return; }
    setState(prev => ({ ...prev, lockedAt: new Date().toISOString(), runs: { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() } }));
    setNotice("실험 자료와 Ground Truth를 잠갔습니다. 이제 세 AI에 동일한 공통 질문을 전달하세요.");
  }
  function unlockExperiment() {
    if (!window.confirm("잠금을 해제하면 이 실험의 AI 답변과 채점 기록을 초기화합니다. 먼저 별도로 백업했나요?")) return;
    setState(prev => ({ ...prev, lockedAt: "", runs: { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() } }));
    setNotice("잠금을 해제했습니다. 자료를 수정하고 다시 잠그세요.");
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
    if ((state.lockedAt || state.material.trim() || PROVIDERS.some(p => state.runs[p.id].response.trim())) && !window.confirm("다른 실험을 선택하면 현재 자료·답변·채점이 초기화됩니다. 계속할까요?")) return;
    const item = STARTERS[index];
    setState(prev => ({
      ...prev,
      scheduleId: "",
      scheduleDate: "",
      title: item.title,
      category: item.category,
      hook: item.hook,
      keyword: item.keyword,
      testQuestion: "",
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
    if (!truthReady || !allScored) {
      setNotice("검증된 Ground Truth 잠금과 실제 AI 답변·채점 확인까지 마쳐야 발행할 수 있습니다.");
      return;
    }
    const pending = {
      id: state.scheduleId || ("world-exp-" + Date.now()),
      kind: "experiment",
      date: state.scheduleDate || today(),
      title: state.title,
      keyword: state.keyword || "AI experiment",
      slug: slugify(state.title),
      note: "Global curiosity experiment · Ground Truth locked before scoring · ChatGPT/Claude/Gemini compared",
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
      <div className={styles.heroBadges}><b>Ground Truth first</b><b>Same prompt</b><b>3 AI answers</b><b>Global curiosity</b></div>
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
      <div className={styles.panelHead}><div><span>STEP 02</span><h2>질문에 맞는 실험 자료 만들기</h2><p>제목만으로는 실험할 수 없습니다. AI에게 보여줄 자료와 비공개 정답표를 별도로 준비합니다.</p></div><em className={state.material.trim() ? styles.good : styles.wait}>{state.material.trim() ? "자료 준비됨" : "자료 없음"}</em></div>
      <div className={styles.actions}>
        {(state.title === FAKE_COUNTRY_TITLE || state.title.toLowerCase().includes("10 countries")) && <button className={styles.primary} disabled={Boolean(state.lockedAt)} onClick={() => applyPacket(FAKE_COUNTRY_PACKET, true)}>국가 9개 + 가상국가 1개 · 예제 자료 즉시 채우기</button>}
        <button disabled={Boolean(state.lockedAt)} onClick={() => void copy(buildPacketRequest(state), "실험 자료 제작 요청서")}>자료·정답 제작 요청서 복사</button>
        <button disabled={Boolean(state.lockedAt)} onClick={() => openPrompt(buildPacketRequest(state))}>GPT에서 실험 자료 만들기 ↗</button>
      </div>
      <label className={styles.field}><span>생성된 EXPERIMENT_PACKET_JSON 가져오기 (선택)</span><textarea disabled={Boolean(state.lockedAt)} value={packetInput} onChange={e => setPacketInput(e.target.value)} placeholder="GPT가 만든 [EXPERIMENT_PACKET_JSON] 블록 전체를 붙여넣으세요. 자동 생성 답변의 사실·출처는 운영자가 다시 확인해야 합니다." /></label>
      <div className={styles.actions}><button disabled={Boolean(state.lockedAt) || !packetInput.trim()} onClick={importPacket}>JSON에서 질문·자료·정답표 채우기</button></div>
      <p>가상 국가 예제는 준비된 목록을 바로 불러올 수 있습니다. 다른 주제는 제작 요청서를 이용해 자료를 만든 뒤 근거를 직접 검증하세요. AI가 만든 자료를 검증 없이 확정하지 않습니다.</p>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 03</span><h2>Ground Truth 검증·잠금</h2><p>자료·정답·출처를 확인하고 잠근 뒤 AI 테스트를 시작합니다. 잠금을 풀면 기존 답변과 점수가 초기화됩니다.</p></div><em className={truthReady ? styles.good : styles.wait}>{truthReady ? "✓ 정답 잠금" : "근거 확인·잠금 필요"}</em></div>
      <div className={styles.grid2}>
        <label><span>영문 제목</span><input disabled={Boolean(state.lockedAt)} value={state.title} onChange={e=>patch("title",e.target.value)} /></label>
        <label><span>카테고리</span><input disabled={Boolean(state.lockedAt)} value={state.category} onChange={e=>patch("category",e.target.value)} /></label>
        <label><span>검색 문구</span><input disabled={Boolean(state.lockedAt)} value={state.keyword} onChange={e=>patch("keyword",e.target.value)} /></label>
        <label><span>후킹 포인트</span><input disabled={Boolean(state.lockedAt)} value={state.hook} onChange={e=>patch("hook",e.target.value)} /></label>
      </div>
      <label className={styles.field}><span>AI에게 물을 질문</span><textarea disabled={Boolean(state.lockedAt)} value={state.testQuestion} onChange={e=>patch("testQuestion",e.target.value)} placeholder="예: Which one of these ten countries is not real? Explain briefly." /></label>
      <label className={styles.field}><span>AI에게 보여줄 자료</span><textarea disabled={Boolean(state.lockedAt)} value={state.material} onChange={e=>patch("material",e.target.value)} placeholder="표, 목록, 데이터, 설명문 등 실제 테스트 재료를 붙여넣기. 이미지/파일을 쓸 경우 여기에는 구성과 출처를 기록." /></label>
      <label className={styles.field}><span>숨겨둔 트릭</span><textarea disabled={Boolean(state.lockedAt)} value={state.hiddenTwist} onChange={e=>patch("hiddenTwist",e.target.value)} placeholder="예: 10개 중 1개는 가짜 국가. 이름은 실제 국가처럼 보이도록 구성." /></label>
      <div className={styles.truthGrid}>
        <label><span>🔒 Ground Truth · 정답</span><textarea disabled={Boolean(state.lockedAt)} value={state.groundTruth} onChange={e=>patch("groundTruth",e.target.value)} placeholder="AI 답변을 보기 전에 정답과 판정 기준을 확정." /></label>
        <label><span>🔗 Ground Truth 출처</span><textarea disabled={Boolean(state.lockedAt)} value={state.sources} onChange={e=>patch("sources",e.target.value)} placeholder="공식/공공/신뢰 가능한 출처 URL과 확인 메모. 한 줄에 하나씩." /></label>
      </div>
      <label className={styles.field}><span>근거 상태: {state.sourceStatus === "verified" ? "사전 확인된 예제" : "검증 필요"}</span><span><input type="checkbox" disabled={Boolean(state.lockedAt)} checked={state.sourceVerified} onChange={e => patch("sourceVerified", e.target.checked)} /> 출처·정답을 직접 확인했으며 테스트 자료에 정답이 노출되지 않았습니다.</span></label>
      <div className={styles.actions}>
        {state.lockedAt ? <button onClick={unlockExperiment}>잠금 해제 (AI 답변·점수 초기화)</button> : <button className={styles.primary} disabled={!lockReady} onClick={lockExperiment}>🔒 자료와 정답표 잠그기 → 테스트 시작</button>}
      </div>
      {!state.lockedAt && <p>자료·질문·정답·근거를 채우고 출처 확인에 체크하면 잠글 수 있습니다. 이미 AI 답변을 받았다면 수정 전에 백업하세요.</p>}
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 04</span><h2>세 AI에 같은 문제 던지기</h2><p>같은 자료와 같은 질문을 사용합니다. 모델이 답한 원문은 요약하지 말고 그대로 보관하세요.</p></div><strong>{completed}/3 답변</strong></div>
      <label className={styles.field}><span>공통 테스트 프롬프트 · {state.lockedAt ? "잠금 완료 · 수정 불가" : "잠그기 전 수정 가능"}</span><textarea disabled={Boolean(state.lockedAt)} value={state.lockedAt ? commonPrompt : state.commonPrompt} onChange={e=>patch("commonPrompt",e.target.value)} placeholder={defaultCommonPrompt(state)} /></label>
      <div className={styles.actions}>
        <button disabled={!truthReady} onClick={() => void copy(commonPrompt, "공통 테스트 프롬프트")}>공통 질문 복사</button>
        {!truthReady && <small>테스트 자료와 정답을 먼저 검증·잠그세요. 빈 자료로 AI에 질문하지 않습니다.</small>}
      </div>
      <div className={styles.providerTabs}>
        {PROVIDERS.map(p => <button key={p.id} className={activeProvider===p.id?styles.providerActive:""} onClick={()=>setActiveProvider(p.id)}>
          <strong>{p.label}</strong><small>{state.runs[p.id].response.trim() ? "답변 저장됨" : "대기"}</small>
        </button>)}
      </div>
      <div className={styles.providerBox}>
        <div className={styles.providerHead}><h3>{PROVIDERS.find(p=>p.id===activeProvider)?.label}</h3><a href={PROVIDERS.find(p=>p.id===activeProvider)?.url} target="_blank" rel="noopener noreferrer">AI 사이트 열기 ↗</a></div>
        <label><span>표시된 모델명</span><input disabled={!truthReady} value={run.model} onChange={e=>patchRun(activeProvider,{model:e.target.value})} placeholder="예: GPT-5.6 / Claude Sonnet / Gemini Pro" /></label>
        <label className={styles.field}><span>AI 실제 답변 전체</span><textarea disabled={!truthReady} className={styles.answer} value={run.response} onChange={e=>patchRun(activeProvider,{response:e.target.value})} placeholder="받은 답변을 그대로 붙여넣기" /></label>
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 05</span><h2>정답 대조 · 점수 기록</h2><p>전체 모델의 우열을 선언하는 점수가 아니라, 이번 한 번의 실험 결과입니다.</p></div><em className={allScored?styles.good:styles.wait}>{allScored?"✓ 채점 완료":"채점 필요"}</em></div>
      <div className={styles.scoreCards}>
        {PROVIDERS.map(p => {
          const r=state.runs[p.id];
          return <article key={p.id}>
            <h3>{p.label}</h3>
            <div className={styles.scoreGrid}>
              <label><span>정확도 /10</span><input disabled={!r.response.trim()} type="number" min="0" max="10" value={r.accuracy ?? ""} onChange={e=>patchRun(p.id,{accuracy:e.target.value === "" ? null : Number(e.target.value), reviewed:false})}/></label>
              <label><span>지시 준수 /10</span><input disabled={!r.response.trim()} type="number" min="0" max="10" value={r.instruction ?? ""} onChange={e=>patchRun(p.id,{instruction:e.target.value === "" ? null : Number(e.target.value), reviewed:false})}/></label>
              <label><span>환각 개수</span><input disabled={!r.response.trim()} type="number" min="0" value={r.hallucinations ?? ""} onChange={e=>patchRun(p.id,{hallucinations:e.target.value === "" ? null : Number(e.target.value), reviewed:false})}/></label>
            </div>
            <label><span>Weirdest Mistake</span><textarea value={r.weirdestMistake} onChange={e=>patchRun(p.id,{weirdestMistake:e.target.value})} placeholder="가장 엉뚱하거나 자신 있게 틀린 부분" /></label>
            <label><span>채점 메모</span><textarea value={r.notes} onChange={e=>patchRun(p.id,{notes:e.target.value,reviewed:false})} placeholder="부분정답, 누락, 애매한 판정 등" /></label>
            <label className={styles.field}><span><input type="checkbox" disabled={!r.response.trim() || !validRunScores(r)} checked={r.reviewed} onChange={e=>patchRun(p.id,{reviewed:e.target.checked})} /> 원문과 정답표를 대조해 이 점수를 직접 확정했습니다. (0점도 유효)</span></label>
          </article>;
        })}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 06</span><h2>영어 글 제작 → 발행 큐</h2><p>The Challenge → AI Answers → Reveal → Scoreboard → Weirdest Mistake → Verdict 흐름으로 자동 요청서를 만듭니다.</p></div></div>
      <div className={styles.actions}>
        <button disabled={!allScored} onClick={()=>void copy(report,"실험 검증 리포트")}>검증 리포트 복사</button>
        <button disabled={!allScored} onClick={()=>void copy(articlePrompt,"영문 Blogger 요청서")}>영문 글 요청서 복사</button>
        <button className={styles.primary} disabled={!allScored} onClick={()=>openPrompt(articlePrompt)}>GPT에서 최종 글 만들기</button>
        <button className={styles.queue} disabled={!truthReady||!allScored} onClick={sendToQueue}>검증된 실험을 발행 큐로 등록 →</button>
      </div>
      <details className={styles.preview}><summary>검증 리포트 미리보기</summary><pre>{report}</pre></details>
      <details className={styles.preview}><summary>최종 글 요청서 미리보기</summary><textarea readOnly value={articlePrompt}/></details>
      <div className={styles.resetRow}><button onClick={reset}>현재 실험 초기화</button><small>실험 설계와 답변은 이 브라우저에 자동 저장됩니다.</small></div>
    </section>
  </main>;
}
