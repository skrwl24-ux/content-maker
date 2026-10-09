"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";
import { FAKE_COUNTRY_PACKET, FAKE_COUNTRY_TITLE, buildPacketRequest, parseExperimentPacket, buildBlindPrompt, buildWorkPdfRequest, suggestedExperimentQuestion, mismatchedExperimentQuestion, getExperimentWorkflowStatus } from "@/lib/ai-world-experiment-packet.mjs";
import { storeExperimentPdf, getExperimentPdf, storeHumanPhoto, getHumanPhoto, deleteHumanPhoto } from "@/lib/ai-world-experiment-files.mjs";
import type { PdfMeta, HumanPhotoMeta } from "@/lib/ai-world-experiment-files.mjs";
import { BASELINE_PROFILE, getProviderBaselineHint, baselineStatus } from "@/lib/ai-world-experiment-baseline.mjs";
import { TOPIC_BANK_VERSION, initialTopics, mergeTopics, parseBulkTopics, countTopics } from "@/lib/ai-world-experiment-topics.mjs";
import { buildChatGptArticlePrompt, buildChatGptTopicPrompt, parseChatGptDraft } from "@/lib/ai-world-experiment-chatgpt-handoff.mjs";
import { buildExperimentScheduleReport, buildExperimentSchedulePrompt } from "@/lib/ai-world-experiment-schedule.mjs";
import type { Topic, TopicStatus } from "@/lib/ai-world-experiment-topics.mjs";

type ProviderId = "chatgpt" | "claude" | "gemini";
type ProviderRun = {
  model: string;
  accountPlan: "" | "free" | "guest" | "paid" | "unknown";
  chatMode: "" | "standard" | "advanced" | "unknown";
  webUsed: "unknown" | "no" | "yes";
  extraToolsUsed: "unknown" | "no" | "yes";
  newChat: boolean;
  testedAt: string;
  usedSamePdf: boolean;
  response: string;
  finalAnswer: string;
  verdict: "" | "correct" | "incorrect" | "partial" | "uncertain" | "recommendation";
  highlight: string;
  accuracy: number | null;
  instruction: number | null;
  hallucinations: number | null;
  reviewed: boolean;
  weirdestMistake: string;
  notes: string;
};
type AutoDraft = {
  title: string;
  metaDescription: string;
  labels: string[];
  html: string;
  needsReview: string[];
  ready: boolean;
  humanVerdict: "correct" | "incorrect" | "partial" | "uncertain" | "not_recorded";
  scores: Array<{provider: ProviderId; finalAnswer: string; verdict: ProviderRun["verdict"]; evidence: string; explanation: string}>;
};
type SavedDraft = { fingerprint: string; draft: AutoDraft };
type TopicFilter = "open"|"used"|"all";
type HumanChallenge = {
  choice: string;
  durationText: string;
  durationSource: "" | "timer" | "manual";
  difficulty: "" | "easy" | "medium" | "hard";
  notes: string;
  attemptedBeforeAI: boolean;
  verdict: "" | "correct" | "incorrect" | "partial" | "uncertain";
  photos: HumanPhotoMeta[];
};
type ExperimentState = {
  scheduleId: string;
  scheduleDate: string;
  title: string;
  mode: "recommend"|"quiz";
  topicId: string;
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
  protocol: "basic" | "legacy";
  human: HumanChallenge;
  runs: Record<ProviderId, ProviderRun>;
};

