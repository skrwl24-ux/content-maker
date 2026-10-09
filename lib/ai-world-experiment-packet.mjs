// Reproducible experiment packets for the global AI experiment studio.
// Private answer keys never enter buildBlindPrompt(). No model responses are synthesized.

export const PACKET_VERSION = "world-experiment-packet-v1";
export const FAKE_COUNTRY_TITLE = "I Gave AI 10 Countries — One Was Fake. Would It Notice?";
export const FAKE_COUNTRY_PACKET = Object.freeze({
  version: PACKET_VERSION,
  title: FAKE_COUNTRY_TITLE,
  testQuestion: "Which ONE country in the list is fictional? Give its number and name.",
  material: [
    "Here are ten country names. Identify the one that is fictional.",
    "1. Comoros",
    "2. Kiribati",
    "3. Suriname",
    "4. Eswatini",
    "5. Tuvalu",
    "6. Djibouti",
    "7. Norvessa",
    "8. Palau",
    "9. Sao Tome and Principe",
    "10. Nauru",
  ].join("\n"),
  hiddenTwist: "Nine listed countries are UN member states. Norvessa is an invented name used only in this experiment.",
  groundTruth: "7. Norvessa. The remaining nine names correspond to sovereign UN member states. A correct answer must identify Norvessa, not merely express uncertainty.",
  sources: "United Nations Member States (official list; check all nine real country entries): https://www.un.org/en/about-us/member-states\nNorvessa was invented for this synthetic test; it is not a UN member or an official sovereign-state entry.",
  sourceStatus: "verified",
});

const tidy = (v, limit = 12000) => typeof v === "string" ? v.trim().slice(0, limit) : "";

export function buildPacketRequest({ title = "", category = "", hook = "", keyword = "" } = {}) {
  return [
    "Create the ACTUAL REPRODUCIBLE TEST MATERIAL for this English-language AI experiment.",
    "This is a preparation job. Do not run the experiment and do not invent AI model responses.",
    "",
    "TITLE: " + tidy(title, 300),
    "CATEGORY: " + tidy(category, 120),
    "CONCEPT: " + tidy(hook, 1000),
    "SEARCH PHRASE: " + tidy(keyword, 200),
    "",
    "Produce: (1) the exact material that all AIs will see, (2) the exact scoring question,",
    "(3) a PRIVATE answer key and scoring criterion, (4) ground-truth evidence or derivation.",
    "Use primary/public sources where factual checks matter. Actually verify them if web research is available.",
    "For fully synthetic materials, label them synthetic and explain why the answer is reproducible.",
    "For visual/file tests, do not pretend a file exists: list required attachments and mark needs_verification.",
    "Never fill missing evidence with invented citations, dates, measurements or numbers.",
    "Do not include the answer key, grading hints or hidden twist in material or testQuestion.",
    "If you cannot establish the key reliably, set sourceStatus to needs_verification and explain what must be checked.",
    "Do not give model responses, scores or article text.",
    "",
    "Return one valid JSON object inside exactly these markers:",
    "[EXPERIMENT_PACKET_JSON]",
    "{",
    '  "version": "world-experiment-packet-v1",',
    '  "title": "English experiment title",',
    '  "testQuestion": "Exact question to the AI, no answer clues",',
    '  "material": "Complete blind test dataset/list/table; no private answer",',
    '  "hiddenTwist": "PRIVATE experiment trick, not shown to test models",',
    '  "groundTruth": "PRIVATE exact answer and scoring criterion",',
    '  "sources": "Verifiable primary links or reproducible calculations and verification limits",',
    '  "sourceStatus": "verified or needs_verification"',
    "}",
    "[/EXPERIMENT_PACKET_JSON]",
    "No markdown comments inside the JSON. Do not present uncertain facts as verified.",
  ].join("\n");
}

export function parseExperimentPacket(raw) {
  const input = tidy(raw, 50000);
  const tagged = input.match(/\[EXPERIMENT_PACKET_JSON\]([\s\S]*?)\[\/EXPERIMENT_PACKET_JSON\]/i)?.[1];
  const fenced = input.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i)?.[1];
  let data;
  try { data = JSON.parse((tagged || fenced || input).trim()); } catch { return { packet: null, error: "JSON 형식을 확인하세요." }; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { packet: null, error: "JSON 객체가 필요합니다." };
  const packet = {
    version: PACKET_VERSION,
    title: tidy(data.title, 300),
    testQuestion: tidy(data.testQuestion, 1500),
    material: tidy(data.material, 16000),
    hiddenTwist: tidy(data.hiddenTwist, 3000),
    groundTruth: tidy(data.groundTruth, 8000),
    sources: tidy(data.sources, 10000),
    sourceStatus: data.sourceStatus === "verified" ? "verified" : "needs_verification",
  };
  if (!packet.testQuestion || !packet.material || !packet.groundTruth || !packet.sources) {
    return { packet: null, error: "질문·실험자료·정답·근거가 모두 있어야 가져올 수 있습니다." };
  }
  if (packet.material === packet.groundTruth || packet.material.includes(packet.groundTruth)) {
    return { packet: null, error: "실험 자료에 정답표가 섞여 있습니다. 블라인드 자료를 분리하세요." };
  }
  return { packet, error: "" };
}