const STORAGE_KEY = "ai-world-experiment-studio-v1";
const AUTO_DRAFT_KEY = "ai-world-experiment-auto-draft-v1";
const TOPICS_KEY = "ai-world-experiment-topic-bank-v1";
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
  return { model: "",accountPlan:"",chatMode:"",webUsed:"unknown",extraToolsUsed:"unknown",newChat:false,testedAt:"", usedSamePdf:false, response: "", finalAnswer:"", verdict:"", highlight:"", accuracy: null, instruction: null, hallucinations: null, reviewed: false, weirdestMistake: "", notes: "" };
}
function emptyHuman(): HumanChallenge {
  return { choice:"", durationText:"", durationSource:"", difficulty:"", notes:"",
    attemptedBeforeAI:false, verdict:"", photos:[] };
}
function formatChallengeDuration(seconds: number) {
  const total=Math.max(0,Math.round(seconds));
  return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
}
function validateChallengeDuration(value: string) {
  if (!value.trim()) return true;
  const m=/^(\d{1,4}):([0-5]\d)$/.exec(value.trim());
  return Boolean(m && Number(m[1])<=9999);
}
function emptyState(): ExperimentState {
  return {
    scheduleId: "",
    scheduleDate: "",
    title: STARTERS[0].title,
    mode: "quiz",
    topicId: "",
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
    protocol:"basic",
    human:emptyHuman(),
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
  const instructions=s.protocol==="basic" ? BASELINE_PROFILE.commonInstruction+"\n\n" : "";
  return instructions+buildBlindPrompt({testQuestion:s.testQuestion, material:s.fixtureMode==="pdf" ? "Analyze the attached PDF exactly as provided. Use only details that are actually visible in this document. If the attachment is missing or unreadable, say so." : s.material});
}

function reportText(s: ExperimentState) {
  const human=s.human||emptyHuman();
  const humanParticipated=Boolean(human.choice.trim());
  const humanRecord=[
    "HUMAN PARTICIPANT — operator-provided testimony only",
    "Participation: "+(humanParticipated?"yes":"no confirmed attempt"),
    "Own answer: "+(human.choice||"not recorded"),
    "Time: "+(validateChallengeDuration(human.durationText)&&human.durationText.trim()?human.durationText+" (mm:ss; "+(human.durationSource==="timer"?"on-page timer":"operator entered")+")":"not recorded"),
    "Difficulty as self-reported: "+(human.difficulty ? {easy:"easy",medium:"medium",hard:"hard"}[human.difficulty] : "not recorded"),
    "Answered before seeing the AI outputs? "+(human.attemptedBeforeAI?"operator reports yes":"not confirmed"),
    "Human verdict: "+(human.verdict||"not assessed"),
    "Human's actual first-person note: "+(human.notes||"not recorded"),
    "Actual photos saved locally (NOT automatically passed to ChatGPT or Blogger): "+
      (human.photos.length?human.photos.map((p,i)=>"human_photo_"+String(i+1).padStart(2,"0")+" [original "+p.name+"; SHA-256 "+p.sha256+"]").join("; "):"none"),
    "Never invent human experiences, visual content of photos, or timing results.",
  ].join("\n");
  const rows = PROVIDERS.map(p => {
    const r = s.runs[p.id];
    return [
      p.label + (r.model ? " ("+r.model+")" : ""),
      "Review status: " + (r.reviewed ? "Operator reviewed" : "NOT REVIEWED"),
      "Test date: " + (r.testedAt || "not recorded"),
      "Account plan as recorded: " + (r.accountPlan || "unknown"),
      "Normal/default chat mode: " + (r.chatMode || "unknown"),
      "Fresh independent chat confirmed: " + (r.newChat ? "yes":"not confirmed"),
      "Web search/grounding used: " + (r.webUsed || "unknown"),
      "Extra tools / Deep Research used: " + (r.extraToolsUsed || "unknown"),
      "Free/basic protocol: " + baselineStatus(r).label,
      "Actual departures from baseline: " + (baselineStatus(r).deviations.join(", ") || "none recorded"),
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
    "Comparison setup: " + (s.protocol==="basic" ? BASELINE_PROFILE.title : "legacy (prior test; basic protocol not verified)"),
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
    "HUMAN CHALLENGE",
    humanRecord,
    "",
    "THREE AI MODEL RESULTS",
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
Use only the recorded experiment setup, precommitted ground truth, real human attempt if recorded, and actual model results above.
Do not invent scores, model versions, answers, sources or observations.
Use the actual original answers to describe what ChatGPT, Claude and Gemini EACH selected, what their reasoning literally says, and how their approaches differ.
Present the three provider answers with individually attributed short VERBATIM excerpts, not invented quotes or an AI-written imitation.
If a human answer is present, weave a short engaging first-person "I Tried It Myself" section from the operator's REAL notes, actual choice, difficulty and recorded time (if supplied).
Translate and polish any Korean notes into natural English, but NEVER fabricate hesitations, reactions, discoveries, dialogue, sensory details or actions.
Include the human entry as a fourth row in the result comparison ONLY when an actual human choice is provided. If the human verdict is unassessed, say "not scored" and never infer correctness.
Say the human attempt occurred before reading AI responses ONLY when the explicit operator checkbox confirms this. Otherwise keep the order and claimed independence neutral.
Human time is an operator-entered or locally measured elapsed time. Never compare it to AI response times unless those times were actually measured and recorded.
If real human photos are listed, tell the operator to attach the actual photo files to the blog writing request or upload them separately to Blogger. Never infer a photo's visual contents from the filename; only describe what is verifiably visible if the photo is actually attached and inspected.
If no human answer was recorded, omit the human-attempt story. Do not invent one.
If an excerpt was manually selected, confirm it occurs exactly in that providers original response; otherwise select a brief exact excerpt from its saved response.
If there is no noteworthy error, do not invent a weirdest mistake. Use human-confirmed verdicts for the scoreboard; numeric metrics are optional and never inferred from blank fields.
Make the reader guess before showing the private answer, but do not delay disclosure so long that the result becomes unclear.
The PDF is a local fixture, not an online link: do not fabricate a public PDF URL or claim it is embedded in Blogger HTML. PDF images and full original answer files need to be uploaded separately by the operator if they want to show those assets.
Do not change the operator's recorded scoring.
If one field is missing, omit it or clearly label it as not recorded. The answer key is supplied from Work by the operator after testing and was not independently timestamped or cryptographically locked by the studio. Do not claim otherwise.
The baseline goal is each product's free/default ordinary chat, not paid deep-research or maximum-thinking modes. Report the ACTUAL model name, account plan and whether search or extra tools were used, distinguishing user-confirmed settings from unknowns.
Do NOT claim all three were on free tiers unless each provider was confirmed as free/guest. If one provider used premium mode, search, deep research, or automatic grounding, state this exception truthfully. Default or paid labels are not equivalent across vendors.
Legacy responses collected before activating this protocol must never be relabeled as baseline tests.

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
3. I Tried It Myself (ONLY if the human actually submitted an answer; first-person real experience with photo placeholder)
4. What ChatGPT Actually Said (its choice, reasoning, accurate excerpt)
5. What Claude Actually Said (its choice, reasoning, accurate excerpt)
6. What Gemini Actually Said (its choice, reasoning, accurate excerpt)
7. Where Their Reasoning Diverged (verified comparison, no invented thoughts)
8. The Big Reveal: Correct Answer and Source
9. Who Got It Right? Human + three AIs if human participated; otherwise three AIs
10. Most Surprising Real Response (only if one was actually observed)
11. What This One Experiment Does and Does Not Show
12. Final Verdict and invitation to reader

Include a compact comparison table for the three AI models. Include Human ONLY if their answer was recorded; never invent an answer or verdict.
Mention the ground-truth source methodology with clickable primary links where verified.
The "Weirdest Mistake" section should use only the recorded mistakes.

[IMAGE PLACEHOLDERS — exact lines]
[IMAGE 00 — Experiment hook]
[IMAGE 01 — Real human challenge photo if actually provided, otherwise test setup]
[IMAGE 02 — AI answers]
[IMAGE 03 — The reveal]
[IMAGE 04 — Human vs AI results when applicable, otherwise three-AI scoreboard]
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
  const [advancedMode, setAdvancedMode] = useState(false);
  const [chatGptDraftInput, setChatGptDraftInput] = useState("");
  const [draftFeedback, setDraftFeedback] = useState<{kind:"loading"|"error"|"success"; message:string}|null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [draftApproved, setDraftApproved] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [topicFilter, setTopicFilter] = useState<TopicFilter>("open");
  const [bulkTopics, setBulkTopics] = useState("");

  const [topicImportBusy, setTopicImportBusy] = useState(false);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [humanPhotoUrls, setHumanPhotoUrls] = useState<Record<string,string>>({});
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(0);

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
          mode:seed.mode==="recommend"?"recommend":"quiz",
          testQuestion:typeof seed.testQuestion==="string"&&seed.testQuestion.trim()?seed.testQuestion:next.testQuestion,
          fixtureMode:seed.mode==="recommend"?"text":"pdf",
          material:seed.mode==="recommend"?"Text-only recommendation question, no PDF or single fixed correct answer.":"",
          topicId:typeof seed.topicId==="string"?seed.topicId:"",
        };
        localStorage.removeItem(SEED_TRANSFER_KEY);
        setNotice(remembered ? "이전 실험 작업을 복원했습니다. PDF와 답변 기록을 확인하세요." : "새 실험 주제를 불러왔습니다. Work에서 PDF부터 준비하세요.");
      }
      if (!next.lockedAt && !String(next.testQuestion || "").trim() && suggestedExperimentQuestion(next.title)) next.testQuestion = suggestedExperimentQuestion(next.title);
      next.mode=next.mode==="recommend"?"recommend":"quiz";
      next.topicId=typeof next.topicId==="string"?next.topicId:"";
      next.protocol=next.protocol==="basic"||next.protocol==="legacy" ? next.protocol :
        PROVIDERS.some(p=>Boolean(next.runs?.[p.id]?.response?.trim())) ? "legacy" : "basic";
      next.runs = Object.fromEntries(PROVIDERS.map(p => [p.id, { ...emptyRun(), ...(next.runs?.[p.id] || {}) }])) as ExperimentState["runs"];
      next.human = { ...emptyHuman(), ...(next.human || {}), photos:Array.isArray(next.human?.photos)?next.human.photos.slice(0,3):[] };
      setState(next);
    } catch {
      setState(emptyState());
    }
    try { const rawDraft = localStorage.getItem(AUTO_DRAFT_KEY); if (rawDraft) setSavedDraft(JSON.parse(rawDraft)); } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    try {
      const saved=localStorage.getItem(TOPICS_KEY);
      const parsed=saved?JSON.parse(saved):null;
      setTopics(saved && Array.isArray(parsed?.topics) ? mergeTopics([],parsed.topics) : initialTopics());
    } catch {setTopics(initialTopics());}
    setTopicsLoaded(true);
  }, []);
  useEffect(()=>{
    if(!topicsLoaded)return;
    try{localStorage.setItem(TOPICS_KEY,JSON.stringify({version:TOPIC_BANK_VERSION,topics}));}catch{}
  },[topics,topicsLoaded]);
  useEffect(() => {
    if (!hydrated || !savedDraft) return;
    try { localStorage.setItem(AUTO_DRAFT_KEY, JSON.stringify(savedDraft)); } catch {}
  }, [savedDraft, hydrated]);
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
  const humanPhotoSignature=(state.human?.photos||[]).map(p=>p.sha256).join("|");
  useEffect(() => {
    let alive=true;
    let urls:Record<string,string>={};
    const metas=state.human?.photos||[];
    if (!hydrated || !metas.length){setHumanPhotoUrls({});return;}
    Promise.all(metas.map(async meta=>{
      try {
        const blob=await getHumanPhoto(meta.sha256);
        return blob ? {sha256:meta.sha256,url:URL.createObjectURL(blob)} : null;
      } catch {return null;}
    })).then(items=>{
      for(const item of items) if(item) urls[item.sha256]=item.url;
      if (alive) setHumanPhotoUrls(urls);
      else Object.values(urls).forEach(url=>URL.revokeObjectURL(url));
    });
    return ()=>{alive=false;Object.values(urls).forEach(url=>URL.revokeObjectURL(url));};
  },[hydrated,humanPhotoSignature]);
  useEffect(()=>{
    if(timerStartedAt===null)return;
    const id=window.setInterval(()=>setTimerNow(Date.now()),250);
    return ()=>window.clearInterval(id);
  },[timerStartedAt]);
  const draftPrompt=state.commonPrompt.trim();
  const commonPrompt=state.protocol==="basic" && draftPrompt
    ? (draftPrompt.startsWith(BASELINE_PROFILE.commonInstruction) ? draftPrompt : BASELINE_PROFILE.commonInstruction+"\n\n"+draftPrompt)
    : (draftPrompt || defaultCommonPrompt(state));
  const report = useMemo(() => reportText(state), [state]);
  const articlePrompt = useMemo(() => bloggerPrompt(state), [state]);
  const completed = PROVIDERS.filter(p => state.runs[p.id].response.trim()).length;
  const topicCounts = countTopics(topics);
  const visibleTopics = topics.filter(t=>topicFilter==="all"||(topicFilter==="used"?t.status==="used":t.status!=="used"));
  // A draft is only valid for the exact PDF/key/original answers that produced it.
  const draftFingerprint = JSON.stringify([state.title, state.mode, state.topicId, state.testQuestion, state.material, state.pdf?.sha256,
    state.groundTruth, state.sources, state.hiddenTwist, state.human.choice, state.human.durationText,
    state.human.notes, state.human.photos.map(p => p.sha256), ...PROVIDERS.map(p => state.runs[p.id].response)]);
  const currentDraft = savedDraft?.fingerprint === draftFingerprint ? savedDraft.draft : null;
  const suggestedQuestion = suggestedExperimentQuestion(state.title);
  const {mismatchedQuestion, noKeyLeak, fixtureReady, allAnswersCollected, keyReady, allScored} = getExperimentWorkflowStatus({
    title:state.title, testQuestion:state.testQuestion, commonPrompt,
    fixtureMode:state.fixtureMode, pdfSha256:state.pdf?.sha256 || "",
    pdfName:state.pdf?.name || "", pdfAvailable, material:state.material,
    groundTruth:state.groundTruth, hiddenTwist:state.hiddenTwist, sources:state.sources,
    runs:state.runs
  });
  const comparisonReady = state.mode==="recommend" ?
    (Boolean(state.testQuestion.trim() && state.material.trim()) && completed===3) :
    (fixtureReady && keyReady && allAnswersCollected);

  function patchTopicStatus(id:string,status:TopicStatus){
    setTopics(prev=>prev.map(t=>t.id===id?{...t,status,usedAt:status==="used"?today():""}:t));
  }
  function useTopic(topic:Topic){
    if(state.topicId===topic.id && state.mode==="recommend"){
      setAdvancedMode(false);
      setNotice("현재 작업 중인 비교 주제입니다. 아래에 AI 세 곳의 답변을 붙여넣으세요.");return;
    }
    if(hasAnyResults() && !window.confirm("현재 실험의 AI 답변과 사람 기록을 유지한 채 다른 주제로 이동합니다. 현재 작업을 저장하고 전환할까요?"))return;
    try {
      const oldKey=state.scheduleId||slugify(state.title);
      if(oldKey)localStorage.setItem("ai-world-experiment-case:"+oldKey,JSON.stringify(state));
    }catch{}
    const caseId="topic-bank-"+topic.id;
    let remembered:ExperimentState|null=null;
    try {const raw=localStorage.getItem("ai-world-experiment-case:"+caseId);
      if(raw){const old=JSON.parse(raw) as ExperimentState;if(old?.title===topic.title)remembered=old;}
    }catch{}
    const defaultQuestion="As of the date of this test, for the topic '"+topic.title+"', recommend ONE top choice. Explain specific criteria, strengths, weaknesses, assumptions and uncertainty. Distinguish opinion from verified facts. Answer in English.";
    const next:ExperimentState=remembered?{...emptyState(),...remembered,mode:"recommend",topicId:topic.id}:
      {...emptyState(),mode:"recommend",topicId:topic.id,scheduleId:caseId,scheduleDate:today(),title:topic.title,
      category:topic.category,keyword:"AI comparison",hook:"ChatGPT vs Claude vs Gemini recommendation comparison",
      testQuestion:topic.question||defaultQuestion,material:"Text-only recommendation question, no PDF, no single fixed correct answer.",
      fixtureMode:"text",pdf:null,groundTruth:"",sources:"",hiddenTwist:"",sourceStatus:"not_applicable"};
    setState(next);setTimerStartedAt(null);setTimerNow(0);setAdvancedMode(false);setPacketInput("");setDraftApproved(false);
    if(topic.status==="pending")patchTopicStatus(topic.id,"active");
    setNotice(remembered?"저장된 이 주제의 기존 답변과 메모를 다시 불러왔습니다.":"비교 주제를 시작했습니다. 정답키나 PDF 없이 세 AI에게 같은 영어 질문을 보내세요.");
  }
  function appendBulkTopics(){
    const candidates=parseBulkTopics(bulkTopics);
    if(!candidates.length){setNotice("주제 제목을 한 줄에 하나씩 입력하세요.");return;}
    const next=mergeTopics(topics,candidates);
    const added=next.length-topics.length;
    setTopics(next);setBulkTopics("");
    setNotice(added?"새 주제 "+added+"개를 보관함에 추가했습니다.":"중복된 주제입니다. 새로 추가할 제목이 없습니다.");
  }
  function requestMoreTopics(){
    const prompt=buildChatGptTopicPrompt(topics.map(t=>t.title));
    const details=document.getElementById("topic-bank-add");
    if(details instanceof HTMLDetailsElement)details.open=true;
    openPrompt(prompt);
    setNotice("ChatGPT에서 새 주제 10줄을 받은 다음, 아래의 '주제 일괄 추가' 입력칸에 붙여넣고 저장하세요. 유료 API 호출은 하지 않습니다.");
  }
  function downloadTopicBank(){
    const blob=new Blob([JSON.stringify({version:TOPIC_BANK_VERSION,exportedAt:today(),topics},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ai-experiment-topics-"+today()+".json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),20000);
    setNotice("사용 상태까지 포함해 주제 보관함을 JSON으로 백업했습니다.");
  }
  async function importTopicBank(file:File|null){
    if(!file||topicImportBusy)return;
    setTopicImportBusy(true);
    try{
      if(file.size>1_000_000)throw new Error("주제 백업은 1MB 이하만 가져올 수 있습니다.");
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data?.topics))throw new Error("유효한 주제 보관함 백업 JSON이 아닙니다.");
      const restored=mergeTopics(data.topics,topics);
      const count=restored.length;
      setTopics(restored);
      setNotice("기존 상태를 최대한 유지하면서 주제 "+count+"개를 복원했습니다.");
    }catch(e){setNotice(e instanceof Error?e.message:"주제 목록 복원 실패");}
    finally{setTopicImportBusy(false);}
  }
  function patch<K extends keyof ExperimentState>(key: K, value: ExperimentState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }
  function switchToBasicProtocol() {
    if (state.protocol==="basic") return;
    if (hasAnyResults() && !window.confirm("기존 실험은 기본 모드 사용 여부를 확인하지 않았습니다. 기본 모드로 새로 시험하려면 사람 도전·AI 답변을 초기화해야 합니다. 진행할까요?"))return;
    setTimerStartedAt(null);setTimerNow(0);
    setState(prev=>({...prev,protocol:"basic",commonPrompt:"",human:emptyHuman(),
      runs:{chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()}}));
    setNotice("무료/기본 일반 채팅 비교를 적용했습니다. PDF를 세 AI에 동일하게 첨부하고 실제 모델명과 사용 설정을 기록하세요.");
  }
  function patchRun(id: ProviderId, value: Partial<ProviderRun>) {
    // Collect original AI responses and experimental settings even before the PDF metadata is restored.
    // Final grading and article export still require the original fixture and ground truth.
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
    setState(prev=>({...prev,groundTruth:next,human: next!==prev.groundTruth ? {...prev.human,verdict:""} : prev.human,
      runs:next!==prev.groundTruth?Object.fromEntries(PROVIDERS.map(p=>[p.id,{
        ...prev.runs[p.id], verdict:"", reviewed:false
      }])) as ExperimentState["runs"]:prev.runs}));
  }

  function patchHuman(value: Partial<HumanChallenge>) {
    setState(prev=>{
      const old=prev.human||emptyHuman();
      return {...prev,human:{...old,...value,
        ...("choice" in value && value.choice!==old.choice ? {verdict:"" as const}: {})}};
    });
  }
  function startHumanTimer(){
    if(!fixtureReady){setNotice("사람 도전도 PDF 또는 텍스트 문제와 공통 질문이 준비된 뒤 시작하세요.");return;}
    const now=Date.now();
    setTimerStartedAt(now);setTimerNow(now);
    setNotice("사람 도전 타이머가 시작됐습니다. 직접 답을 고른 순간 종료하세요.");
  }
  function stopHumanTimer(){
    if(timerStartedAt===null)return;
    const seconds=Math.max(1,Math.round((Date.now()-timerStartedAt)/1000));
    patchHuman({durationText:formatChallengeDuration(seconds),durationSource:"timer"});
    setTimerStartedAt(null);setTimerNow(0);
    setNotice("실제 경과 시간을 기록했습니다. 기록된 시간은 AI 처리 속도와 자동 비교하지 않습니다.");
  }
  async function uploadHumanPhotos(files:File[]){
    if(!files.length || photoBusy)return;
    const remaining=3-(state.human?.photos?.length||0);
    if(remaining<=0){setNotice("사람 도전 사진은 최대 3장입니다.");return;}
    if(files.length>remaining){setNotice("사진은 최대 3장까지 저장합니다. 먼저 선택한 "+remaining+"장만 등록합니다.");}
    setPhotoBusy(true);
    try{
      const seen=new Set((state.human?.photos||[]).map(p=>p.sha256));
      const additions:HumanPhotoMeta[]=[];
      for(const file of files.slice(0,remaining)){
        const meta=await storeHumanPhoto(file);
        if(!seen.has(meta.sha256)){additions.push(meta);seen.add(meta.sha256);}
      }
      if(additions.length){
        setState(prev=>({...prev,human:{...prev.human,photos:[...prev.human.photos,...additions].slice(0,3)}}));
        setNotice("실제 사진 "+additions.length+"장 등록 완료. 이 사진은 서버에 업로드되지 않고 현재 브라우저에만 저장됩니다.");
      }else setNotice("선택한 사진은 이미 등록되어 있습니다.");
    }catch(e){setNotice(e instanceof Error?e.message:"사진 등록 실패");}
    finally{setPhotoBusy(false);}
  }
  async function removeHumanPhoto(sha256:string){
    if(!window.confirm("이 사진을 현재 브라우저 저장소에서도 삭제할까요?"))return;
    try{
      await deleteHumanPhoto(sha256);
      setState(prev=>({...prev,human:{...prev.human,photos:prev.human.photos.filter(p=>p.sha256!==sha256)}}));
      setNotice("사진을 삭제했습니다. 다른 실험에서도 같은 파일을 사용했다면 다시 등록해야 합니다.");
    }catch{setNotice("사진을 삭제하지 못했습니다.");}
  }
  async function downloadHumanPhoto(photo:HumanPhotoMeta){
    try{
      const blob=await getHumanPhoto(photo.sha256);
      if(!blob)throw new Error("사진 원본을 현재 브라우저 저장소에서 찾지 못했습니다.");
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=photo.name;a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setNotice(e instanceof Error?e.message:"사진 다운로드 실패");}
  }
  function hasResponses() { return PROVIDERS.some(p => state.runs[p.id].response.trim()); }
  function hasHumanRecord() {
    const h=state.human;
    return Boolean(h.choice.trim() || h.durationText.trim() || h.notes.trim() || h.photos.length || h.attemptedBeforeAI);
  }
  function hasAnyResults() { return hasResponses() || hasHumanRecord(); }
  function updateQuestion(next: string) {
    if (next === state.testQuestion) return;
    if (hasAnyResults() && !window.confirm("질문이 바뀌면 기존 사람 풀이 기록·사진·AI 답변을 다른 실험에 사용할 수 없습니다. 초기화할까요? 필요하면 먼저 ZIP으로 백업하세요.")) return;
    setTimerStartedAt(null);setTimerNow(0);
    setState(prev => ({ ...prev, testQuestion: next, commonPrompt:"",
      human:emptyHuman(), runs:{chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()} }));
  }
  function updateCommonPrompt(next: string) {
    if (next === state.commonPrompt) return;
    if (hasAnyResults() && !window.confirm("공통 프롬프트를 바꾸면 사람 도전과 AI 답변 기록이 무효가 됩니다. 모두 초기화할까요? 먼저 ZIP으로 백업하세요.")) return;
    setTimerStartedAt(null);setTimerNow(0);
    setState(prev => ({...prev, commonPrompt:next,human:emptyHuman(),
      runs:{chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()} }));
  }
  function updateMaterial(next: string) {
    if (next === state.material) return;
    if (hasAnyResults() && !window.confirm("텍스트 문제를 수정하면 사람 도전과 AI 답변 기록을 초기화해야 합니다. 계속할까요?")) return;
    setTimerStartedAt(null);setTimerNow(0);
    setState(prev=>({...prev,material:next,human:emptyHuman(),
      runs:{chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()}}));
  }
  function changeFixtureMode(next: ExperimentState["fixtureMode"]) {
    if (state.fixtureMode === next) return;
    if (hasAnyResults() && !window.confirm("테스트 자료 방식을 바꾸면 기존 사람 도전·사진·AI 답변이 초기화됩니다. 계속할까요?")) return;
    setTimerStartedAt(null);setTimerNow(0);
    setState(prev => ({...prev,fixtureMode:next,sourceVerified:false,human:emptyHuman(),
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
    if (hasAnyResults() && promptChanged && !window.confirm("Work JSON의 문제·질문이 기존 실험과 다릅니다. 사람 도전 사진·후기와 세 AI의 답변이 초기화됩니다. 먼저 ZIP으로 백업하세요. 계속할까요?")) return;
    if(promptChanged){setTimerStartedAt(null);setTimerNow(0);}
    setState(prev => ({ ...prev, title: packet.title || prev.title,
      testQuestion: packet.testQuestion, material: packet.material, hiddenTwist: packet.hiddenTwist,
      groundTruth: packet.groundTruth, sources: packet.sources,
      sourceStatus: packet.sourceStatus, sourceVerified: false, lockedAt: "", commonPrompt: promptChanged ? "" : prev.commonPrompt,
      fixtureMode: preset ? "text" : prev.fixtureMode, pdf: preset ? null : prev.pdf,
      human: promptChanged?emptyHuman():(packet.groundTruth!==prev.groundTruth?{...prev.human,verdict:""}:prev.human),
      runs: promptChanged ? { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() } : (packet.groundTruth !== prev.groundTruth ? Object.fromEntries(PROVIDERS.map(p=>[p.id,{...prev.runs[p.id],verdict:"" as const,reviewed:false}])) as ExperimentState["runs"] : prev.runs) }));
    setNotice(preset ? "텍스트 예제 입력 완료. PDF 실험과는 별개입니다." :
      (hasResponses() && !promptChanged ? "기존 세 AI 답변은 유지하고 비공개 정답·출처만 가져왔습니다." : "Work 질문·비공개 정답·출처를 가져왔습니다. PDF와 질문이 맞는지 확인하세요."));
  }
  function importPacket() {
    const parsed = parseExperimentPacket(packetInput);
    if (!parsed.packet) { setNotice(parsed.error); return; }
    applyPacket(parsed.packet);
  }
  function importQuickWorkNotes() {
    const raw = packetInput.trim();
    // New packet shape: flat fields. Use the original parser with its identity safeguards.
    const parsed = parseExperimentPacket(raw);
    if (parsed.packet) {
      const jsonSection = raw.match(/\[EXPERIMENT_PACKET_JSON\]([\s\S]*?)\[\/EXPERIMENT_PACKET_JSON\]/i)?.[1] || raw;
      try {
        const packet = JSON.parse(jsonSection.trim());
        const declaredHash = typeof packet?.groundTruth?.blindPdfSha256 === "string" ? packet.groundTruth.blindPdfSha256 : "";
        if (declaredHash && state.pdf?.sha256 && declaredHash.toLowerCase() !== state.pdf.sha256.toLowerCase()) {
          setNotice("⚠ PDF 파일과 Work 정답키의 SHA-256 지문이 다릅니다. 다른 문제의 정답일 수 있으므로 가져오지 않았습니다.");return;
        }
      } catch {}
      applyPacket(parsed.packet); return;
    }
    // Older Work packets can have groundTruth as an object and sources as an array.
    const jsonSection = raw.match(/\[EXPERIMENT_PACKET_JSON\]([\s\S]*?)\[\/EXPERIMENT_PACKET_JSON\]/i)?.[1] ||
      raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || raw;
    try {
      const data = JSON.parse(jsonSection.trim());
      const gt = data?.groundTruth;
      if (gt && typeof gt === "object" && !Array.isArray(gt) && typeof gt.exactAnswer === "string") {
        const declaredHash = typeof gt.blindPdfSha256 === "string" ? gt.blindPdfSha256.toLowerCase() : "";
        if (declaredHash && state.pdf?.sha256 && declaredHash !== state.pdf.sha256.toLowerCase()) {
          setNotice("⚠ 등록된 PDF와 비공개 정답키의 지문(SHA-256)이 일치하지 않습니다. 정답을 연결하지 않았습니다.");return;
        }
        const sources = Array.isArray(data.sources) ? data.sources.map((v:Record<string,unknown>) =>
          [v?.title,v?.url,v?.supports].filter(x=>typeof x==="string").join(" | ")).join("\n") :
          typeof data.sources==="string" ? data.sources : "";
        if(!sources.trim()) {setNotice("정답키는 인식했지만 근거와 출처를 찾지 못했습니다.");return;}
        const answer = gt.exactAnswer.trim();
        const fullKey = [
          answer,
          typeof gt.acceptedEquivalent === "string" ? "Accepted: "+gt.acceptedEquivalent : "",
          typeof gt.derivation === "string" ? "Derivation: "+gt.derivation : "",
          typeof gt.scoringCriterion === "string" ? "Scoring: "+gt.scoringCriterion : "",
          typeof gt.construction === "string" ? "Provenance: "+gt.construction : "",
        ].filter(Boolean).join("\n");
        const changed=fullKey!==state.groundTruth;
        setState(prev=>({...prev,groundTruth:fullKey,sources:sources.slice(0,18000),sourceStatus:data.sourceStatus==="verified"?"verified":"needs_verification",
          human:changed?{...prev.human,verdict:""}:prev.human,
          runs:changed?Object.fromEntries(PROVIDERS.map(p=>[p.id,{...prev.runs[p.id],verdict:"",reviewed:false}])) as ExperimentState["runs"]:prev.runs}));
        setNotice("이전 형식의 Work JSON에서 정답·채점 기준·출처를 한 번에 가져왔습니다. PDF 내용과도 일치하는지 생성 시 확인합니다.");return;
      }
    } catch {}
    // PRIVATE_answer_key.txt support (never send the key to a test provider).
    const key = raw.match(/^EXACT ANSWER:\s*(.+)$/im)?.[1]?.trim() ||
      raw.match(/^정답\s*[:：]\s*(.+)$/im)?.[1]?.trim();
    if (!key || raw.length < 80) {
      setNotice("Work의 [EXPERIMENT_PACKET_JSON] 전체 또는 PRIVATE_answer_key.txt 전문을 붙여넣으세요.");return;
    }
    const declaredHash = raw.match(/blind_test\.pdf:\s*([a-f\d]{64})/i)?.[1]?.toLowerCase() || "";
    if (declaredHash && state.pdf?.sha256 && declaredHash!==state.pdf.sha256.toLowerCase()) {
      setNotice("⚠ 비공개 정답표는 현재 등록한 PDF와 다른 파일입니다. PDF 지문이 일치하지 않아 가져오지 않았습니다.");return;
    }
    const urls = [...new Set(raw.match(/https?:\/\/[^\s)\]]+/g) || [])];
    if (!urls.length) {setNotice("정답은 인식했지만 공식 출처 URL을 찾지 못했습니다.");return;}
    const changed = raw !== state.groundTruth;
    setState(prev=>({...prev,groundTruth:raw.slice(0,10000),sources:urls.join("\n").slice(0,18000),
      sourceStatus:/SOURCE STATUS:\s*verified/i.test(raw)?"verified":"needs_verification",
      human:changed?{...prev.human,verdict:""}:prev.human,
      runs:changed?Object.fromEntries(PROVIDERS.map(p=>[p.id,{...prev.runs[p.id],verdict:"",reviewed:false}])) as ExperimentState["runs"]:prev.runs}));
    setNotice("기존 비공개 TXT 정답표에서 전체 정답과 검증 근거를 가져왔습니다.");
  }
  function openChatGptArticle(){
    if(!comparisonReady){
      const msg=state.mode==="recommend"?"공통 질문과 ChatGPT·Claude·Gemini 답변 3개를 입력해 주세요.":
        "원본 PDF·비공개 정답키·세 AI 답변을 먼저 확인하세요.";
      setDraftFeedback({kind:"error",message:msg});return;
    }
    if(state.mode==="quiz"&&state.fixtureMode==="pdf"&&!pdfAvailable){
      setDraftFeedback({kind:"error",message:"원본 PDF가 이 브라우저에 없습니다. STEP 1에서 다시 등록해 주세요."});return;
    }
    openPrompt(buildChatGptArticlePrompt(state));
    setDraftFeedback({kind:"loading",message:state.mode==="quiz"&&state.fixtureMode==="pdf"
      ?"ChatGPT가 열렸습니다. 복사된 요청서를 붙여넣고 원본 PDF를 직접 첨부해 주세요. 완성된 결과를 아래에 다시 붙여넣으세요."
      :"ChatGPT가 열렸습니다. 요청서를 붙여넣어 실행하고 완성된 결과 전체를 아래에 다시 붙여넣으세요."});
  }
  function importChatGptResult(){
    const parsed=parseChatGptDraft(chatGptDraftInput,state.runs,state.mode);
    if(!parsed.draft){setDraftFeedback({kind:"error",message:parsed.error});return;}
    setSavedDraft({fingerprint:draftFingerprint,draft:parsed.draft as AutoDraft});
    setDraftApproved(false);
    setDraftFeedback({kind:parsed.draft.needsReview.length?"error":"success",
      message:parsed.draft.needsReview.length
       ?"글을 가져왔지만 확인 필요 항목이 있습니다. ChatGPT에서 원문 인용과 사실을 수정하고 다시 붙여넣어 주세요."
       :"ChatGPT가 만든 영문 글과 AI 비교 결과를 저장했습니다. 내용을 확인한 뒤 발행리스트에 등록하세요."});
  }
  function approveQuickDraft() {
    if (!currentDraft?.ready || currentDraft.needsReview.length) {
      setNotice("확인 필요 항목이 남아 있습니다. 틀린 정답이나 원문을 먼저 수정하고 다시 생성하세요.");return;
    }
    const scores=currentDraft.scores;
    if (scores.length!==3 || PROVIDERS.some(p => !scores.some(s => s.provider===p.id && s.verdict && s.verdict!=="uncertain"))) {
      setNotice("세 AI의 판정이 모두 명확해야 확정할 수 있습니다.");return;
    }
    if(state.mode==="recommend") {
      setDraftApproved(true);
      setNotice("세 AI가 고른 추천 결과를 확인했습니다. 승자를 정하지 않고 비교 글로 발행리스트에 전달합니다.");
      return;
    }
    setState(prev=>({...prev,
      human: {...prev.human, verdict: currentDraft.humanVerdict==="not_recorded"?"":currentDraft.humanVerdict},
      runs: Object.fromEntries(PROVIDERS.map(p=>{
        const s=scores.find(x=>x.provider===p.id)!;
        return [p.id,{...prev.runs[p.id],finalAnswer:s.finalAnswer,verdict:s.verdict,
          reviewed:true,highlight:s.evidence,notes:s.explanation}];
      })) as ExperimentState["runs"]
    }));
    setDraftApproved(true);
    setNotice("자동 판정 내용을 확인했습니다. 작성된 HTML 그대로 발행리스트에 전달할 수 있습니다.");
  }
  async function uploadPdf(file: File | null) {
    if (!file || pdfBusy) return;
    setPdfBusy(true);
    try {
      const meta = await storeExperimentPdf(file);
      const isIdentical = meta.sha256 === state.pdf?.sha256 && state.fixtureMode === "pdf";
      const linkingFirstPdf = !state.pdf && state.fixtureMode === "pdf";
      let preserveResults = isIdentical;
      if (!isIdentical && hasAnyResults()) {
        if (linkingFirstPdf) {
          if (!window.confirm("이미 입력한 AI 답변·사람 기록에 실제 사용한 동일 PDF가 맞나요? 확인을 누르면 기존 기록을 지우지 않고 이 PDF를 연결합니다. 서로 다른 PDF라면 취소하고 먼저 백업·검토하세요.")) {
            setNotice("PDF 연결을 취소했습니다. 기존 답변과 사람 기록은 그대로 남아 있습니다.");return;
          }
          preserveResults = true;
        } else if (!window.confirm("기존 PDF와 다른 파일입니다. 사람 풀이 기록·사진과 세 AI의 답변을 초기화해야 합니다. 먼저 ZIP으로 백업하세요. 계속할까요?")) {
          setNotice("PDF 교체를 취소했습니다. 기존 기록은 유지됩니다.");return;
        }
      }
      setPdfAvailable(true);
      if (!preserveResults) {setTimerStartedAt(null);setTimerNow(0);}
      setState(prev => ({ ...prev, fixtureMode: "pdf", pdf: meta,
        sourceVerified: preserveResults ? prev.sourceVerified : false,
        lockedAt: "", human: preserveResults ? prev.human : emptyHuman(),
        runs: preserveResults ? prev.runs : {chatgpt:emptyRun(),claude:emptyRun(),gemini:emptyRun()} }));
      setNotice(isIdentical ? "동일 PDF 재등록 완료. 기존 AI 답변은 유지됩니다." :
        (preserveResults ? "PDF 연결 완료. 먼저 저장한 AI 답변과 사람 기록이 유지됩니다. 같은 원본을 사용했는지 확인해 주세요." :
        "PDF 등록 완료. 공통 질문을 확인하고 세 AI 답변을 받아오세요. 정답 입력은 나중에 해도 됩니다."));
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
      const human=state.human||emptyHuman();
      if(human.photos.length){
        const assets=[];
        for(let i=0;i<human.photos.length;i++){
          const meta=human.photos[i];
          const photo=await getHumanPhoto(meta.sha256);
          if(!photo)throw new Error("사람 도전 사진 원본이 없습니다: "+meta.name);
          const ext=meta.mimeType==="image/png"?"png":meta.mimeType==="image/webp"?"webp":"jpg";
          const filename="human_photo_"+String(i+1).padStart(2,"0")+"."+ext;
          zip.file("05_HUMAN_CHALLENGE/"+filename,photo);
          assets.push({filename,originalName:meta.name,sha256:meta.sha256,bytes:meta.bytes});
        }
        zip.file("05_HUMAN_CHALLENGE/photo_manifest.json",JSON.stringify(assets,null,2));
      }
      zip.file("05_HUMAN_CHALLENGE/human_notes.txt",[
        "Human participant was optional; do not invent missing experiences.",
        "Human actual answer: "+(human.choice||"not recorded"),
        "Time (mm:ss): "+(validateChallengeDuration(human.durationText)?human.durationText:"invalid / not recorded"),
        "Duration recorded by: "+(human.durationSource||"not recorded"),
        "Difficulty: "+(human.difficulty||"not recorded"),
        "Human notes: "+(human.notes||"not recorded"),
        "Before viewing AI replies (operator confirmation): "+(human.attemptedBeforeAI?"yes":"not confirmed"),
        "Human verdict: "+(human.verdict||"not assessed"),
      ].join("\n"));
      zip.file("05_OPERATOR_RESULTS/report.txt",report);
      zip.file("05_OPERATOR_RESULTS/records.json",JSON.stringify(state,null,2));
      zip.file("06_BLOGGER/article_request.txt",articlePrompt);
      zip.file("README.txt","PRIVATE EVIDENCE ARCHIVE. Never give the whole ZIP or the PRIVATE answer key to test models. Send only the identical blind PDF and exact question. Human challenge photos are ORIGINAL user-provided image bytes; they can include EXIF/GPS/private content. Review them before publishing. Photos are never automatically attached to ChatGPT or Blogger. Attach chosen human photo(s) to the article-writing chat manually and upload them separately to Blogger. Human first-person details must come from the actual notes, not invented moments.");
      const archive=await zip.generateAsync({type:"blob"});
      const url=URL.createObjectURL(archive),a=document.createElement("a");
      a.href=url;a.download=(slugify(state.title)||"ai-world-experiment")+"-evidence.zip";a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setNotice("PDF·AI 답변·사람 도전 사진과 후기·비공개 정답·블로그 요청서를 ZIP으로 백업했습니다.");
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
    if ((state.pdf || state.material.trim() || hasAnyResults()) && !window.confirm("다른 실험으로 변경하면 기존 PDF, 사람 도전·사진과 AI 답변 기록이 초기화됩니다. 먼저 ZIP으로 백업하세요. 계속할까요?")) return;
    setTimerStartedAt(null);setTimerNow(0);
    const item = STARTERS[index];
    setState(prev => ({
      ...prev,
      scheduleId: "",
      scheduleDate: "",
      title: item.title,
      mode: "quiz", topicId:"",
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
      protocol:"basic",
      human:emptyHuman(),
      runs: { chatgpt: emptyRun(), claude: emptyRun(), gemini: emptyRun() },
    }));
    setPacketInput("");
    setNotice("실험 아이디어를 불러왔습니다. STEP 02에서 실험 자료부터 준비하세요.");
  }
  function sendEvidenceToSchedule(){
    if(!comparisonReady) {
      setDraftFeedback({kind:"error",message:state.mode==="recommend"
        ?"공통 질문과 ChatGPT·Claude·Gemini 원문 답변 3개를 먼저 붙여넣어 주세요."
        :"같은 문제의 PDF·Work 정답 근거·AI 3사 실제 답변을 확인해 주세요."});
      return;
    }
    if(state.mode==="quiz" && state.fixtureMode==="pdf" && !pdfAvailable){
      setDraftFeedback({kind:"error",message:"등록한 PDF 원본이 이 브라우저에 없습니다. STEP 1에서 다시 등록해 주세요."});return;
    }
    const fullReport=buildExperimentScheduleReport(state);
    const articleRequest=buildExperimentSchedulePrompt(state);
    const pending={
      id:state.scheduleId||("world-exp-"+Date.now()),
      kind:"experiment",
      date:state.scheduleDate||today(),
      title:state.title,
      body:"",
      keyword:state.keyword||"AI three model comparison",
      slug:slugify(state.title),
      note:state.mode==="recommend"
        ?"같은 질문에 대한 세 AI의 주관적 추천 선택과 이유를 비교합니다. 정답률 채점 금지."
        :"비공개 원래 정답·실제 PDF와 AI 3사 답변을 대조합니다. 정답 불일치 시 확인 필요.",
      labVersion:state.mode==="recommend"?"WORLD-COMPARISON-V2":"WORLD-LAB-V2",
      labReport:fullReport,labPrompt:articleRequest,
      experimentCategory:state.category,experimentHook:state.hook,
      experimentTopicId:state.topicId,experimentMode:state.mode,experimentQuestion:state.testQuestion
    };
    try{
      localStorage.setItem(QUEUE_TRANSFER_KEY,JSON.stringify(pending));
      if(state.topicId){
        const updated=topics.map(t=>t.id===state.topicId && t.status==="pending"?{...t,status:"active" as TopicStatus}:t);
        setTopics(updated);
        localStorage.setItem(TOPICS_KEY,JSON.stringify({version:TOPIC_BANK_VERSION,topics:updated}));
      }
      window.location.href="/google-blog-schedule?fromLab=1";
    }catch{
      setDraftFeedback({kind:"error",message:"발행 스케줄에 자료를 저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요."});
    }
  }
  function sendToQueue() {
    if (state.mode==="recommend" ? (!currentDraft || !draftApproved || !currentDraft.ready) :
      (!allScored || (!advancedMode && (!currentDraft || !draftApproved)))) {
      setNotice(state.mode==="recommend"?"세 AI 답변으로 비교 초안을 만들고 결과를 확인해야 발행리스트에 보낼 수 있습니다.":
        "세 AI의 답변과 판정, Work 정답·근거를 확인한 뒤 발행할 수 있습니다.");
      return;
    }
    const comparisonReport=state.mode==="recommend" ? [
      "AI COMPARISON — NO SINGLE OBJECTIVE RIGHT ANSWER",
      "Topic: "+state.title,"Exact identical question: "+state.testQuestion,
      "Date: "+today(),"Human comments (only when recorded): "+(state.human.notes||"Not recorded"),
      "Human choice: "+(state.human.choice||"Not recorded"),
      ...PROVIDERS.map(p=>{
        const r=state.runs[p.id],v=currentDraft?.scores.find(x=>x.provider===p.id);
        return p.label+" ("+(r.model||"model not recorded")+")\nSelected: "+(v?.finalAnswer||"not identified")+
          "\nSelection rationale: "+(v?.explanation||"not assessed")+"\nOriginal answer:\n"+r.response;
      }),
      "LIMIT: This is a subjective recommendation comparison from one question, not independently verified current product specifications or an overall model ranking."
    ].join("\n\n") : report;
    const finalPrompt=state.mode==="recommend"
      ? "This comparison article is already drafted in the saved Blogger body. If revising it, use only the exact original model replies and the following report. Never invent winners, rankings or first-person observations.\n\n"+comparisonReport
      : articlePrompt;
    const pending = {
      id: state.scheduleId || ("world-exp-" + Date.now()),
      kind: "experiment",
      date: state.scheduleDate || today(),
      title: currentDraft?.title || state.title,
      body: currentDraft && draftApproved ? currentDraft.html : "",
      keyword: state.keyword || "AI experiment",
      slug: slugify(currentDraft?.title||state.title) || "ai-comparison-"+today(),
      note: state.mode==="recommend"?"AI 3사 추천 비교 · 정답 없는 주관적 판단 비교":"Global curiosity experiment · precommitted answer key and three actual responses",
      labVersion: state.mode==="recommend"?"WORLD-COMPARISON-V1":"WORLD-LAB-V1",
      labReport: comparisonReport,
      labPrompt: finalPrompt,
      experimentCategory: state.category,
      experimentHook: state.hook,
    };
    try {
      localStorage.setItem(QUEUE_TRANSFER_KEY, JSON.stringify(pending));
      if(state.mode==="recommend" && state.topicId) {
        const updated=topics.map(t=>t.id===state.topicId?{...t,status:"used" as TopicStatus,usedAt:today()}:t);
        localStorage.setItem(TOPICS_KEY,JSON.stringify({version:TOPIC_BANK_VERSION,topics:updated}));
        setTopics(updated);
      }
      window.location.href = "/google-blog-schedule?fromLab=1";
    } catch {
      setNotice("발행 큐 전달에 실패했습니다. 브라우저 저장소를 확인하세요.");
    }
  }
  function reset() {
    if (!window.confirm("현재 실험 설계와 AI 답변을 모두 초기화할까요?")) return;
    setState(emptyState());
    setActiveProvider("chatgpt");
    setTimerStartedAt(null);setTimerNow(0);
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

    <section className={styles.topicBank}>
      <div className={styles.topicBankHead}>
        <div><span>AI COMPARISON TOPIC LIBRARY</span><h2>AI 3사 비교 주제 보관함</h2>
          <p>주제를 골라 바로 실험하세요. 이미 사용한 주제는 남겨두고, 부족하면 새 목록을 쉽게 추가합니다.</p></div>
        <div className={styles.topicBankStats}>
          <strong>{topicCounts.pending}<small>대기</small></strong>
          <strong>{topicCounts.active}<small>진행 중</small></strong>
          <strong>{topicCounts.used}<small>사용 완료</small></strong>
        </div>
      </div>
      <div className={styles.topicBankTools}>
        <button className={styles.topicNewButton}
          onClick={requestMoreTopics}>✦ ChatGPT에서 주제 10개 받기</button>
        <button onClick={()=>setTopicFilter("open")} aria-pressed={topicFilter==="open"}>미사용·진행 중</button>
        <button onClick={()=>setTopicFilter("used")} aria-pressed={topicFilter==="used"}>사용 완료</button>
        <button onClick={()=>setTopicFilter("all")} aria-pressed={topicFilter==="all"}>전체</button>
      </div>
      {topicCounts.pending===0 && topicCounts.active===0 && <p className={styles.topicBankEmpty}>모든 주제를 사용했습니다. 위의 '새 주제 10개 AI 추천'으로 계속 추가할 수 있습니다.</p>}
      {visibleTopics.length>0 ? <div className={styles.topicList}>
        {visibleTopics.map((topic,i)=><article key={topic.id} className={styles.topicItem}>
          <div className={styles.topicMain}>
            <small>{String(i+1).padStart(2,"0")} · {topic.category}</small>
            <strong>{topic.title}</strong>
            {topic.question&&<span>{topic.question}</span>}
          </div>
          <div className={styles.topicActions}>
            <span className={topic.status==="used"?styles.topicUsed:topic.status==="active"?styles.topicActive:styles.topicPending}>
              {topic.status==="used"?"사용 완료":topic.status==="active"?"진행 중":"대기"}
            </span>
            <button onClick={()=>useTopic(topic)}>{state.topicId===topic.id?"작업 중":"이 주제로 시작"}</button>
            <select value={topic.status} aria-label={topic.title+" 사용 상태"} onChange={e=>patchTopicStatus(topic.id,e.target.value as TopicStatus)}>
              <option value="pending">대기</option><option value="active">진행 중</option><option value="used">사용 완료</option>
            </select>
          </div>
        </article>)}
      </div> : <div className={styles.topicBankEmpty}>현재 선택한 상태의 주제가 없습니다.</div>}
      <details id="topic-bank-add" className={styles.topicAdd}>
        <summary>ChatGPT 주제 붙여넣기 · 목록 백업 및 복원</summary>
        <label className={styles.field}><span>ChatGPT가 추천한 10개 제목을 한 줄에 하나씩 붙여넣기</span>
          <textarea rows={5} value={bulkTopics} onChange={e=>setBulkTopics(e.target.value)}
            placeholder={"AI 3사가 가장 살기 좋은 나라로 선택한 곳은?\nAI 3사가 고른 최고의 스마트폰은?"}/></label>
        <div className={styles.actions}><button disabled={!bulkTopics.trim()} onClick={appendBulkTopics}>중복 제외하고 모두 추가</button>
          <button onClick={downloadTopicBank}>현재 주제 목록 JSON 백업 ↓</button>
          <label className={styles.topicImportLabel}>백업 JSON 가져오기
            <input type="file" accept=".json,application/json" disabled={topicImportBusy} onChange={e=>{
              const file=e.currentTarget.files?.[0]||null;e.currentTarget.value="";void importTopicBank(file);
            }}/></label>
        </div>
        <small>ChatGPT에서 받은 주제를 붙여넣고 [중복 제외하고 모두 추가]를 누르면 저장됩니다. 별도의 유료 API 호출은 없습니다. 다른 브라우저에서는 JSON 백업·복원을 이용하세요.</small>
      </details>
    </section>

    <section className={styles.quickBar}>
      <div><strong>간편 제작 · 3단계</strong><p>추천 비교는 질문과 세 AI의 답변만, 정답 맞히기는 PDF와 정답 자료까지 넣으면 됩니다. 기존 자료는 그대로 유지됩니다.</p></div>
      <button onClick={()=>setAdvancedMode(v=>!v)}>{advancedMode?"← 간편 제작으로 돌아가기":"기존 세부 입력 화면 열기 ↗"}</button>
    </section>
    {!advancedMode && <>
      {state.mode==="recommend" ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 01 / 03</span><h2>세 AI에게 물어볼 같은 질문</h2>
          <p>추천 비교는 PDF도 정답키도 필요하지 않습니다. 아래 질문을 동일하게 복사해 세 AI에게 전달하세요.</p></div>
          <em className={state.testQuestion.trim()?styles.good:styles.wait}>{state.testQuestion.trim()?"질문 준비 완료":"질문 필요"}</em>
        </div>
        <p className={styles.topicActiveTitle}>선택한 주제: <strong>{state.title}</strong></p>
        <label className={styles.field}><span>동일한 영어 질문 · 수정할 수 있습니다</span>
          <textarea value={state.testQuestion} onChange={e=>updateQuestion(e.target.value)} rows={5}/></label>
        <div className={styles.actions}><button className={styles.primary} disabled={!state.testQuestion.trim()}
          onClick={()=>void copy(commonPrompt,"AI 3사 공통 질문")}>ChatGPT · Claude · Gemini 공통 질문 복사</button></div>
        <p className={styles.quickHint}>누가 객관적으로 정답인지는 채점하지 않습니다. 각 AI가 고른 대상, 선정 기준, 장단점과 근거를 비교합니다.</p>
      </section> : <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 01 / 03</span><h2>PDF와 Work 정답 자료 넣기</h2>
          <p>실험용 PDF 한 장과 Work의 비공개 JSON(또는 정답표 전체)을 입력하세요. 정답·출처·질문을 따로 나눠 적을 필요가 없습니다.</p></div>
          <em className={fixtureReady&&keyReady?styles.good:styles.wait}>{fixtureReady&&keyReady?"✓ 자료 준비":"자료 필요"}</em>
        </div>
        <div className={styles.actions}>
          <button onClick={()=>void copy(buildWorkPdfRequest(state),"Work 실험자료 요청서")}>Work에 줄 PDF 제작 요청서 복사</button>
          <button onClick={()=>setAdvancedMode(true)}>주제 변경·텍스트 실험</button>
        </div>
        {state.fixtureMode==="pdf" ? <div className={styles.pdfPanel}>
          <label><strong>① 같은 PDF 파일 등록</strong>
            <input type="file" accept="application/pdf,.pdf" disabled={pdfBusy}
              onChange={e=>{void uploadPdf(e.currentTarget.files?.[0]||null);e.currentTarget.value="";}}/>
          </label>
          {state.pdf && <div className={styles.pdfMeta}><strong>{state.pdf.name}</strong>
            <span>{pdfAvailable?"✓ 원본 확인됨":"이 브라우저에서 원본 PDF 재등록 필요"} · {state.pdf.bytes.toLocaleString()} bytes</span>
            <div className={styles.actions}><button disabled={!pdfAvailable} onClick={()=>void accessPdf(false)}>PDF 확인</button></div>
          </div>}
        </div> : <label className={styles.field}><span>실험용 원문 텍스트</span><textarea value={state.material} onChange={e=>updateMaterial(e.target.value)} /></label>}
        <label className={styles.field}><span>② Work의 비공개 JSON 또는 정답키 전문 붙여넣기</span>
          <textarea rows={6} value={packetInput} onChange={e=>setPacketInput(e.target.value)}
            placeholder="[EXPERIMENT_PACKET_JSON] ... [/EXPERIMENT_PACKET_JSON] 또는 PRIVATE_answer_key.txt 전문을 붙여넣으세요."/>
        </label>
        <div className={styles.actions}><button className={styles.primary} disabled={!packetInput.trim()} onClick={importQuickWorkNotes}>정답·근거 자동 불러오기</button></div>
        <p className={styles.quickHint}>{keyReady?"✓ 비공개 정답·근거 저장됨 (테스트 모델에 전송하지 않음)":"비공개 정답·근거를 가져오면 이 칸을 다시 작성할 필요가 없습니다."}</p>
        <details className={styles.advanced}><summary>영어 질문 확인·수정 (선택)</summary>
          <label className={styles.field}><span>세 AI에게 같은 질문을 입력합니다</span><textarea value={state.testQuestion} onChange={e=>updateQuestion(e.target.value)} /></label>
          <div className={styles.actions}><button disabled={!fixtureReady} onClick={()=>void copy(commonPrompt,"공통 질문")}>테스트 질문 복사</button></div>
        </details>
        <div className={styles.actions}><button disabled={!fixtureReady} onClick={()=>void copy(commonPrompt,"공통 질문")}>세 AI에게 줄 공통 질문 복사</button>
          {state.fixtureMode==="pdf"&&<button disabled={!pdfAvailable} onClick={()=>void accessPdf(true)}>동일 PDF 다운로드</button>}
        </div>
        {mismatchedQuestion&&<p className={styles.questionWarning}>제목과 공통 질문이 맞지 않습니다. 고급 화면에서 수정해 주세요.</p>}
        {!noKeyLeak&&<p className={styles.questionWarning}>공통 질문 또는 파일명에서 정답이 노출될 가능성이 있습니다.</p>}
      </section>}

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 02 / 03</span><h2>AI 답변 3개 + 내 경험만 붙여넣기</h2>
          <p>각 AI에서 나온 답변을 요약하지 말고 그대로 붙여넣으세요. 모델명과 사람 기록은 선택 입력입니다.</p></div><strong>{completed}/3 답변</strong></div>
        <div className={styles.quickProviders}>
          {PROVIDERS.map(p=><div className={styles.quickProvider} key={p.id}>
            <div className={styles.providerHead}><h3>{p.label}</h3><a href={p.url} target="_blank" rel="noopener noreferrer">AI 사이트 ↗</a></div>
            <input className={styles.quickModel} value={state.runs[p.id].model} onChange={e=>patchRun(p.id,{model:e.target.value})}
              placeholder="표시된 모델명 (선택)"/>
            <textarea className={styles.quickAnswer} value={state.runs[p.id].response}
              onChange={e=>{patchRun(p.id,{response:e.target.value});setDraftApproved(false);}}
              placeholder={p.label+"의 실제 답변 전체를 붙여넣으세요."}/>
          </div>)}
        </div>
        {state.fixtureMode==="pdf"&&<label className={styles.checkLine}><input type="checkbox"
          checked={PROVIDERS.every(p=>state.runs[p.id].usedSamePdf)}
          onChange={e=>setState(prev=>({...prev,runs:Object.fromEntries(PROVIDERS.map(p=>
            [p.id,{...prev.runs[p.id],usedSamePdf:e.target.checked}])) as ExperimentState["runs"]}))}/>
          <span>세 AI의 새 채팅에 실제로 <strong>같은 원본 PDF와 같은 질문</strong>을 제공했습니다.</span>
        </label>}
        <details className={styles.advanced}>
          <summary>{state.mode==="recommend"?"내 의견·실제 체험·사진 추가 (선택)":"내가 직접 푼 경험·사진 추가 (선택)"}</summary>
          <div className={styles.grid2}>
            <label><span>{state.mode==="recommend"?"내가 추천하는 한 가지":"내가 선택한 답"}</span><input value={state.human.choice} onChange={e=>patchHuman({choice:e.target.value})} placeholder="내 답 (실제 기록)"/></label>
            <label><span>걸린 시간 (MM:SS)</span><input value={state.human.durationText} onChange={e=>patchHuman({durationText:e.target.value,durationSource:"manual"})} placeholder="예: 01:24"/></label>
          </div>
          <label className={styles.field}><span>풀면서 느낀 점 (짧게 적어도 됩니다)</span><textarea value={state.human.notes} onChange={e=>patchHuman({notes:e.target.value})} placeholder="실제 고민한 단서, 재미있었던 점, 확신이 들었는지 등"/></label>
          <label className={styles.checkLine}><input type="checkbox" checked={state.human.attemptedBeforeAI}
            onChange={e=>patchHuman({attemptedBeforeAI:e.target.checked})}/><span>AI 답변 보기 전에 제가 먼저 풀었습니다 (그랬을 때만 체크).</span></label>
          <label className={styles.field}><span>직접 풀면서 찍은 사진 (최대 3장 · 이미지 본문 배치는 발행 전에 확인)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photoBusy || state.human.photos.length>=3}
              onChange={e=>{void uploadHumanPhotos(Array.from(e.currentTarget.files||[]));e.currentTarget.value="";}}/>
          </label>
          {state.human.photos.length>0&&<div className={styles.humanPhotos}>{state.human.photos.map(p=>
            <div className={styles.humanPhotoCard} key={p.sha256}>
              {humanPhotoUrls[p.sha256]&&<img src={humanPhotoUrls[p.sha256]} alt="사용자가 등록한 실제 풀이 사진" />}
              <small>{p.name}</small>
              <div className={styles.actions}><button onClick={()=>void downloadHumanPhoto(p)}>다운로드</button><button onClick={()=>void removeHumanPhoto(p.sha256)}>삭제</button></div>
            </div>)}</div>}
          {!validateChallengeDuration(state.human.durationText)&&<p className={styles.questionWarning}>시간은 MM:SS 형식으로 입력해 주세요.</p>}
        </details>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 03 / 03</span><h2>Google Blog 발행 스케줄로 자료 보내기</h2>
          <p>AI 3사 답변과 비교자료를 저장한 뒤 기존 Google Blog 제작실에서 <strong>본문 작성 → 이미지 6장 → Blogger 미리보기 → 발행</strong> 순서로 진행합니다.</p></div></div>
        <div className={styles.quickFinal}>
          <p className={styles.muted}>{state.mode==="recommend"?
            "주관적 추천 비교 · 공통 질문 "+(state.testQuestion.trim()?"✓":"미완료")+" · 실제 AI 답변 "+completed+"/3":
            "정답 맞히기 · 원본/정답/근거 "+(comparisonReady?"✓":"미완료")+" · AI 답변 "+completed+"/3"}</p>
          <button className={styles.quickGenerate} disabled={!comparisonReady} onClick={sendEvidenceToSchedule}>
            실험 자료 저장 · Google Blog 제작실로 이동 →
          </button>
          <p className={styles.quickHint}>추가 API 연결 없이 자료를 전달합니다. 본문은 Google Blog 스케줄의 기존 GPT 요청서 버튼으로 작성하세요. AI 답변이나 정답키가 없는 상태에서 결과를 만들어내지 않습니다.</p>
          {draftFeedback?.kind==="error"&&<div role="alert" className={styles.draftError}>{draftFeedback.message}</div>}
        </div>
        <details className={styles.advanced}>
          <summary>이전 방식: 실험실에서 별도로 글 작성·가져오기 (선택)</summary>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 03 / 03</span><h2>ChatGPT에서 글 작성하고 사이트로 가져오기</h2>
          <p>ChatGPT 웹에서 비교 분석과 영문 글을 작성합니다. 사이트는 요청서를 정리하고 결과를 보관하며 발행리스트로 전달합니다. 유료 API 호출은 하지 않습니다.</p></div></div>
        <div className={styles.quickFinal}>
          <p className={styles.muted}>{state.mode==="recommend"
            ?"추천 비교 · 공통 질문 "+(state.testQuestion.trim()?"✓":"미완료")+" · AI 답변 "+completed+"/3"
            :"정답 실험 · PDF/질문 "+(fixtureReady?"✓":"미완료")+" · Work 정답키 "+(keyReady?"✓":"미완료")+" · AI 답변 "+completed+"/3"}</p>
          <button className={styles.quickGenerate} disabled={!comparisonReady||!validateChallengeDuration(state.human.durationText)}
            onClick={openChatGptArticle}>① ChatGPT에서 영문 블로그 글 작성 ↗</button>
          <p className={styles.quickHint}>요청서가 클립보드에 복사되고 ChatGPT가 새 탭으로 열립니다. <strong>Ctrl+V</strong>로 붙여넣어 보내세요. 정답형 PDF 실험은 원본 PDF도 같은 채팅에 직접 첨부해 주세요.</p>
          <div className={styles.actions}>
            <button onClick={()=>void copy(buildChatGptArticlePrompt(state),"ChatGPT 영문 글 요청서")}>요청서만 복사</button>
            <button onClick={()=>window.open("https://chatgpt.com/","_blank","noopener,noreferrer")}>ChatGPT 열기 ↗</button>
          </div>
          {draftFeedback&&<div className={draftFeedback.kind==="error"?styles.draftError:
              draftFeedback.kind==="success"?styles.draftSuccess:styles.draftLoading}
              role={draftFeedback.kind==="error"?"alert":"status"} aria-live="polite">
            <strong>{draftFeedback.kind==="error"?"확인 필요":draftFeedback.kind==="success"?"원고 가져오기 완료":"ChatGPT에 요청서 보내기"}</strong>
            <p>{draftFeedback.message}</p>
          </div>}
        </div>
        <div className={styles.chatGptImportPanel}>
          <h3>② ChatGPT에서 작성한 글 전체 붙여넣기</h3>
          <p>답변의 시작부터 끝까지 복사해 아래에 넣고 [글 결과 가져오기]를 눌러 주세요.</p>
          <textarea rows={9} value={chatGptDraftInput} onChange={e=>setChatGptDraftInput(e.target.value)}
            placeholder={"[WORLD_BLOG_DRAFT_JSON] ... [/WORLD_BLOG_DRAFT_JSON] 전체를 붙여넣으세요."}/>
          <div className={styles.quickDraftActions}>
            <button className={styles.primary} disabled={!chatGptDraftInput.trim()} onClick={importChatGptResult}>③ 글 결과 가져오기 · 비교 결과 표시</button>
            <button onClick={()=>setChatGptDraftInput("")} disabled={!chatGptDraftInput}>입력칸 비우기</button>
          </div>
        </div>
        {currentDraft&&<div id="auto-draft-result" className={styles.draftResult}>
          <h3 className={styles.quickResultHeading}>{currentDraft.title}</h3>
          {currentDraft.needsReview.length>0&&<div className={styles.quickWarnings}><strong>확인 필요 — 발행 전 수정</strong>
            <ul>{currentDraft.needsReview.map((v,i)=><li key={i}>{v}</li>)}</ul>
            <p>PDF와 Work 원래 정답이 다르다면 정답을 임의로 바꾸지 말고 같은 실험 파일인지 먼저 확인하세요.</p></div>}
          <div className={styles.quickVerdicts}>
            {currentDraft.scores.map(s=><div key={s.provider}>
              <strong>{PROVIDERS.find(p=>p.id===s.provider)?.label}</strong>
              <b>{s.verdict==="recommendation"?"추천":s.verdict==="correct"?"정답":s.verdict==="incorrect"?"오답":s.verdict==="partial"?"부분 정답":"판정 보류"}</b>
              <span>{s.finalAnswer||"판독 불가"}</span>
              <p>{s.explanation}</p>
              {s.evidence&&<small>원문 근거: “{s.evidence}”</small>}
            </div>)}
          </div>
          <div className={styles.quickDraftActions}>
            <button onClick={()=>void copy(currentDraft.title,"최종 영문 제목")}>제목 복사</button>
            <button onClick={()=>void copy(currentDraft.html,"Blogger HTML 원고")}>글 HTML 복사</button>
            <button onClick={()=>void copy(currentDraft.metaDescription,"검색 설명")}>검색 설명 복사</button>
            <button onClick={()=>void copy(currentDraft.labels.join(", "),"블로그 라벨")}>라벨 복사</button>
          </div>
          <label className={styles.field}><span>Blogger 영문 HTML 초안 (여기서 바로 수정할 수 있습니다)</span>
            <textarea className={styles.quickDraftHtml} value={currentDraft.html}
              onChange={e=>setSavedDraft(prev=>prev?{...prev,draft:{...prev.draft,html:e.target.value}}:prev)}/>
          </label>
          <div className={styles.quickDraftActions}>
            <button className={styles.primary} disabled={!currentDraft.ready||Boolean(currentDraft.needsReview.length)||draftApproved}
              onClick={approveQuickDraft}>{draftApproved?"✓ 검토 완료":"결과 확인 · 발행 준비"}</button>
            <button className={styles.queue} disabled={!draftApproved||(state.mode==="quiz"&&!allScored)} onClick={sendToQueue}>작성된 글 그대로 발행리스트에 등록 →</button>
            {state.mode==="quiz"&&<button disabled={!fixtureReady||archiving} onClick={()=>void exportEvidenceZip()}>실험 자료 ZIP 백업</button>}
          </div>
        </div>}
        </details>
        <div className={styles.resetRow}><button onClick={reset}>새 실험 초기화</button><small>입력값과 생성 글은 브라우저에 저장됩니다. 발행은 최종 확인 후 진행하세요.</small></div>
      </section>
    </>}
    {advancedMode&&<>
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
      <p className={styles.muted}>PDF 실험에서는 별도의 텍스트 자료를 복사할 필요가 없습니다. 정답은 STEP 06에서 입력합니다.</p>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 04 · HUMAN CHALLENGE</span><h2>나도 직접 문제 풀어보기</h2>
        <p>선택 참여 · 내가 고른 답, 실제 걸린 시간, 느낀 점과 사진을 남기면 최종 글에 1인칭 체험담으로 반영됩니다.</p></div>
        <em className={state.human.choice.trim()?styles.good:styles.wait}>{state.human.choice.trim()?"✓ 사람의 답 기록됨":"선택 참여"}</em>
      </div>
      <p className={styles.muted}>가능하면 AI 답변을 보기 전에 문제를 풀고, 실제로 있었던 일만 적으세요. 사진과 풀이 시간이 없어도 됩니다.</p>
      <div className={styles.humanTimer}>
        <div>
          <span>문제 풀이 타이머</span>
          <strong>{timerStartedAt===null ? (state.human.durationText||"00:00") : formatChallengeDuration(Math.floor(((timerNow||Date.now())-timerStartedAt)/1000))}</strong>
          <small>시작과 종료 사이 실제 경과 시간 · 직접 입력도 가능</small>
        </div>
        <div className={styles.actions}>
          <button disabled={!fixtureReady || timerStartedAt!==null} onClick={startHumanTimer}>시작</button>
          <button className={styles.primary} disabled={timerStartedAt===null} onClick={stopHumanTimer}>종료 · 기록</button>
        </div>
      </div>
      <div className={styles.grid2}>
        <label><span>내가 선택한 답</span><input value={state.human.choice} onChange={e=>patchHuman({choice:e.target.value})} placeholder="예: Singapore / 7번 국가명" /></label>
        <label><span>걸린 시간 (분:초)</span><input value={state.human.durationText} onChange={e=>patchHuman({durationText:e.target.value,durationSource:"manual"})} placeholder="예: 01:24" inputMode="numeric" /></label>
      </div>
      {!validateChallengeDuration(state.human.durationText) && <p className={styles.questionWarning} role="alert">시간을 MM:SS 형식으로 입력하세요. 예: 01:24</p>}
      <div className={styles.field}>
        <span>느낀 난이도 (선택)</span>
        <div className={styles.fixtureChoice}>
          {([{value:"easy",label:"쉬움"},{value:"medium",label:"보통"},{value:"hard",label:"어려움"}] as const).map(item=>
            <label key={item.value}><input type="radio" name="humanDifficulty" checked={state.human.difficulty===item.value} onChange={()=>patchHuman({difficulty:item.value})}/>{item.label}</label>)}
        </div>
      </div>
      <label className={styles.field}><span>문제를 풀면서 어땠나요? · 간단히 적어도 됩니다</span>
        <textarea value={state.human.notes} onChange={e=>patchHuman({notes:e.target.value})} placeholder="예: 처음에는 통화를 보고 헷갈렸다. GST라는 단서를 보고 한 나라로 좁혔지만 확신은 없었다. 실제로 경험한 것만 적어주세요." rows={3}/>
      </label>
      <label className={styles.checkLine}><input type="checkbox" checked={state.human.attemptedBeforeAI}
        onChange={e=>patchHuman({attemptedBeforeAI:e.target.checked})} />
        <span>AI 세 곳의 답변을 보기 전에 제가 먼저 풀었습니다. (실제로 그랬을 때만 체크)</span>
      </label>
      <div className={styles.humanPhotoPanel}>
        <strong>실제 문제 푸는 사진 등록 · 최대 3장 (선택)</strong>
        <p className={styles.muted}>JPG·PNG·WebP · 한 장당 최대 10MB · 사진 미리보기와 개별 다운로드 가능. 사진은 현재 브라우저에만 저장되며 GPT·Blogger에는 자동 전송되지 않습니다.</p>
        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple
          disabled={photoBusy || state.human.photos.length>=3}
          onChange={e=>{void uploadHumanPhotos(Array.from(e.currentTarget.files||[]));e.currentTarget.value="";}} />
        {state.human.photos.length>0 && <div className={styles.humanPhotos}>
          {state.human.photos.map((photo,i)=><div className={styles.humanPhotoCard} key={photo.sha256}>
            {humanPhotoUrls[photo.sha256] ?
              <img src={humanPhotoUrls[photo.sha256]} alt={"직접 등록한 사람 도전 사진 "+(i+1)} loading="lazy" /> :
              <div className={styles.humanPhotoUnavailable}>사진 원본 확인 중이거나 현재 브라우저에서 찾을 수 없습니다.</div>}
            <small>{photo.name}</small>
            <div className={styles.actions}><button onClick={()=>void downloadHumanPhoto(photo)}>다운로드</button>
              <button onClick={()=>void removeHumanPhoto(photo.sha256)}>삭제</button></div>
          </div>)}
        </div>}
        <small>블로그 공개 전에 사진 속 얼굴·화면·개인정보와 원본 사진의 GPS/EXIF 정보를 확인하세요.</small>
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 05</span><h2>기본 버전 · ChatGPT · Claude · Gemini</h2>
        <p>세 곳 모두 무료/기본 일반 채팅을 우선 사용합니다. Pro/심층 리서치·추가 추론·웹검색·외부 연결 앱은 사용하지 않는 것을 기본 조건으로 합니다.</p></div><strong>{completed}/3 답변</strong></div>
      <div className={styles.baselineGuide}>
        <strong>{state.protocol==="basic" ? "기본 비교 실험 · 활성" : "이전 실험 설정 · 기본 비교 미적용"}</strong>
        <p>별도 앱의 모델·요금제 설정을 사이트에서 직접 변경하지는 못합니다. 각 AI 사이트에서 설정하고 실제 사용 상태를 아래에 기록해 주세요. 웹검색이 자동으로 실행됐다면 '사용'으로 표시합니다.</p>
        {state.protocol==="legacy" && <button className={styles.primary} onClick={switchToBasicProtocol}>이 실험을 기본 채팅 기준으로 다시 시작</button>}
        <div className={styles.baselineServices}>
          {PROVIDERS.map(p=><div key={p.id}>
            <b>{p.label}</b>
            <span>{p.id==="chatgpt"?"무료/게스트 가능하면 이용 · 새 채팅 · Instant/일반 응답":p.id==="claude"?"무료 일반 채팅 · Research/확장 사고 OFF": "무료 기본 모델 · 표준 사고 · Deep Research/Deep Think OFF"}</span>
          </div>)}
        </div>
        <small>모델명은 서비스 업데이트에 따라 달라지므로 임의로 고정하지 않고 실제 화면에 표시된 이름을 기록합니다.</small>
      </div>
      <label className={styles.field}><span>공통 테스트 프롬프트 · 비어 있으면 아래 예시가 자동 적용됩니다</span><textarea value={state.commonPrompt} onChange={e=>updateCommonPrompt(e.target.value)} placeholder={defaultCommonPrompt(state)} /></label>
      <div className={styles.actions}>
        {state.protocol==="basic" && <small>기본 비교 공통 안내(웹검색·Deep Research·외부 앱 사용 금지)가 복사되는 질문 앞에 자동으로 추가됩니다. 실제 사용 여부는 아래에서 확인해 기록하세요.</small>}
        <button disabled={!fixtureReady} onClick={() => void copy(commonPrompt, "공통 테스트 프롬프트")}>공통 질문 복사</button>
        {state.fixtureMode==="pdf" && <button disabled={!fixtureReady || !pdfAvailable} onClick={()=>void accessPdf(true)}>세 AI에게 줄 동일 PDF 다운로드</button>}
        {!fixtureReady && <small>PDF 또는 텍스트 자료와 공통 질문을 확인하면 바로 테스트할 수 있습니다.</small>}
      </div>
      {!fixtureReady && <div className={styles.questionWarning} role="status">
        <strong>답변 원문은 지금 붙여넣어 저장할 수 있습니다.</strong>
        <p>{state.fixtureMode==="pdf" ? (!state.pdf ? "STEP 02에서 원본 PDF 등록이 아직 완료되지 않았습니다." : (!pdfAvailable ? "등록된 PDF의 원본 파일을 이 미리보기 주소에서 찾지 못했습니다. STEP 02에서 동일 PDF를 재등록하세요." : "PDF는 등록됐지만 질문·실험 설정을 확인해야 합니다.")) : (!state.material.trim() ? "AI에게 보여줄 텍스트 자료를 먼저 등록해야 합니다." : "질문·실험 설정을 확인해야 합니다.")} {!state.testQuestion.trim()?"STEP 03의 영어 질문도 비어 있습니다.":""} 답변은 보관되지만 PDF·질문·비공개 정답 및 실제 판정이 검증될 때까지 최종 글 제작은 잠깁니다.</p>
      </div>}
      <div className={styles.providerTabs}>
        {PROVIDERS.map(p => <button key={p.id} className={activeProvider===p.id?styles.providerActive:""} onClick={()=>setActiveProvider(p.id)}>
          <strong>{p.label}</strong><small>{state.runs[p.id].response.trim() ? "답변 저장됨" : "대기"}</small>
        </button>)}
      </div>
      <div className={styles.providerBox}>
        <div className={styles.providerHead}><h3>{PROVIDERS.find(p=>p.id===activeProvider)?.label}</h3><a href={PROVIDERS.find(p=>p.id===activeProvider)?.url} target="_blank" rel="noopener noreferrer">AI 사이트 열기 ↗</a></div>
        <p className={styles.muted}>모델명·설정·원문 답변은 PDF 준비 상태와 관계없이 미리 기록할 수 있습니다. 원문을 붙여넣은 뒤에도 PDF 원본과 공통 질문이 정확히 일치하는지 꼭 확인하세요.</p>
        <div className={styles.baselineChecklist}>
          <strong>무료/기본 채팅 설정 확인</strong>
          <small>기본 모드 설정은 AI 서비스 화면에서 직접 선택해야 합니다.</small>
          <div className={styles.baselineSteps}>
            {(getProviderBaselineHint(activeProvider)?.steps||[]).map((instruction,i)=><div key={i}>{instruction}</div>)}
          </div>
          <label className={styles.checkLine}><input type="checkbox" checked={run.newChat}
            onChange={e=>patchRun(activeProvider,{newChat:e.target.checked})}/>
            <span>기존 문제 제작 채팅과 완전히 분리된 새 채팅에서 테스트함</span>
          </label>
          <div className={styles.baselineSettingGrid}>
            <label><span>실제 이용한 계정 등급</span>
              <select value={run.accountPlan} onChange={e=>patchRun(activeProvider,{accountPlan:e.target.value as ProviderRun["accountPlan"]})}>
                <option value="">기록 필요</option><option value="free">무료 (Free)</option><option value="guest">로그아웃 / 게스트</option>
                <option value="paid">유료 (Plus/Pro 등)</option><option value="unknown">확인 불가</option>
              </select>
            </label>
            <label><span>실제 응답 모드</span>
              <select value={run.chatMode} onChange={e=>patchRun(activeProvider,{chatMode:e.target.value as ProviderRun["chatMode"]})}>
                <option value="">기록 필요</option><option value="standard">기본 / 일반 채팅</option>
                <option value="advanced">추가 추론 / Research / 심층</option><option value="unknown">확인 불가</option>
              </select>
            </label>
            <label><span>웹검색 · 외부 사이트 검색 실제 사용</span>
              <select value={run.webUsed} onChange={e=>patchRun(activeProvider,{webUsed:e.target.value as ProviderRun["webUsed"]})}>
                <option value="unknown">확인 전</option><option value="no">미사용 확인</option><option value="yes">사용됨</option>
              </select>
            </label>
            <label><span>심층 리서치 · 외부 앱 등 추가 기능 사용</span>
              <select value={run.extraToolsUsed} onChange={e=>patchRun(activeProvider,{extraToolsUsed:e.target.value as ProviderRun["extraToolsUsed"]})}>
                <option value="unknown">확인 전</option><option value="no">미사용 확인</option><option value="yes">사용됨</option>
              </select>
            </label>
          </div>
          <small>기본 무료 모드 판정: {baselineStatus(run).label}. 유료·검색·추가 기능 사용이나 미확인은 최종 글에 그대로 기록합니다. PDF를 읽는 일반 파일 첨부는 추가 리서치 도구로 간주하지 않습니다.</small>
        </div>
        <label><span>실제 표시된 모델명 (필수 기록 권장)</span><input value={run.model} onChange={e=>patchRun(activeProvider,{model:e.target.value})} placeholder="예: 서비스 화면에 표시된 모델명 그대로" /></label>
        <label className={styles.field}><span>실험 날짜</span><input type="date" value={run.testedAt} onChange={e=>patchRun(activeProvider,{testedAt:e.target.value})} /></label>
        {state.fixtureMode==="pdf" && <label className={styles.checkLine}><input type="checkbox" checked={run.usedSamePdf} onChange={e=>patchRun(activeProvider,{usedSamePdf:e.target.checked})}/><span>위 사이트의 <strong>{PROVIDERS.find(p=>p.id===activeProvider)?.label}</strong> 새 채팅에, 위의 동일 PDF를 첨부하고 공통 질문을 입력했습니다.</span></label>}
        <label className={styles.field}><span>AI 실제 답변 전체</span><textarea className={styles.answer} value={run.response} onChange={e=>patchRun(activeProvider,{response:e.target.value})} placeholder="받은 답변을 그대로 붙여넣기" /></label>
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 06</span><h2>정답 입력 · 사람과 AI 결과 비교</h2><p>사람과 세 AI의 실제 답변을 모은 뒤 Work에서 PDF 제작 때 미리 정한 정답을 입력하세요. 사이트에서 따로 잠글 필요는 없습니다.</p></div><em className={allScored?styles.good:styles.wait}>{allScored?"✓ 결과 비교 완료":"정답·결과 확인"}</em></div>
      <div className={styles.truthGrid}>
        <label><span>정답 (Work에서 PDF 제작할 때 확정한 원래 답)</span><textarea value={state.groundTruth} onChange={e=>updateGroundTruth(e.target.value)} placeholder="예: 국기 문제라면 가상 국가의 번호·이름. 영수증 문제라면 사전 결정된 국가·근거." /></label>
        <label><span>정답 출처·근거</span><textarea value={state.sources} onChange={e=>patch("sources",e.target.value)} placeholder="Work 원본 답안의 공식 출처 URL, 제작 근거, 판정 기준과 검증이 필요한 점을 입력하세요." /></label>
      </div>
      <details className={styles.advanced}><summary>실험의 숨은 설정 메모 (선택)</summary>
        <label className={styles.field}><span>비공개 트릭 · 테스트 AI에게 전달하지 않음</span><textarea value={state.hiddenTwist} onChange={e=>patch("hiddenTwist",e.target.value)} placeholder="필요할 때만 기록" /></label>
      </details>
      {!keyReady && <p className={styles.muted}>답변 수집에는 필요하지 않습니다. 최종 글을 만들 때 Work의 원래 정답과 근거를 입력하세요.</p>}
      {state.human.choice.trim() && <div className={styles.humanVerdict}>
        <strong>Human · 내가 직접 고른 답</strong>
        <span>{state.human.choice}</span>
        <label><span>내 정답 여부 (선택)</span><select disabled={!keyReady} value={state.human.verdict}
            onChange={e=>patchHuman({verdict:e.target.value as HumanChallenge["verdict"]})}>
          <option value="">정답표와 비교해 선택하세요</option>
          <option value="correct">정답</option><option value="incorrect">오답</option>
          <option value="partial">부분 정답</option><option value="uncertain">판정 보류</option>
        </select></label>
        <small>미판정이어도 AI 3사 글 제작은 가능합니다. 최종 글에서는 '사람 미채점'이라고 표시합니다.</small>
      </div>}
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
      <div className={styles.panelHead}><div><span>STEP 07</span><h2>사람과 AI의 실제 이야기로 영문 글 만들기</h2><p>문제를 공개하고 → 실제 사람의 경험(선택 참여) → 세 AI의 원문 판단 → 네 참가자의 결과 비교 → 정답 공개 순서로 작성합니다.</p></div></div>
      <div className={styles.summaryRow}>
        {state.human.choice.trim() && <div><strong>Human</strong><span>{state.human.verdict ? {correct:"정답",incorrect:"오답",partial:"부분 정답",uncertain:"판정 보류"}[state.human.verdict]:"정답 미판정"}</span><small>{state.human.choice} {state.human.durationText ? " · "+state.human.durationText : ""}</small></div>}
        {PROVIDERS.map(p=>{const r=state.runs[p.id];return <div key={p.id}><strong>{p.label}</strong><span>{r.reviewed && r.verdict ? {correct:"정답",incorrect:"오답",partial:"부분 정답",uncertain:"판정 보류",recommendation:"추천"}[r.verdict] : "답변 또는 검토 필요"}</span><small>{r.finalAnswer || "선택한 답 미기록"}</small></div>})}</div>
      <div className={styles.actions}>
        <button disabled={!allScored} onClick={()=>void copy(report,"실험 검증 리포트")}>검증 리포트 복사</button>
        <button disabled={!allScored} onClick={()=>void copy(articlePrompt,"영문 Blogger 요청서")}>영문 글 요청서 복사</button>
        <button className={styles.primary} disabled={!allScored} onClick={()=>openPrompt(articlePrompt)}>GPT에서 최종 글 만들기</button>
        <button className={styles.queue} disabled={!allScored} onClick={sendToQueue}>최종 글 제작을 발행리스트로 보내기 →</button>
        <button disabled={!fixtureReady || archiving || (state.fixtureMode==="pdf" && !pdfAvailable)} onClick={()=>void exportEvidenceZip()}>비공개 원본·PDF·답변 ZIP 백업 ↓</button>
      </div>
      {state.human.photos.length>0 && <p className={styles.muted}>중요: 등록한 실제 사진은 GPT로 자동 전송되지 않습니다. ZIP으로 백업하거나 사진별 다운로드 후 글 작성 대화에 직접 첨부하세요. Blogger에도 별도 업로드해야 합니다.</p>}
      <details className={styles.preview}><summary>검증 리포트 미리보기</summary><pre>{report}</pre></details>
      <details className={styles.preview}><summary>최종 글 요청서 미리보기</summary><textarea readOnly value={articlePrompt}/></details>
      <div className={styles.resetRow}><button onClick={reset}>현재 실험 초기화</button><small>실험 설계와 답변은 이 브라우저에 자동 저장됩니다.</small></div>
    </section>
    </>}
  </main>;
}