export function buildBlindPrompt({ testQuestion = "", material = "" } = {}) {
  const question = tidy(testQuestion, 1500);
  const dataset = tidy(material, 16000);
  return [
    "You are taking part in a blind AI experiment.",
    "",
    "Task:",
    question || "(No question supplied.)",
    "",
    "Material:",
    dataset || "(No material supplied.)",
    "",
    "Instructions:",
    "- Answer only from the provided material and your general reasoning unless the task explicitly asks for web research.",
    "- Do not invent missing facts.",
    "- If something cannot be determined, say so.",
    "- Give your final answer first, then briefly explain your reasoning.",
    "- Do not assume there is a trick.",
    "- Do not ask to see the answer key.",
    "",
    "Return a clear final answer that can be scored against a pre-recorded ground truth.",
  ].join("\n");
}

export function canLockExperiment({ testQuestion = "", material = "", groundTruth = "", sources = "", sourceVerified = false } = {}) {
  return Boolean(tidy(testQuestion) && tidy(material) && tidy(groundTruth) && tidy(sources) && sourceVerified);
}

export function buildWorkPdfRequest({ title = "", category = "", hook = "", keyword = "" } = {}) {
  return [
    "Create ONE actual PDF file for a blind three-model AI experiment. I do NOT need five files.",
    "Work mode: use research and document creation tools and provide a real downloadable PDF, not just a description.",
    "Do NOT run ChatGPT, Claude, or Gemini against the test. Do not invent their responses.",
    "",
    "Experiment title: " + tidy(title,300),
    "Category: " + tidy(category,120),
    "Concept: " + tidy(hook,1000),
    "Search phrase: " + tidy(keyword,200),
    "",
    "DOWNLOADABLE FILE (ONE ONLY):",
    "- blind_test.pdf: visually readable A4 PDF containing all information the three models will receive. No other attached files.",
    "- No correct answer, hints, creator/provider watermark, or fake/real indicators in the PDF contents, PDF properties, filename, or visual styling.",
    "- Use real selectable PDF text for all country names and other labels so text-based PDF reading works.",
    "",
    "IN YOUR CHAT REPLY (NOT ANOTHER FILE):",
    "After linking the single PDF, return ONE copyable JSON block using the exact markers below. This PRIVATE block is only for the experiment studio; NEVER give it to test models:",
    "[EXPERIMENT_PACKET_JSON]",
    "{",
    '  "title": "English experiment title",',
    '  "testQuestion": "The exact short English question to ask each AI with the attached PDF, without revealing the key",',
    '  "material": "Brief factual description of what is displayed in the PDF, without the answer key or hidden solution",',
    '  "hiddenTwist": "PRIVATE explanation of the controlled trick",',
    '  "groundTruth": "PRIVATE exact answer, precommitted scoring criterion, and any relevant derivation",',
    '  "sources": "Primary official source URLs, each relevant verification, and unresolved checks",',
    '  "sourceStatus": "verified or needs_verification"',
    "}",
    "[/EXPERIMENT_PACKET_JSON]",
    "Use valid JSON with JSON-escaped newlines; don't attach JSON or answer-key TXT files.",
    "The studio operator will paste the JSON into the site and upload only blind_test.pdf.",
    "",
    "If this is the ten countries / one fake experiment: show ten numbered entries, each with a similarly styled flag and readable country name. Nine names should refer to real sovereign countries verified using appropriate primary sources. Invent one fictional country and its fictional flag. Do not reuse a real national/regional flag. Make all ten entries visually uniform; no extra clues. Put the exact correct number, invented flag derivation, and item-by-item checks in the PRIVATE JSON only.",
    "For other subjects choose an analogous complete, reproducible PDF dataset, not a placeholder.",
    "If you cannot establish the ground truth or sources, set sourceStatus to needs_verification and describe remaining checks. Never invent sources or pretend a file exists.",
    "Don't create preview PNG, separate question TXT, private answer-key TXT, studio JSON TXT, ZIP, or any other file.",
  ].join("\n");
}


export function suggestedExperimentQuestion(title = "") {
  const t = tidy(title,500).toLowerCase();
  if (/supermarket receipt|grocery receipt|receipt.*country|country.*receipt/.test(t)) {
    return "Which country is this supermarket receipt most likely from? Name one country, cite specific clues visible in the attached PDF (such as currency and tax), and state any uncertainty.";
  }
  if (/(?:10|ten) countries|one was fake|fake country/.test(t)) {
    return "Exactly one of the ten listed countries is fictional. Which one? Give its number and name, then explain the clues behind your choice.";
  }
  return "";
}
export function mismatchedExperimentQuestion(title = "", question = "") {
  const t = tidy(title,500).toLowerCase(), q=tidy(question,2000).toLowerCase();
  if (/supermarket receipt|grocery receipt|receipt.*country|country.*receipt/.test(t)) {
    return /(?:ten|10)\s+(?:countries|country)\b|(?:fictional|fake|not real|invented)\s+(?:countries|country)\b|which one of these (?:ten|10) countries/.test(q);
  }
  if (/(?:10|ten) countries|one was fake|fake country/.test(t)) {
    return /supermarket receipt|grocery receipt|sales tax|gst\b/.test(q);
  }
  return false;
}
