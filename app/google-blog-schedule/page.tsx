"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";
import styles from "./page.module.css";
import { parseBloggerOutput } from "@/lib/google-blogger-parser.mjs";
import { buildGoogleContentPlanPrompt, googleContentPlanBlock, googleImagePlanBlock, parseGoogleContentPlan } from "@/lib/google-content-plan.mjs";
import type { GoogleContentPlan } from "@/lib/google-content-plan.mjs";
import { buildRecommendationImagePrompt, parseRecommendationReport, recommendationImageSlot } from "@/lib/experiment-recommendation-images.mjs";

type Status = "예정" | "작성 중" | "발행 완료";
type BankTopic = {id:string;title:string;category:string;question:string;status:"pending"|"active"|"used";createdAt:string;usedAt:string};
type VerificationValue = "pending" | "checked" | "na";
type VerificationState = {
  officialPrice: VerificationValue;
  webPrice: VerificationValue;
  iosPrice: VerificationValue;
  androidPrice: VerificationValue;
  tax: VerificationValue;
  payment: VerificationValue;
  checkedAt: string;
  officialSource: string;
  secondarySource: string;
};
type ImageUploadMeta = {
  path: string;
  url: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
  uploadedAt: string;
};

type ScheduleRow = {
  id: string;
  date: string;
  title: string;
  keyword: string;
  status: Status;
  url: string;
  slug?: string;
  relatedIds?: string[];
  backlinkDoneIds?: string[];
  verification?: VerificationState;
  note: string;
  contentPlanRaw?: string;
  contentPlan?: GoogleContentPlan | null;
  body?: string;
  imageUrls?: Record<string, string>;
  imageMeta?: Record<string, ImageUploadMeta>;
  kind?: "pricing" | "experiment";
  labVersion?: string;
  labReport?: string;
  labPrompt?: string;
  experimentCategory?: string;
  experimentHook?: string;
  experimentTopicId?: string;
  experimentMode?: "recommend"|"quiz";
  experimentQuestion?: string;
};

type SeoTopicCandidate = {
  id: string;
  title: string;
  keyword: string;
  url: string;
  source: "schedule" | "published";
};

type SimilarTopic = SeoTopicCandidate & {
  score: number;
  level: "high" | "medium";
};

type RollingTopicSeed = {
  title: string;
  keyword: string;
  slug: string;
  note: string;
  category: string;
  hook: string;
};

type GooglePublishHistoryItem = {
  normalized_key: string;
  title: string;
  keyword: string | null;
  url: string | null;
  slug: string | null;
  scheduled_date: string | null;
  published_on: string | null;
};

const IMAGE_SLOTS = [
  { id: "00", label: "대표 이미지", role: "글의 핵심 검색 질문과 의사결정 포인트를 한눈에 보여주는 대표 비주얼" },
  { id: "01", label: "핵심 사실", role: "독자의 결정에 필요한 최신 공식 가격·플랜·조건 등 핵심 사실을 보여주는 정보 이미지" },
  { id: "02", label: "선택 비교", role: "플랜·서비스·결제방식·해결방법 등 이번 글에서 실제로 비교해야 하는 선택지를 보여주는 이미지" },
  { id: "03", label: "Original Value", role: "이 글만의 자체 비교·판단 기준·실제 테스트 결과·행동 순서 중 핵심 차별화 가치를 보여주는 이미지" },
  { id: "04", label: "조건·한계", role: "가격·지역·세금·사용 제한·예외·주의사항 등 판단에 필요한 조건을 보여주는 이미지" },
  { id: "05", label: "핵심 정리", role: "독자가 마지막에 기억할 결정 기준과 다음 행동을 정리하는 요약 이미지" },
] as const;

const STORAGE_KEY = "content-maker-google-blog-schedule-v3-links";
const SYNC_KEY_STORAGE = "content-maker-google-blog-sync-key-v1";
const LOCAL_UPDATED_KEY = "content-maker-google-blog-local-updated-v1";
const BLOG_BASE = "https://aipriceatlas.blogspot.com";
const IMAGE_BUCKET = "content-maker-assets";
const LAB_TRANSFER_KEY = "ai-price-atlas-lab-queue-transfer-v1";
const TOPICS_KEY = "ai-world-experiment-topic-bank-v1";
const LAB_IMAGE_ROLES: Record<string, { label: string; role: string }> = {
  "00": { label: "실험 대표", role: "이 실험의 질문과 궁금증을 한눈에 보여주는 영어 대표 이미지" },
  "01": { label: "테스트 설정", role: "AI에게 실제로 보여준 자료·조건·질문을 간결하게 보여주는 이미지" },
  "02": { label: "AI 답변", role: "ChatGPT·Claude·Gemini의 실제 답변 차이를 검증 기록 범위에서 비교" },
  "03": { label: "정답 공개", role: "사전에 잠가 둔 Ground Truth와 숨겨둔 트릭을 공개하는 이미지" },
  "04": { label: "점수판", role: "이번 단일 실험의 정확도·지시 준수·환각 기록을 비교하는 이미지" },
  "05": { label: "엉뚱한 실수", role: "검증된 Weirdest Mistake와 이번 실험의 한계를 재미있게 정리" },
};
const COMPARE_IMAGE_ROLES: Record<string, {label:string;role:string}> = {
  "00":{label:"비교 대표",role:"동일한 질문에 대한 AI 3사 비교 주제를 한눈에 보여주며 실제 결과를 왜곡하지 않기"},
  "01":{label:"공통 질문",role:"세 AI가 받은 동일한 질문과 평가 기준을 보기 좋게 표시"},
  "02":{label:"AI 추천 3곳",role:"ChatGPT·Claude·Gemini가 실제 선택한 국가·브랜드·제품을 같은 기준으로 비교"},
  "03":{label:"선택 이유",role:"각 AI의 실제 선정 기준과 선택 이유가 어떻게 다른지 보여주는 정보 이미지"},
  "04":{label:"장단점·한계",role:"AI 추천의 단점·조건·확인되지 않은 주장을 분리하는 정보 이미지"},
  "05":{label:"핵심 비교 정리",role:"실제 답변에 근거한 공통점·차이점·독자가 고려할 점을 요약"},
};
function imageSlotFor(row: ScheduleRow, slot: typeof IMAGE_SLOTS[number]) {
  if (row.kind !== "experiment") return slot;
  const recommendation = recommendationImageSlot(parseRecommendationReport(row.labReport), slot.id);
  if (recommendation) return { ...slot, ...recommendation };
  const roles = row.labVersion === "WORLD-COMPARISON-V2" ? COMPARE_IMAGE_ROLES : LAB_IMAGE_ROLES;
  return { ...slot, ...roles[slot.id] };
}

const KNOWN_PUBLISHED_POSTS: SeoTopicCandidate[] = [
  {
    id: "published-chatgpt-korea-2026",
    title: "ChatGPT Plus Price in South Korea 2026",
    keyword: "ChatGPT Plus Korea price",
    url: "https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-south-korea-2026.html",
    source: "published",
  },
  {
    id: "published-chatgpt-japan-2026",
    title: "ChatGPT Plus Price in Japan 2026",
    keyword: "ChatGPT Plus Japan price",
    url: "https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-japan-2026-3000.html",
    source: "published",
  },
];

const ROLLING_TOPIC_POOL: RollingTopicSeed[] = [
  { category: "World & Geography", title: "I Gave AI 10 Countries — One Was Fake. Would It Notice?", keyword: "AI fake country test", slug: "ai-fake-country-test", note: "글로벌 호기심형 · 실제 국가 9개 + 가짜 국가 1개 · 정답은 사전 고정", hook: "Nine countries are real. One is completely invented but designed to look believable." },
  { category: "Everyday Documents", title: "Can AI Guess the Country From a Supermarket Receipt?", keyword: "AI guess country receipt", slug: "ai-guess-country-supermarket-receipt", note: "영수증 국가 맞히기 · 상호/국가명 제거 · 통화·세금·상품 단서만 제공", hook: "Hide the store and country names, then see whether everyday shopping clues are enough." },
  { category: "Food", title: "Can AI Identify 20 Foods From Around the World With the Names Removed?", keyword: "AI world food challenge", slug: "ai-world-food-identification-test", note: "세계 음식 맞히기 · 이름 제거 · 재료/형태 단서만 제공", hook: "Twenty foods, no names. How far can AI get from ingredients and visual clues alone?" },
  { category: "Languages", title: "Can AI Guess a Language From Just One Sentence?", keyword: "AI language guessing test", slug: "ai-language-guessing-test", note: "언어 맞히기 · 흔한 언어와 덜 알려진 언어 혼합 · 가짜 문장 1개 가능", hook: "One sentence each, no country labels, and one sample may not be a real language at all." },
  { category: "Maps & Geography", title: "Can AI Guess the City From a Subway Map With Station Names Hidden?", keyword: "AI subway map city test", slug: "ai-subway-map-city-test", note: "도시 맞히기 · 역명/도시명 제거 · 노선 구조만 제공", hook: "Remove every station name and city label. Is the shape of a metro network enough?" },
  { category: "Animals", title: "I Mixed Real and Fake Animal Facts — Could AI Catch Them?", keyword: "AI animal fact test", slug: "ai-real-fake-animal-facts", note: "동물 사실 검증 · 검증된 사실과 그럴듯한 가짜를 혼합", hook: "Real zoology facts sit beside believable inventions. The challenge is to spot the impostors." },
  { category: "Weather", title: "Can AI Guess the City From 12 Months of Weather Data?", keyword: "AI weather city guessing test", slug: "ai-weather-data-city-test", note: "도시 맞히기 · 월별 기온/강수 자료 · 도시명 제거", hook: "A full year of climate clues, but no city name. Can AI read the seasons correctly?" },
  { category: "History", title: "Can AI Put 15 World Events in the Right Order Without Dates?", keyword: "AI history timeline test", slug: "ai-history-timeline-without-dates", note: "역사 순서 맞히기 · 연도 제거 · 사건 설명만 제공", hook: "Take away every year and ask AI to rebuild the timeline from context alone." },
  { category: "Prices", title: "Can AI Tell Which Country Has the Higher Grocery Bill?", keyword: "AI grocery price country test", slug: "ai-grocery-bill-country-test", note: "가격 비교 실험 · 비슷한 장바구니 · 국가명 숨기기", hook: "Two grocery baskets look similar, but one country is much more expensive. Can AI tell which?" },
  { category: "Travel", title: "Can AI Spot the One Fake Landmark in a List of Real Places?", keyword: "AI fake landmark test", slug: "ai-fake-landmark-test", note: "랜드마크 검증 · 실제 9개 + 가짜 1개", hook: "Nine landmarks exist. One has a convincing name, location and backstory that were invented." },
  { category: "World Records", title: "I Gave AI 12 Weird World Records — Which Ones Did It Believe?", keyword: "AI world records fact check", slug: "ai-weird-world-records-test", note: "세계 기록 검증 · 실제 기록과 가짜 기록 혼합", hook: "Some records are stranger than fiction, which makes the fake ones harder to catch." },
  { category: "Numbers", title: "Can AI Find the One Impossible Number in a Real-Looking Data Table?", keyword: "AI data table error test", slug: "ai-impossible-number-table-test", note: "숫자 오류 찾기 · 합계/비율이 맞는 표에 오류 1개 심기", hook: "Every row looks plausible, but one value breaks the math." },
  { category: "Air Travel", title: "Can AI Guess the Airport From a Departure Board With the Airport Name Hidden?", keyword: "AI airport departure board test", slug: "ai-airport-departure-board-test", note: "공항 맞히기 · 공항명 제거 · 목적지/시간대 단서 활용", hook: "Only destinations and departure times remain. Can AI work backward to the airport?" },
  { category: "Time Zones", title: "Can AI Guess the City From Sunrise, Sunset and Time-Zone Clues?", keyword: "AI city sunrise sunset test", slug: "ai-city-sunrise-sunset-test", note: "도시 추론 · 일출/일몰/UTC 오프셋 · 도시명 숨기기", hook: "Three ordinary time clues can reveal a surprising amount about where a city might be." },
  { category: "Geography", title: "Can AI Name Countries From Their Outlines With No Labels?", keyword: "AI country outline test", slug: "ai-country-outline-test", note: "국가 윤곽 맞히기 · 라벨/국기 제거 · 난이도 혼합", hook: "No flags, no names, just outlines — from obvious shapes to countries people often confuse." },
  { category: "Population", title: "Can AI Rank 12 Countries by Population Without Looking Anything Up?", keyword: "AI population ranking test", slug: "ai-country-population-ranking-test", note: "인구 순위 실험 · 기준 연도 정답 고정 · 웹검색 금지 조건", hook: "The countries are familiar, but the middle of the ranking is much harder than it looks." },
  { category: "Travel", title: "Can AI Guess the Country From a Train Ticket With the Names Removed?", keyword: "AI train ticket country test", slug: "ai-train-ticket-country-test", note: "기차표 국가 맞히기 · 도시명/철도사명 제거 · 형식/통화 단서", hook: "Strip away the obvious labels and leave only the layout, fare and travel clues." },
  { category: "Culture", title: "Can AI Match 15 Unusual Holidays to the Right Countries?", keyword: "AI world holiday matching test", slug: "ai-world-holiday-matching-test", note: "세계 기념일 매칭 · 공식/문화기관 출처로 정답 고정", hook: "Some holidays sound invented even when they are real. Can AI match them correctly?" },
  { category: "Earth Science", title: "Can AI Guess the Region From a Week of Earthquake Data?", keyword: "AI earthquake data region test", slug: "ai-earthquake-region-test", note: "지진 데이터 추론 · 위치명 제거 · 규모/깊이/빈도 단서", hook: "Hide the map and place names, then ask whether the pattern itself points to a region." },
  { category: "Food", title: "Can AI Tell Which Country a School Lunch Comes From?", keyword: "AI school lunch country test", slug: "ai-school-lunch-country-test", note: "학교 급식 국가 맞히기 · 메뉴 구성만 제공 · 출처 검증", hook: "A lunch tray can carry cultural clues, but stereotypes can also send AI in the wrong direction." },
  { category: "Money", title: "Can AI Identify a Country From Currency Clues Without Seeing the Currency Name?", keyword: "AI currency country clues test", slug: "ai-currency-country-clues-test", note: "통화 추론 · 통화명 제거 · 금액 체계/동전·지폐 단서", hook: "Remove the currency name and symbol. Are denomination patterns enough to identify the country?" },
  { category: "Addresses", title: "Can AI Guess the Country From a Postal Address Format?", keyword: "AI postal address country test", slug: "ai-postal-address-country-test", note: "주소 형식 국가 맞히기 · 개인정보 없이 합성 주소 사용", hook: "Use synthetic addresses only and see whether formatting conventions reveal the country." },
  { category: "Nature", title: "Can AI Match 12 National Parks to Their Countries From Landscape Clues?", keyword: "AI national park country test", slug: "ai-national-park-country-test", note: "국립공원 추론 · 이름 제거 · 지형/기후 설명 활용", hook: "Remove every park name and let landscapes do the talking." },
  { category: "Cities", title: "Can AI Guess the City From Average Rent, Rainfall and Population?", keyword: "AI city data guessing test", slug: "ai-city-data-guessing-test", note: "도시 데이터 추론 · 서로 다른 데이터 3종 결합 · 기준일 고정", hook: "Three unrelated statistics may create a surprisingly distinctive city fingerprint." },
  { category: "Languages", title: "I Added One Fake Word to 20 Real Words — Would AI Catch It?", keyword: "AI fake word language test", slug: "ai-fake-word-language-test", note: "가짜 단어 찾기 · 실제 사전 단어 20개 + 조작 1개", hook: "The fake word follows the language's spelling patterns, so confidence can become a trap." },
  { category: "Geography", title: "Can AI Match 10 Flags After I Remove Their Colors?", keyword: "AI flag shape test", slug: "ai-flags-without-color-test", note: "국기 추론 · 색 제거 · 문양/구조만 사용", hook: "Take away the most obvious clue — color — and see how much flag structure AI remembers." },
  { category: "Climate", title: "Can AI Tell Which Hemisphere a City Is In From Monthly Temperatures?", keyword: "AI hemisphere temperature test", slug: "ai-hemisphere-temperature-test", note: "남북반구 맞히기 · 월별 기온만 제공 · 도시명 제거", hook: "The season pattern looks easy until tropical and high-altitude cities enter the mix." },
  { category: "Data", title: "I Gave AI Two Nearly Identical Charts — Could It Find the Misleading One?", keyword: "AI misleading chart test", slug: "ai-misleading-chart-test", note: "차트 판독 · 축/기준 차이 1개 심기 · 정답 사전 고정", hook: "The numbers are the same, but one chart quietly changes how the story looks." },
  { category: "Travel", title: "Can AI Guess the Country From Road Signs With the Text Blurred?", keyword: "AI road sign country test", slug: "ai-road-sign-country-test", note: "도로표지 국가 맞히기 · 글자 흐림 처리 · 색/형태/기호 단서", hook: "Blur the words and leave only shapes, symbols and road-design conventions." },
  { category: "Science", title: "Can AI Spot the Fake Planet Fact Hidden Among Real Space Facts?", keyword: "AI fake space fact test", slug: "ai-fake-space-fact-test", note: "우주 사실 검증 · NASA/기관 자료 기반 실제 사실 + 가짜 1개", hook: "Space is already strange enough that a made-up fact can sound perfectly believable." },
  { category: "Sports", title: "Can AI Guess the Sport From a Box Score With the Team Names Removed?", keyword: "AI sport box score test", slug: "ai-sport-box-score-test", note: "스포츠 데이터 추론 · 팀명/리그명 제거 · 기록 구조만 제공", hook: "Strip away the teams and leagues. Can the statistics alone reveal the sport?" },
  { category: "Everyday Life", title: "Can AI Guess the Country From a Restaurant Menu With Prices but No Names?", keyword: "AI restaurant menu country test", slug: "ai-restaurant-menu-country-test", note: "메뉴 국가 맞히기 · 가게/도시명 제거 · 음식/가격 단서", hook: "A menu carries language, food and price clues — but some cuisines travel extremely well." }
];

const DEFAULT_ROWS: ScheduleRow[] = ROLLING_TOPIC_POOL.slice(0, 14).map((topic, index) => {
  const date = shiftDate(todayLocal(), index - 1);
  return {
    id: "experiment-" + date + "-" + index,
    date,
    title: topic.title,
    keyword: topic.keyword,
    status: "예정",
    url: "",
    slug: topic.slug,
    relatedIds: [],
    backlinkDoneIds: [],
    note: topic.note,
    body: "",
    kind: "experiment",
    labVersion: "WORLD-LAB-V1-PLANNED",
    labReport: "",
    labPrompt: "",
    experimentCategory: topic.category,
    experimentHook: topic.hook,
  };
});

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(value: string, days: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDate(value: string) {
  return shiftDate(value, 1);
}

function normalizeGoogleTopic(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b20\d{2}\b/g, "")
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function rollingSeed(value: string) {
  return value.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function dayLabel(value: string) {
  const d = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }).format(d);
}


function plannedUrl(row: ScheduleRow) {
  if (!row.slug) return "";
  const [year, month] = row.date.split("-");
  return `${BLOG_BASE}/${year}/${month}/${row.slug}.html`;
}

function resolvedUrl(row: ScheduleRow) {
  return row.url.trim() || plannedUrl(row);
}

function isValidPublishedUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "aipriceatlas.blogspot.com" &&
      url.pathname.endsWith(".html")
    );
  } catch {
    return false;
  }
}

function relatedRows(row: ScheduleRow, allRows: ScheduleRow[]) {
  const ids = row.relatedIds || [];
  return ids.map(id => allRows.find(item => item.id === id)).filter(Boolean) as ScheduleRow[];
}

function relatedLinkText(row: ScheduleRow, allRows: ScheduleRow[]) {
  const related = relatedRows(row, allRows);
  if (!related.length) return "- 연결 후보 없음";
  return related.map(item => {
    const status = isValidPublishedUrl(item.url) ? "LIVE" : "PLANNED";
    return `- [${status}] ${item.title}\n  ${resolvedUrl(item)}`;
  }).join("\n");
}

function reverseLinkRows(row: ScheduleRow, allRows: ScheduleRow[]) {
  return allRows.filter(item => item.id !== row.id && (item.relatedIds || []).includes(row.id));
}

function suggestedAnchorText(row: ScheduleRow) {
  return row.keyword?.trim() || row.title.replace(/\s*[:?].*$/, "").trim();
}

function buildBacklinkPrompt(source: ScheduleRow, target: ScheduleRow) {
  return `AI Price Atlas의 기존 Blogger 글에 새 내부링크 1개를 자연스럽게 추가해줘.

[기존 글]
제목: ${source.title}
URL: ${source.url}

[새로 연결할 글]
제목: ${target.title}
URL: ${target.url}
추천 앵커텍스트: ${suggestedAnchorText(target)}

[작업 규칙]
- 먼저 기존 글 URL을 열어 실제 본문 내용을 확인할 것.
- 새 글과 실제로 관련 있는 문단 1곳에만 내부링크를 추가할 것.
- 기존 문맥을 해치지 말고, 필요하면 문장 1개를 자연스럽게 보완할 것.
- 억지로 exact-match 키워드를 반복하지 말고 자연스러운 영어 앵커텍스트를 사용할 것.
- 이미 같은 새 글 URL이 들어가 있다면 중복 링크를 만들지 말고 \"이미 연결됨\"이라고 알려줄 것.
- 기존 가격·날짜·사실을 임의로 바꾸지 말 것.
- Blogger HTML에서 사용할 수 있는 단순한 <a href=\"\"> 링크만 사용할 것.
- 수정할 위치와 교체/추가할 문장을 먼저 짧게 보여주고, 바로 붙여넣을 HTML 문장도 함께 제공할 것.`;
}

function backlinkPlanText(row: ScheduleRow, allRows: ScheduleRow[]) {
  const reverse = reverseLinkRows(row, allRows);
  if (!reverse.length) return "- 역방향 연결 후보 없음";
  return reverse.map(item => {
    const live = isValidPublishedUrl(item.url);
    const done = (row.backlinkDoneIds || []).includes(item.id);
    return `- [${done ? "DONE" : live ? "ACTION" : "PLANNED"}] ${item.title}\n  ${resolvedUrl(item)}\n  → ${row.url || plannedUrl(row)}\n  Anchor: ${suggestedAnchorText(row)}`;
  }).join("\n");
}

function seoTokens(value: string) {
  const stop = new Set(["in","the","a","an","and","or","to","of","for","with","by","from","is","does","how","what","2025","2026"]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 1 && !stop.has(token));
}

function topicSimilarity(a: string, b: string) {
  const aTokens = new Set(seoTokens(a));
  const bTokens = new Set(seoTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const containment = intersection / Math.min(aTokens.size, bTokens.size);
  return Math.min(1, jaccard * 0.65 + containment * 0.35);
}

function similarTopics(row: ScheduleRow, allRows: ScheduleRow[]): SimilarTopic[] {
  const currentText = `${row.title} ${row.keyword}`.trim();
  if (!currentText) return [];
  const scheduleCandidates: SeoTopicCandidate[] = allRows
    .filter(item => item.id !== row.id)
    .map(item => ({
      id: item.id,
      title: item.title,
      keyword: item.keyword,
      url: resolvedUrl(item),
      source: "schedule" as const,
    }));
  return [...KNOWN_PUBLISHED_POSTS, ...scheduleCandidates]
    .map(item => {
      const candidateText = `${item.title} ${item.keyword}`.trim();
      const exactKeyword = !!row.keyword.trim() && row.keyword.trim().toLowerCase() === item.keyword.trim().toLowerCase();
      const score = exactKeyword ? 1 : topicSimilarity(currentText, candidateText);
      const level: SimilarTopic["level"] | null = score >= 0.78 ? "high" : score >= 0.56 ? "medium" : null;
      return level ? { ...item, score, level } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b as SimilarTopic).score - (a as SimilarTopic).score) as SimilarTopic[];
}

const VERIFICATION_ITEMS: Array<{ key: keyof Pick<VerificationState, "officialPrice" | "webPrice" | "iosPrice" | "androidPrice" | "tax" | "payment">; label: string; short: string }> = [
  { key: "officialPrice", label: "공식 가격", short: "Official price" },
  { key: "webPrice", label: "웹 가격", short: "Web price" },
  { key: "iosPrice", label: "iOS 가격", short: "iOS price" },
  { key: "androidPrice", label: "Android 가격", short: "Android price" },
  { key: "tax", label: "세금·VAT/GST", short: "Tax / VAT / GST" },
  { key: "payment", label: "결제수단", short: "Payment methods" },
];

function emptyVerification(): VerificationState {
  return {
    officialPrice: "pending",
    webPrice: "pending",
    iosPrice: "pending",
    androidPrice: "pending",
    tax: "pending",
    payment: "pending",
    checkedAt: "",
    officialSource: "",
    secondarySource: "",
  };
}

function getVerification(row: ScheduleRow): VerificationState {
  return { ...emptyVerification(), ...(row.verification || {}) };
}

function verificationResolvedCount(row: ScheduleRow) {
  const v = getVerification(row);
  return VERIFICATION_ITEMS.filter(item => v[item.key] !== "pending").length;
}

function verificationCheckedCount(row: ScheduleRow) {
  const v = getVerification(row);
  return VERIFICATION_ITEMS.filter(item => v[item.key] === "checked").length;
}

function verificationValueLabel(value: VerificationValue) {
  return value === "checked" ? "확인" : value === "na" ? "해당 없음" : "미확인";
}

function verificationSummary(row: ScheduleRow) {
  const v = getVerification(row);
  return [
    `마지막 확인일: ${v.checkedAt || "미입력"}`,
    `공식 출처: ${v.officialSource || "미입력"}`,
    `보조 출처: ${v.secondarySource || "미입력"}`,
    ...VERIFICATION_ITEMS.map(item => `${item.short}: ${verificationValueLabel(v[item.key])}`),
  ].join("\n");
}

function buildVerificationPrompt(row: ScheduleRow) {
  return [
    "AI Price Atlas 글 발행 전 사실 검증을 해줘.",
    "",
    "[글]",
    `제목: ${row.title}`,
    `핵심 키워드: ${row.keyword}`,
    `기획 메모: ${row.note}`,
    "",
    "[현재 저장된 검증 기록]",
    verificationSummary(row),
    "",
    "[검증할 항목]",
    "1. 서비스 제공사의 공식 가격 페이지에서 현재 가격 확인",
    "2. 웹 결제 가격과 표시 통화 확인",
    "3. iOS 앱스토어 결제 가격 또는 확인 가능 여부",
    "4. Android/Google Play 결제 가격 또는 확인 가능 여부",
    "5. 세금/VAT/GST 포함 여부와 국가별 주의사항",
    "6. 실제 지원 결제수단과 결제 방식",
    "",
    "[규칙]",
    "- 반드시 최신 웹 검색을 사용할 것.",
    "- OpenAI, Anthropic, Google 및 공식 앱스토어/도움말 등 1차 출처를 우선할 것.",
    "- 확인할 수 없는 항목은 추정하지 말고 확인 불가 또는 해당 없음으로 구분할 것.",
    "- 환율 환산값과 실제 현지 청구 가격을 섞지 말 것.",
    "- 기존 저장값이 틀리거나 오래됐으면 명확히 지적할 것.",
    "",
    "[출력]",
    "- 확인 기준일",
    "- 6개 항목 각각: 확인 / 해당 없음 / 확인 불가 + 근거",
    "- 공식 출처 URL 1~3개",
    "- 글 작성 전에 수정해야 할 숫자나 표현",
  ].join("\n");
}
function buildDifferentiatePrompt(row: ScheduleRow, similar: SimilarTopic[]) {
  const list = similar.slice(0, 5).map(item =>
    `- [${item.level === "high" ? "중복 가능" : "유사 주제"}] ${item.title}\n  Keyword: ${item.keyword}\n  URL: ${item.url || "미발행"}`
  ).join("\n");
  return [
    "AI Price Atlas의 새 글 주제가 기존 글과 검색 의도가 겹치는지 검토해줘.",
    "",
    "[새 글]",
    `제목: ${row.title}`,
    `핵심 키워드: ${row.keyword}`,
    `기획 메모: ${row.note}`,
    "",
    "[비슷한 기존/예정 글]",
    list || "- 없음",
    "",
    "[판단 기준]",
    "- 단순히 단어가 겹친다는 이유만으로 중복이라고 판단하지 말 것.",
    "- 검색자가 원하는 답이 사실상 같은지 검색 의도 기준으로 볼 것.",
    "- 국가, 서비스, 결제 플랫폼, 세금, 문제 해결, 가격 이력처럼 명확한 다른 목적이 있으면 차이를 설명할 것.",
    "- 실제로 같은 검색 의도라면 새 글 추가보다 기존 글 업데이트/확장을 우선 제안할 것.",
    "- 새 글로 분리할 가치가 있다면 기존 글과 겹치지 않도록 제목, 핵심 키워드, 글의 각도 3가지를 구체적으로 제안할 것.",
    "- 기존 LIVE 글 URL이 있으면 그 글의 실제 내용을 확인한 뒤 판단할 것.",
    "",
    "[출력]",
    "1. 검색 의도 겹침 정도: 높음 / 중간 / 낮음",
    "2. 새 글 작성 vs 기존 글 업데이트 중 어떤 방식이 더 자연스러운지",
    "3. 새 글로 간다면 차별화된 제목 1개",
    "4. 차별화된 핵심 키워드 1개",
    "5. 기존 글과 겹치지 않게 반드시 다룰 핵심 포인트 3개",
  ].join("\n");
}


function buildArticlePrompt(row: ScheduleRow, allRows: ScheduleRow[], contentPlanBlock = "") {
  if (row.kind === "experiment") return row.labPrompt?.trim() || "실전 검증실에서 원문 답변·정답 채점을 마친 뒤 글 요청서를 가져오세요.";
  return `AI Price Atlas용 구글 Blogger 영문 글을 최종 발행본으로 작성해줘.

[작성 기준일]
${row.date}

[블로그]
AI Price Atlas
https://aipriceatlas.blogspot.com/

[이번 글]
예정 제목: ${row.title || "주제 미입력"}
핵심 SEO 키워드: ${row.keyword || "키워드 미입력"}
기획 메모: ${row.note || "없음"}
${contentPlanBlock}

[운영자가 저장한 사전 검증 기록]
${verificationSummary(row)}
- 위 기록은 참고용이며, 작성 시점에 웹에서 다시 확인할 것.
- "확인"으로 저장된 항목도 공식 출처가 바뀌었거나 가격이 변경됐으면 최신 값을 우선할 것.

고정 슬러그: ${row.slug || "미지정"}
예정 URL: ${plannedUrl(row) || "미지정"}

[내부링크 연결 계획]
${relatedLinkText(row, allRows)}

[내부링크 사용 규칙]
- LIVE로 표시된 관련 글은 내용상 자연스러울 때 본문에 1~3개 실제 내부링크로 연결할 것.
- PLANNED로 표시된 글은 아직 발행 전일 수 있으므로 본문에 404 링크를 만들지 말 것.
- 다만 PLANNED 글이 현재 작성 시점에 실제로 이미 공개되어 있는지 웹에서 확인할 수 있다면 해당 URL이 정상 열릴 때만 링크할 수 있음.
- 내부링크 앵커텍스트는 문맥에 맞게 자연스럽게 작성하고, URL 자체를 앵커텍스트로 노출하지 말 것.
- 모든 관련 글을 억지로 넣지 말 것.

[가장 중요한 작업 방식]
- 반드시 웹 검색으로 작성 시점의 최신 가격, 세금, 결제수단, 웹 결제와 iOS/Android 앱 결제 차이를 확인한 뒤 작성할 것.
- OpenAI, Anthropic, Google 등 서비스 제공사의 공식 가격·도움말·앱스토어 정보를 우선 확인할 것.
- 가격은 통화와 과세 포함 여부, 월간/연간 여부를 명확히 구분할 것.
- 지역별 가격이 공식적으로 확인되지 않으면 추정 환율 가격을 실제 현지 가격처럼 쓰지 말 것.
- 웹 가격과 앱스토어 가격이 다를 수 있으면 별도로 구분할 것.
- 2026년 정보와 과거 가격을 섞지 말 것.
- 확인되지 않은 할인, 프로모션, 결제수단을 만들지 말 것.
- 검색 결과 문장을 복사하지 말고 자연스러운 영어로 재구성할 것.

[SEO·품질 목표]
- 이 글의 검색 의도를 먼저 분류할 것: 국가 가격 검증형 / 비교형 / 문제 해결형 / 결제 가이드형 / 가격 추적형 / 종합 데이터형 중 가장 맞는 1개.
- 모든 글을 같은 템플릿으로 억지로 작성하지 말고, 검색 의도에 맞춰 섹션 순서와 표를 바꿀 것.
- 첫 100단어 안에 검색자가 원하는 핵심 답을 먼저 제시.
- 공식 가격표를 단순히 다시 적는 데 그치지 말고, 독자가 직접 비교·결제·문제 해결에 사용할 수 있는 추가 가치를 만들 것.
- 비교글은 반드시 같은 기준일·같은 결제 플랫폼·같은 세금 기준을 맞춰 비교할 것.
- 문제 해결글은 증상 → 가능한 원인 → 확인 순서 → 공식 해결 방법 순으로 실용적으로 작성할 것.
- 가격 추적글은 확인 가능한 날짜와 출처가 있는 변화만 연표로 정리하고, 추정 과거 가격을 만들지 말 것.
- 종합 데이터글은 Last checked 날짜와 비교 기준을 눈에 띄게 표시하고 향후 업데이트하기 쉬운 표 구조로 만들 것.
- 서로 다른 페이지에서 문장을 재사용한 것처럼 보이지 않게 각 주제의 고유 질문·데이터·해석을 중심으로 작성.
- 과도한 키워드 반복 금지.
- 사실 확인이 안 된 내용은 단정하지 말 것.

[독창적 가치 — 필수]
본문에 최소 2개 이상의 고유 가치 요소를 포함할 것.
- 동일 날짜 기준 자체 비교표
- 웹 vs 앱 실제 차이 요약
- 세금 포함/별도 여부 정리
- 결제 단계 체크리스트
- 가격 변화 타임라인
- 국가 간 비교 시 주의할 환율·세금 기준 설명
- 공식 자료가 서로 다르게 보일 때 왜 그런지 설명
단, 확인되지 않은 내용을 채우기 위해 억지로 만들지 말 것.

[본문 구조]
- 별도의 H1은 만들지 말 것. Blogger의 글 제목 입력란이 최상위 제목 역할을 함.
- Blogger 기본 서식 기준으로 H2=제목, H3=부제목, H4=소제목, p=보통 본문으로 사용.
- 검색 의도에 맞는 H2 4~7개를 구성하되, 모든 문단에 제목을 붙이지 말 것.
- H3는 하나의 H2 안에서 비교 항목·세부 주제를 나눌 때만 사용.
- H4는 H3 아래에서 정말 필요한 세부 구분이 있을 때만 제한적으로 사용.
- 짧은 도입 2~3문단. ANSWER FIRST는 제목 바로 아래 보통 본문(p)으로 시작.
- 핵심 답 또는 핵심 비교표를 초반에 배치.
- 독자가 실제로 행동할 수 있는 확인 방법 또는 체크리스트 포함.
- FAQ는 실제 검색자가 추가로 궁금해할 내용이 있을 때만 3~6개.
- Final takeaway는 새 내용을 반복하지 말고 핵심 판단 기준을 짧게 정리.
- 문단은 짧고 모바일에서 읽기 쉽게 작성

[이미지 위치]
본문 HTML 안에 아래 위치 문구를 각각 한 줄로 정확히 넣어줘.
[IMAGE 00 — Hero]
[IMAGE 01 — Core facts]
[IMAGE 02 — Decision comparison]
[IMAGE 03 — Original value]
[IMAGE 04 — Conditions and limits]
[IMAGE 05 — Key takeaways]

[내부 링크]
관련성이 있을 때 아래 기존 글을 자연스럽게 1~2개만 연결해줘.
- ChatGPT Plus Price in South Korea 2026: https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-south-korea-2026.html
- ChatGPT Plus Price in Japan 2026: https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-japan-2026-3000.html
관련성이 낮으면 억지로 넣지 말 것.

[Blogger 기본 서식 디자인 — 매우 중요]
- 이 글은 Blogger 편집기의 기본 서식 자체가 디자인을 담당한다. 개별 글 안에서 폰트·크기·색상·여백을 임의 지정하지 말 것.
- Blogger 서식 대응: 제목 = <h2>, 부제목 = <h3>, 소제목 = <h4>, 보통 = <p>.
- 본문 안에 <h1>을 만들지 말 것.
- style, class, id 속성을 본문 태그에 넣지 말 것.
- font-size, font-family, color, background, line-height 같은 인라인 디자인 속성 금지.
- <font> 태그 금지.
- 빈 줄을 만들기 위한 &nbsp;, <p><br></p>, 비어 있는 h2/h3/h4 금지.
- 문단 사이 간격은 빈 태그가 아니라 Blogger 테마의 기본 간격에 맡길 것.
- 강조는 <strong>을 필요한 핵심 문장·숫자에만 사용하고 남용하지 말 것.

[Blogger HTML 규칙]
- 본문은 Blogger HTML 보기에서 바로 붙여넣을 수 있는 깨끗한 HTML로 작성.
- <html>, <head>, <body>, <style>, <script> 태그 금지.
- h2, h3, h4, p, strong, em, ul, ol, li, table, thead, tbody, tr, th, td, a, br 정도의 단순한 태그만 사용.
- br은 문단 안에서 의미상 줄바꿈이 꼭 필요할 때만 사용하고, 문단 사이 여백 용도로 사용하지 말 것.
- 마크다운 문법을 HTML 안에 섞지 말 것.
- 표에는 width 고정값이나 복잡한 CSS를 넣지 말 것.
- 외부 광고 스크립트나 임베드 코드를 넣지 말 것.
- URL은 실제 내부링크 외에는 본문에 길게 노출하지 말 것.

[최종 출력 형식 — 매우 중요]
아래 마커를 정확히 사용하고, 마커 사이 내용만 출력할 것.
각 마커는 원문 그대로 독립된 줄에 작성할 것. 항목 전체를 다른 태그나 인용 블록으로 감싸거나 역슬래시를 추가하지 말 것.
코드블록은 사용하지 말 것.

[FINAL_TITLE]
영문 최종 제목 1개

[META_DESCRIPTION]
검색 설명용 영문 140~155자 1개

[SLUG]
${row.slug || "영문 소문자 하이픈 슬러그만"}
- 위 고정 슬러그가 있으면 반드시 그대로 사용할 것.

[LABELS]
쉼표로 구분한 Blogger 라벨 4~7개

[BLOGGER_HTML]
Blogger에 바로 넣을 최종 HTML 본문
[/BLOGGER_HTML]

출력 전에 가격·통화·세금·날짜를 다시 자가검수하고, 확인되지 않은 숫자를 만들지 마.`;
}

function buildImagePrompt(row: ScheduleRow, slot: typeof IMAGE_SLOTS[number], contentPlan?: GoogleContentPlan | null) {
  if (row.kind === "experiment") {
    const recommendationPrompt = buildRecommendationImagePrompt(row, slot);
    if (recommendationPrompt) return recommendationPrompt;
    const image = imageSlotFor(row, slot);
    return [
      "전 세계 독자를 위한 실제 AI 실험 글의 영문 정보 이미지 1장만 제작해줘.",
      "글 제목: " + row.title,
      "이미지 슬롯: " + slot.id + " · " + image.label,
      "이 이미지의 역할: " + image.role,
      "[검증된 실험 기록]",
      row.labReport || "근거 자료 미입력 · 결과 숫자나 정답을 새로 만들지 말 것.",
      "[스타일] 1600×900px / 16:9 / 영어 / 호기심을 자극하되 정보가 읽히는 편집형 디자인 / 과한 네온·3D·미래형 AI 클리셰 금지.",
      row.experimentMode==="recommend" ? "[필수] 정답·승자·점수판을 만들지 말 것. 실제 AI 추천 3개와 선택 기준·장단점·불확실성을 중심으로 표현하고 실제 제품 사진·사양·순위를 임의로 만들지 말 것." : "[필수] 원래 정답키·AI 답변·점수는 검증 기록에 있는 것만 사용하고, 미확인 정보나 모델 버전을 만들지 말 것.",
      "[톤] 딱딱한 벤치마크 보고서보다 'Can AI really do this?' 실험 콘텐츠처럼 재미있게. 단, 이번 한 번의 실험으로 전체 모델 우열을 단정하지 말 것.",
      "6장 합본이 아니라 현재 요청한 슬롯 " + slot.id + " 1장만 제작.",
    ].join("\n");
  }
  return `AI Price Atlas 구글 블로그용 이미지를 1장 만들어줘.

[글 정보]
글 제목: ${row.title || "제목 미입력"}
핵심 키워드: ${row.keyword || "키워드 미입력"}
기획 메모: ${row.note || "없음"}
${googleImagePlanBlock(contentPlan, slot.id)}

[이미지 역할]
슬롯: ${slot.id} · ${slot.label}
역할: ${slot.role}

[제작 목표]
- 정확한 비율: 16:9 가로형
- 권장 크기: 1600×900px
- 구글 Blogger 본문용 단일 이미지 1장
- 영어권 독자가 모바일에서도 바로 이해할 수 있는 깔끔한 편집형 디자인
- AI Price Atlas라는 가격 비교·구독 정보 블로그에 어울리는 신뢰감 있는 톤
- 과도한 네온, 유리질감, 미래형 AI 클리셰, 복잡한 3D 효과 금지
- 카드와 색상은 2~3개 중심으로 절제
- 작은 글자를 빽빽하게 넣지 말 것

[사실 검증]
- 이미지에 가격·통화·세금·결제수단 같은 구체적인 숫자나 사실을 넣기 전에는 반드시 최신 웹 자료로 확인할 것.
- 확인되지 않은 가격을 임의로 만들지 말 것.
- 웹 결제와 앱 결제 가격이 다르면 하나의 가격처럼 합치지 말 것.
- 진행 중인 프로모션이나 지역별 가격을 추정하지 말 것.

[텍스트]
- 영어만 사용.
- 핵심 문구는 짧게.
- ${slot.id === "00" ? "대표 이미지이므로 제목 전체를 반복하지 말고 검색 질문과 핵심 판단 포인트가 1초 안에 보이게 구성." : "본문 설명 이미지이므로 큰 광고성 헤드라인보다 비교·과정·검증·판단 기준이 중심이 되게 구성."}
- 한글, 워터마크, 타사 편집툴 로고 금지.

중요: 여러 장 합본이 아니라 슬롯 ${slot.id}에 사용할 이미지 한 장만 바로 생성해줘.`;
}

function htmlToPlain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/h2>|<\/h3>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function optimizeImageFile(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("PNG, JPG, WebP 이미지만 업로드할 수 있습니다.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("원본 이미지가 20MB를 넘습니다.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      img.src = objectUrl;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 최적화 기능을 사용할 수 없습니다.");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("WebP 변환에 실패했습니다.")), "image/webp", 0.82);
    });

    return { blob, width, height, originalBytes: file.size, optimizedBytes: blob.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function assignFilesToSlots(files: File[]) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const assigned = new Map<string, File>();
  const leftovers: File[] = [];

  for (const file of sorted) {
    const match = file.name.match(/(?:^|[^0-9])(0[0-5])(?:[^0-9]|$)/);
    const slotId = match?.[1];
    if (slotId && !assigned.has(slotId)) assigned.set(slotId, file);
    else leftovers.push(file);
  }

  const emptySlots = IMAGE_SLOTS.map(slot => slot.id).filter(id => !assigned.has(id));
  leftovers.forEach((file, index) => {
    const slotId = emptySlots[index];
    if (slotId) assigned.set(slotId, file);
  });
  return assigned;
}
function createSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeScheduleRows(value: unknown): ScheduleRow[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .filter((row): row is ScheduleRow => !!row && typeof row === "object" && typeof (row as ScheduleRow).id === "string")
    .map(row => row.status === "발행 완료" && !isValidPublishedUrl(row.url || "")
      ? { ...row, status: "작성 중" as Status }
      : row);

  if (!rows.length) return [];
  if (rows.every(row => row.kind === "experiment")) return rows;

  const experimentByDate = new Map(
    rows.filter(row => row.kind === "experiment").map(row => [row.date, row] as const)
  );
  return DEFAULT_ROWS.map(row => experimentByDate.get(row.date) || row);
}
function extractImageUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const srcMatch = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
  const candidate = (srcMatch?.[1] || raw).replace(/&amp;/g, "&").trim();
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function escapeHtmlAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function replaceImagePlaceholders(html: string, row: ScheduleRow) {
  if (!html) return "";
  let output = html;
  for (const slot of IMAGE_SLOTS) {
    const raw = row.imageUrls?.[slot.id] || "";
    const src = extractImageUrl(raw);
    if (!src) continue;
    const alt = escapeHtmlAttr(`${row.title || "AI Price Atlas"} — ${imageSlotFor(row, slot).label}`);
    const loading = slot.id === "00" ? "eager" : "lazy";
    const imageHtml = `<p><img src="${escapeHtmlAttr(src)}" alt="${alt}" loading="${loading}"></p>`;
    const placeholder = new RegExp(`\\[IMAGE ${slot.id} — [^\\]]+\\]`, "g");
    output = output.replace(placeholder, imageHtml);
  }
  return output;
}


export default function GoogleBlogSchedulePage() {
  const [rows, setRows] = useState<ScheduleRow[]>(DEFAULT_ROWS);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(DEFAULT_ROWS[0].id);
  const [bankTopics, setBankTopics] = useState<BankTopic[]>([]);
  const [selectedBankTopic, setSelectedBankTopic] = useState("");
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});
  const [batchUploading, setBatchUploading] = useState(false);
  const [syncKey, setSyncKey] = useState("");
  const [syncInput, setSyncInput] = useState("");
  const [syncStatus, setSyncStatus] = useState<"off" | "loading" | "ready" | "saving" | "error">("off");
  const [syncInitialized, setSyncInitialized] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState("");
  const [localUpdatedAt, setLocalUpdatedAt] = useState("");
  const [publishHistory, setPublishHistory] = useState<GooglePublishHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [today, setToday] = useState(todayLocal());
  const localWriteReady = useRef(false);
  const preferCloudOnConnect = useRef(false);
  const rollingAppliedRef = useRef("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const normalized = normalizeScheduleRows(JSON.parse(saved));
        if (normalized.length) setRows(normalized);
      }
      const savedSyncKey = localStorage.getItem(SYNC_KEY_STORAGE) || "";
      const savedLocalUpdatedAt = localStorage.getItem(LOCAL_UPDATED_KEY) || "";
      if (savedSyncKey) {
        setSyncKey(savedSyncKey);
        setSyncInput(savedSyncKey);
        setSyncStatus("loading");
      }
      if (savedLocalUpdatedAt) setLocalUpdatedAt(savedLocalUpdatedAt);
    } catch {}
    setLoaded(true);
  }, []);

  function reloadTopicBank(){
    try{
      const bank=JSON.parse(localStorage.getItem(TOPICS_KEY)||"{}");
      const valid=Array.isArray(bank.topics)?bank.topics.filter((item:BankTopic)=>
        item && typeof item.id==="string" && typeof item.title==="string"
        && ["pending","active","used"].includes(item.status)):[];
      setBankTopics(valid);
    }catch{setBankTopics([]);}
  }
  useEffect(()=>{
    reloadTopicBank();
    window.addEventListener("focus",reloadTopicBank);
    return ()=>window.removeEventListener("focus",reloadTopicBank);
  },[]);
  function markTopicBankStatus(id:string,status:BankTopic["status"]){
    if(!id)return;
    try{
      const raw=JSON.parse(localStorage.getItem(TOPICS_KEY)||"{}");
      if(!Array.isArray(raw.topics))return;
      const updated=raw.topics.map((t:BankTopic)=>t.id===id?
        {...t,status,usedAt:status==="used"?todayLocal():t.usedAt}:t);
      localStorage.setItem(TOPICS_KEY,JSON.stringify({...raw,topics:updated}));
      setBankTopics(updated);
    }catch{}
  }
  function scheduleTopicFromBank(){
    const topic=bankTopics.find(t=>t.id===selectedBankTopic);
    if(!topic){setNotice("추가할 주제를 선택하세요.");return;}
    if(topic.status==="used"){setNotice("이 주제는 사용 완료 상태입니다. 다른 주제를 선택하세요.");return;}
    if(rows.some(r=>r.experimentTopicId===topic.id||normalizeGoogleTopic(r.title)===normalizeGoogleTopic(topic.title))){
      setNotice("이미 발행 스케줄에 있는 주제입니다. 기존 행에서 진행하세요.");return;
    }
    const lastDate=rows.length?[...rows].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)!.date:today;
    const date=nextDate(lastDate),id="topic-bank-"+topic.id;
    const row:ScheduleRow={
      id,date,title:topic.title,keyword:"AI three model comparison",
      status:"예정",url:"",slug:"",relatedIds:[],note:"AI 3사 추천 비교 실험 · 같은 질문과 실제 답변을 비교",
      kind:"experiment",labVersion:"WORLD-COMPARISON-V2-PLANNED",
      experimentMode:"recommend",experimentTopicId:topic.id,experimentQuestion:topic.question,
      experimentCategory:topic.category,experimentHook:"AI 3사 추천의 선택 기준·장점·단점 비교"
    };
    setRows(prev=>[...prev,row]);
    setSelectedId(id);markTopicBankStatus(topic.id,"active");setSelectedBankTopic("");
    setNotice("주제 보관함에서 발행 스케줄에 추가했습니다. 선택된 행에서 '이 주제로 실험 설계 시작'을 누르면 같은 질문이 전달됩니다.");
  }
  useEffect(() => {
    if (!loaded || (syncKey && !syncInitialized)) return;
    const raw = window.localStorage.getItem(LAB_TRANSFER_KEY);
    if (!raw) return;
    try {
      const incoming = JSON.parse(raw) as Partial<ScheduleRow>;
      if (incoming.kind !== "experiment" || !incoming.id || !incoming.title || !incoming.labReport || !incoming.labPrompt) throw new Error("Invalid lab handoff");
      const imported: ScheduleRow = {
        id: incoming.id,
        kind: "experiment",
        labVersion: incoming.labVersion || "WORLD-LAB-V1",
        labReport: incoming.labReport,
        labPrompt: incoming.labPrompt,
        date: incoming.date || todayLocal(),
        title: incoming.title,
        keyword: incoming.keyword || "AI experiment",
        slug: incoming.slug || "",
        note: incoming.note || "글로벌 AI 실험 제작실에서 검증한 실제 실험 글",
        status: "작성 중", url: "", body: typeof incoming.body === "string" ? incoming.body : "", relatedIds: [],
        experimentCategory: incoming.experimentCategory || "",
        experimentHook: incoming.experimentHook || "",
        experimentTopicId: incoming.experimentTopicId || "",
        experimentMode: incoming.experimentMode === "recommend"?"recommend":"quiz",
        experimentQuestion: incoming.experimentQuestion || "",
      };
      setRows(prev => prev.some(item => item.id === imported.id)
        ? prev.map(item => item.id === imported.id ? {
            ...item,
            ...imported,
            date: item.date,
            url: item.url,
            relatedIds: item.relatedIds || [],
            backlinkDoneIds: item.backlinkDoneIds || [],
            imageUrls: item.imageUrls,
            imageMeta: item.imageMeta,
          } : item)
        : [imported, ...prev]);
      setSelectedId(imported.id);
      setNotice("AI 3사 비교자료를 발행 스케줄에 저장했습니다. 아래에서 본문 요청서 → 이미지 6장 → 완성글 붙여넣기 순서로 진행하세요.");
    } catch {
      setNotice("실험 기록을 가져오지 못했습니다. 검증실에서 다시 등록해 주세요.");
    } finally {
      window.localStorage.removeItem(LAB_TRANSFER_KEY);
    }
  }, [loaded, syncKey, syncInitialized]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextToday = todayLocal();
      setToday(current => current === nextToday ? current : nextToday);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadPublishHistory();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    if (!localWriteReady.current) {
      localWriteReady.current = true;
      return;
    }
    const stamp = new Date().toISOString();
    localStorage.setItem(LOCAL_UPDATED_KEY, stamp);
    setLocalUpdatedAt(stamp);
  }, [rows, loaded]);

  useEffect(() => {
    if (!loaded || !syncKey || syncInitialized) return;
    void hydrateCloudSchedule(syncKey);
  }, [loaded, syncKey, syncInitialized]);

  useEffect(() => {
    if (!loaded || !syncKey || !syncInitialized) return;
    const timer = window.setTimeout(() => {
      void saveCloudSchedule(syncKey, rows, false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [rows, loaded, syncKey, syncInitialized]);

  useEffect(() => {
    if (!loaded || !historyLoaded) return;
    if (syncKey && !syncInitialized) return;
    if (rollingAppliedRef.current === today) return;
    rollingAppliedRef.current = today;
    void applyRollingSchedule();
  }, [loaded, historyLoaded, syncKey, syncInitialized, today]);

  const counts = useMemo(() => ({
    total: rows.length,
    planned: rows.filter(r => r.status === "예정").length,
    writing: rows.filter(r => r.status === "작성 중").length,
    done: rows.filter(r => r.status === "발행 완료").length,
  }), [rows]);
  const selected = rows.find(row => row.id === selectedId) || rows[0];
  const selectedContentPlanBlock = selected?.kind === "experiment" ? "" : googleContentPlanBlock(selected?.contentPlan);
  const contentPlanPrompt = selected?.kind === "experiment" ? "" : buildGoogleContentPlanPrompt({
    date: today,
    title: selected?.title || "",
    keyword: selected?.keyword || "",
    note: selected?.note || "",
    existingTitles: rows.filter(row => row.id !== selected?.id && row.title.trim()).map(row => row.title),
  });
  const contentPlanChatUrl = contentPlanPrompt ? "https://chatgpt.com/?q=" + encodeURIComponent(contentPlanPrompt) : "";
  const articlePrompt = selected ? buildArticlePrompt(selected, rows, selectedContentPlanBlock) : "";
  const selectedPlannedUrl = selected ? plannedUrl(selected) : "";
  const selectedResolvedUrl = selected ? resolvedUrl(selected) : "";
  const selectedRelated = selected ? relatedRows(selected, rows) : [];
  const selectedReverse = selected ? reverseLinkRows(selected, rows) : [];
  const selectedReverseLive = selectedReverse.filter(item => isValidPublishedUrl(item.url));
  const selectedBacklinkDone = selected?.backlinkDoneIds || [];
  const selectedExperimentReady = Boolean(selected?.kind === "experiment" && selected.labReport?.trim() && selected.labPrompt?.trim());
  const selectedRecommendationImages = Boolean(selected?.kind === "experiment" && parseRecommendationReport(selected.labReport));
  const selectedVerification = selected ? getVerification(selected) : emptyVerification();
  const selectedVerificationResolved = selected ? verificationResolvedCount(selected) : 0;
  const selectedVerificationChecked = selected ? verificationCheckedCount(selected) : 0;
  const selectedUrlValid = selected ? isValidPublishedUrl(selected.url) : false;
  const selectedBacklinkRemaining = selectedReverseLive.filter(item => !selectedBacklinkDone.includes(item.id)).length;
  const verificationPrompt = selected ? buildVerificationPrompt(selected) : "";
  const verificationChatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(verificationPrompt);
  const selectedSimilarTopics = selected ? similarTopics(selected, rows) : [];
  const duplicateCount = selectedSimilarTopics.filter(item => item.level === "high").length;
  const similarCount = selectedSimilarTopics.filter(item => item.level === "medium").length;
  const differentiatePrompt = selected ? buildDifferentiatePrompt(selected, selectedSimilarTopics) : "";
  const differentiateChatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(differentiatePrompt);
  const articleChatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(articlePrompt);
  const bloggerOutput = useMemo(() => parseBloggerOutput(selected?.body || "", selected?.slug || ""), [selected?.body, selected?.slug]);
  const finalBloggerHtml = selected ? replaceImagePlaceholders(bloggerOutput.html, selected) : bloggerOutput.html;
  const imageReadyCount = selected ? IMAGE_SLOTS.filter(slot => extractImageUrl(selected.imageUrls?.[slot.id] || "")).length : 0;
  const missingImageSlots = selected ? IMAGE_SLOTS.filter(slot => !extractImageUrl(selected.imageUrls?.[slot.id] || "")) : IMAGE_SLOTS;
  const publishReady = bloggerOutput.valid && missingImageSlots.length === 0 && !/\[IMAGE\s+0[0-5]\s+—[^\]]+\]/i.test(finalBloggerHtml);
  const selectedImageBytes = selected ? Object.values(selected.imageMeta || {}).reduce((sum, meta) => sum + (meta.optimizedBytes || 0), 0) : 0;

  async function loadPublishHistory() {
    try {
      const res = await fetch("/api/google-blog/publish-history", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "발행 이력 조회 실패");
      const items = Array.isArray(json.items)
        ? json.items.filter((item: unknown): item is GooglePublishHistoryItem =>
            Boolean(item && typeof item === "object" && typeof (item as GooglePublishHistoryItem).title === "string")
          )
        : [];
      setPublishHistory(items);
    } catch (error) {
      setNotice(`⚠️ 발행 이력 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setHistoryLoaded(true);
    }
  }

  async function syncPublishHistory(row: ScheduleRow, published: boolean) {
    if (!row.title.trim()) return false;
    try {
      const res = await fetch("/api/google-blog/publish-history", {
        method: published ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: row.title,
          keyword: row.keyword,
          url: row.url,
          slug: row.slug || "",
          scheduledDate: row.date,
          publishedOn: row.date,
          source: "google-blog-schedule",
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "발행 이력 동기화 실패");
      }
      return true;
    } catch {
      return false;
    }
  }

  function pickRollingTopic(date: string, currentRows: ScheduleRow[], history: GooglePublishHistoryItem[]) {
    const usedTexts = [
      ...currentRows.map(row => `${row.title} ${row.keyword}`.trim()),
      ...history.map(item => `${item.title} ${item.keyword || ""}`.trim()),
    ].filter(Boolean);
    const usedKeys = new Set([
      ...currentRows.map(row => normalizeGoogleTopic(row.title)),
      ...history.map(item => item.normalized_key || normalizeGoogleTopic(item.title)),
    ]);

    const available = ROLLING_TOPIC_POOL.filter(candidate => {
      const key = normalizeGoogleTopic(candidate.title);
      if (usedKeys.has(key)) return false;
      const candidateText = `${candidate.title} ${candidate.keyword}`;
      return !usedTexts.some(text => topicSimilarity(candidateText, text) >= 0.82);
    });
    if (!available.length) return null;
    return available[rollingSeed(date) % available.length];
  }

  function makeRollingRow(date: string, currentRows: ScheduleRow[], history: GooglePublishHistoryItem[]): ScheduleRow {
    const topic = pickRollingTopic(date, currentRows, history);
    if (!topic) {
      return {
        id: `rolling-${date}`,
        date,
        title: "",
        keyword: "",
        status: "예정",
        url: "",
        slug: "",
        relatedIds: [],
        note: "엉뚱한 AI 실험 주제 풀이 소진되었습니다. 글로벌 AI 실험 제작실에서 새 주제를 추가하세요.",
        body: "",
        kind: "experiment",
        labVersion: "WORLD-LAB-V1-PLANNED",
      };
    }

    const candidateText = `${topic.title} ${topic.keyword}`;
    const relatedIds = currentRows
      .filter(row => row.title.trim())
      .map(row => ({ id: row.id, score: topicSimilarity(candidateText, `${row.title} ${row.keyword}`) }))
      .filter(item => item.score >= 0.18)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.id);

    return {
      id: `rolling-${date}`,
      date,
      title: topic.title,
      keyword: topic.keyword,
      status: "예정",
      url: "",
      slug: topic.slug,
      relatedIds,
      backlinkDoneIds: [],
      note: topic.note,
      body: "",
      kind: "experiment",
      labVersion: "WORLD-LAB-V1-PLANNED",
      labReport: "",
      labPrompt: "",
      experimentCategory: topic.category,
      experimentHook: topic.hook,
    };
  }

  async function applyRollingSchedule() {
    const yesterday = shiftDate(today, -1);
    const requiredDates = Array.from({ length: 14 }, (_, index) => shiftDate(yesterday, index));
    const oldCompleted = rows.filter(row => row.date < yesterday && row.status === "발행 완료");

    let archived = true;
    if (oldCompleted.length) {
      try {
        const res = await fetch("/api/google-blog/publish-history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: oldCompleted.map(row => ({
              title: row.title,
              keyword: row.keyword,
              url: row.url,
              slug: row.slug || "",
              scheduledDate: row.date,
              publishedOn: row.date,
              source: "google-blog-rollover",
            })),
          }),
        });
        if (!res.ok) throw new Error("archive failed");
        await loadPublishHistory();
      } catch {
        archived = false;
      }
    }

    const baseRows = archived && oldCompleted.length
      ? rows.filter(row => !(row.date < yesterday && row.status === "발행 완료"))
      : [...rows];
    const nextRows = [...baseRows];
    const existingDates = new Set(nextRows.map(row => row.date));
    const historyForPick = [
      ...publishHistory,
      ...oldCompleted.map(row => ({
        normalized_key: normalizeGoogleTopic(row.title),
        title: row.title,
        keyword: row.keyword || null,
        url: row.url || null,
        slug: row.slug || null,
        scheduled_date: row.date,
        published_on: row.date,
      })),
    ];

    let added = 0;
    for (const date of requiredDates) {
      if (existingDates.has(date)) continue;
      const newRow = makeRollingRow(date, nextRows, historyForPick);
      nextRows.push(newRow);
      existingDates.add(date);
      added += 1;
    }

    nextRows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    const beforeSignature = rows.map(row => `${row.id}:${row.date}:${row.status}`).join("|");
    const afterSignature = nextRows.map(row => `${row.id}:${row.date}:${row.status}`).join("|");
    if (beforeSignature !== afterSignature) {
      setRows(nextRows);
      if (!nextRows.some(row => row.id === selectedId)) {
        const nextSelected = nextRows.find(row => row.date === today) || nextRows.find(row => row.date >= yesterday) || nextRows[0];
        if (nextSelected) setSelectedId(nextSelected.id);
      }
      const removed = archived ? oldCompleted.length : 0;
      if (added || removed) {
        setNotice(`✅ 롤링 일정 업데이트 · 오래된 완료 글 ${removed}개 정리 · 새 일정 ${added}개 보충`);
      }
    }
  }

  async function saveCloudSchedule(key: string, payload: ScheduleRow[], showNotice = true) {
    if (!/^[0-9a-f]{36}$/.test(key)) return;
    try {
      setSyncStatus("saving");
      const { supabase } = await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("google_blog_sync_save", {
        p_sync_key: key,
        p_payload: payload,
      });
      if (error) throw error;
      const updatedAt = typeof data === "string" ? data : new Date().toISOString();
      setCloudUpdatedAt(updatedAt);
      setSyncStatus("ready");
      if (showNotice) setNotice("✅ 구글 블로그 스케줄을 클라우드에 저장했습니다.");
    } catch (error) {
      setSyncStatus("error");
      if (showNotice) setNotice(`⚠️ 클라우드 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }

  async function hydrateCloudSchedule(key: string) {
    try {
      setSyncStatus("loading");
      const { supabase } = await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("google_blog_sync_load", { p_sync_key: key });
      if (error) throw error;

      const remote = Array.isArray(data) ? data[0] : data;
      const remoteRows = normalizeScheduleRows(remote?.payload);
      const remoteUpdatedAt = typeof remote?.updated_at === "string" ? remote.updated_at : "";
      const shouldPreferCloud = preferCloudOnConnect.current ||
        (!!remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) >= Date.parse(localUpdatedAt)));

      if (remoteRows.length && shouldPreferCloud) {
        setRows(remoteRows);
        rollingAppliedRef.current = "";
        if (!remoteRows.some(row => row.id === selectedId)) setSelectedId(remoteRows[0].id);
        setCloudUpdatedAt(remoteUpdatedAt);
      } else {
        await saveCloudSchedule(key, rows, false);
      }

      localStorage.setItem(SYNC_KEY_STORAGE, key);
      setSyncInput(key);
      setSyncInitialized(true);
      setSyncStatus("ready");
      preferCloudOnConnect.current = false;
    } catch (error) {
      setSyncStatus("error");
      setSyncInitialized(false);
      setNotice(`⚠️ 클라우드 동기화 실패: ${error instanceof Error ? error.message : "동기화 코드를 확인해주세요."}`);
    }
  }

  function startCloudSync() {
    const key = createSyncKey();
    preferCloudOnConnect.current = false;
    setSyncKey(key);
    setSyncInput(key);
    setSyncInitialized(false);
    setSyncStatus("loading");
    localStorage.setItem(SYNC_KEY_STORAGE, key);
  }

  function connectCloudSync() {
    const key = syncInput.trim();
    if (!/^[0-9a-f]{36}$/.test(key)) {
      setNotice("⚠️ 36자리 동기화 코드를 정확히 입력해주세요.");
      return;
    }
    preferCloudOnConnect.current = true;
    setSyncKey(key);
    setSyncInitialized(false);
    setSyncStatus("loading");
    localStorage.setItem(SYNC_KEY_STORAGE, key);
  }

  function disconnectCloudSync() {
    localStorage.removeItem(SYNC_KEY_STORAGE);
    setSyncKey("");
    setSyncInput("");
    setSyncInitialized(false);
    setSyncStatus("off");
    setCloudUpdatedAt("");
    setNotice("이 브라우저의 클라우드 연결을 해제했습니다. 로컬 데이터는 그대로 유지됩니다.");
  }

  function updateRow(id: string, patch: Partial<ScheduleRow>) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
  }

  function importContentPlan() {
    if (!selected || selected.kind === "experiment") return;
    const parsed = parseGoogleContentPlan(selected.contentPlanRaw || "");
    if (!parsed) {
      setNotice("⚠️ 기획 결과를 읽지 못했습니다. [GOOGLE_PLAN_JSON] 블록까지 통째로 붙여넣어 주세요.");
      return;
    }
    updateRow(selected.id, {
      contentPlan: parsed,
      keyword: parsed.primaryQuery || selected.keyword,
      note: selected.note || parsed.userDecision,
    });
    setNotice("✅ MONEY INTENT · SEARCH PLAN · ORIGINAL VALUE · ANSWER FIRST를 불러왔습니다. 본문·이미지 요청서에 자동 반영됩니다.");
  }

  function clearContentPlan() {
    if (!selected || selected.kind === "experiment") return;
    updateRow(selected.id, { contentPlanRaw: "", contentPlan: null });
    setNotice("통합 기획을 비웠습니다. 기존 제목·본문·이미지는 유지됩니다.");
  }

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
      return true;
    } catch {
      setNotice("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
      return false;
    }
  }

  function startWork() {
    if (!selected) return;
    updateRow(selected.id, { status: selected.status === "발행 완료" ? "발행 완료" : "작성 중" });
  }

  function completeRow(row: ScheduleRow) {
    if (!row.url.trim()) {
      setSelectedId(row.id);
      setNotice("⚠️ 발행 완료 전에 Blogger에서 공개된 실제 URL을 입력해주세요.");
      return false;
    }
    if (!isValidPublishedUrl(row.url)) {
      setSelectedId(row.id);
      setNotice("⚠️ URL 형식을 확인해주세요. https://aipriceatlas.blogspot.com/...html 형식의 실제 발행 URL만 LIVE 처리됩니다.");
      return false;
    }
    updateRow(row.id, { status: "발행 완료" });
    if(row.experimentTopicId)markTopicBankStatus(row.experimentTopicId,"used");
    void syncPublishHistory({ ...row, status: "발행 완료" }, true).then(ok => {
      if (ok) void loadPublishHistory();
    });
    setNotice("✅ 실제 발행 URL 확인 완료 · LIVE 처리하고 발행 이력에 저장했습니다.");
    return true;
  }

  function changeStatus(row: ScheduleRow, nextStatus: Status) {
    if (nextStatus === "발행 완료") {
      completeRow(row);
      return;
    }
    if (row.status === "발행 완료") {
      void syncPublishHistory(row, false).then(ok => {
        if (ok) void loadPublishHistory();
      });
    }
    updateRow(row.id, { status: nextStatus });
  }

  function updateVerification(patch: Partial<VerificationState>) {
    if (!selected) return;
    updateRow(selected.id, { verification: { ...getVerification(selected), ...patch } });
  }

  function cycleVerification(key: keyof Pick<VerificationState, "officialPrice" | "webPrice" | "iosPrice" | "androidPrice" | "tax" | "payment">) {
    if (!selected) return;
    const current = getVerification(selected);
    const next: VerificationValue = current[key] === "pending" ? "checked" : current[key] === "checked" ? "na" : "pending";
    const patch: Partial<VerificationState> = { [key]: next };
    if (!current.checkedAt && next === "checked") patch.checkedAt = today;
    updateRow(selected.id, { verification: { ...current, ...patch } });
  }
  function toggleBacklinkDone(sourceId: string) {
    if (!selected) return;
    const current = selected.backlinkDoneIds || [];
    const next = current.includes(sourceId)
      ? current.filter(id => id !== sourceId)
      : [...current, sourceId];
    updateRow(selected.id, { backlinkDoneIds: next });
    setNotice(current.includes(sourceId) ? "역링크 완료 표시를 해제했습니다." : "✅ 역링크 추가 완료로 표시했습니다.");
  }

  function updateImageUrl(slotId: string, value: string) {
    if (!selected) return;
    setRows(prev => prev.map(row => row.id === selected.id ? {
      ...row,
      imageUrls: { ...(row.imageUrls || {}), [slotId]: value },
    } : row));
  }

  async function uploadImageToSlot(slotId: string, file: File, rowId = selected?.id) {
    if (!rowId) return;
    setUploadingSlots(prev => ({ ...prev, [slotId]: true }));
    try {
      const optimized = await optimizeImageFile(file);
      const { supabase, session } = await ensureAnonymousSession();
      const safeRow = rowId.replace(/[^a-zA-Z0-9_-]/g, "-");
      const path = `${session.user.id}/ai-price-atlas/${safeRow}/${slotId}-${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, optimized.blob, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
      const publicUrl = publicData.publicUrl;
      const currentRow = rows.find(row => row.id === rowId);
      const previousPath = currentRow?.imageMeta?.[slotId]?.path;

      const meta: ImageUploadMeta = {
        path,
        url: publicUrl,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
        width: optimized.width,
        height: optimized.height,
        uploadedAt: new Date().toISOString(),
      };

      setRows(prev => prev.map(row => row.id === rowId ? {
        ...row,
        imageUrls: { ...(row.imageUrls || {}), [slotId]: publicUrl },
        imageMeta: { ...(row.imageMeta || {}), [slotId]: meta },
      } : row));

      if (previousPath && previousPath !== path && previousPath.startsWith(`${session.user.id}/`)) {
        await supabase.storage.from(IMAGE_BUCKET).remove([previousPath]);
      }

      const saved = Math.max(0, optimized.originalBytes - optimized.optimizedBytes);
      setNotice(`✅ ${slotId} 이미지 업로드 완료 · ${formatBytes(optimized.originalBytes)} → ${formatBytes(optimized.optimizedBytes)}${saved ? ` · ${Math.round(saved / optimized.originalBytes * 100)}% 절감` : ""}`);
    } catch (error) {
      setNotice(`⚠️ 이미지 업로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      throw error;
    } finally {
      setUploadingSlots(prev => ({ ...prev, [slotId]: false }));
    }
  }

  async function uploadImageBatch(fileList: FileList | null) {
    if (!selected || !fileList?.length) return;
    const files = Array.from(fileList).slice(0, 6);
    const assigned = assignFilesToSlots(files);
    if (!assigned.size) return;
    setBatchUploading(true);
    try {
      let completed = 0;
      for (const slot of IMAGE_SLOTS) {
        const file = assigned.get(slot.id);
        if (!file) continue;
        await uploadImageToSlot(slot.id, file, selected.id);
        completed += 1;
      }
      setNotice(`✅ 이미지 ${completed}장 최적화·업로드 완료 · WebP / 최대 1600px`);
    } catch {
      // 슬롯별 오류 메시지는 uploadImageToSlot에서 표시합니다.
    } finally {
      setBatchUploading(false);
    }
  }

  async function removeUploadedImage(slotId: string) {
    if (!selected) return;
    const meta = selected.imageMeta?.[slotId];
    try {
      if (meta?.path) {
        const { supabase, session } = await ensureAnonymousSession();
        if (meta.path.startsWith(`${session.user.id}/`)) {
          const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([meta.path]);
          if (error) throw error;
        }
      }
      setRows(prev => prev.map(row => {
        if (row.id !== selected.id) return row;
        const imageUrls = { ...(row.imageUrls || {}) };
        const imageMeta = { ...(row.imageMeta || {}) };
        delete imageUrls[slotId];
        delete imageMeta[slotId];
        return { ...row, imageUrls, imageMeta };
      }));
      setNotice(`${slotId} 이미지 연결을 삭제했습니다.`);
    } catch (error) {
      setNotice(`⚠️ 이미지 삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }

  async function copyBloggerRich() {
    if (!publishReady) {
      setCopyMessage(bloggerOutput.errors.length
        ? "⚠️ 원고 형식을 먼저 수정하세요: " + bloggerOutput.errors.join(" / ")
        : "⚠️ 이미지 6개를 모두 연결한 뒤 복사할 수 있습니다.");
      return;
    }
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([finalBloggerHtml], { type: "text/html" }),
            "text/plain": new Blob([htmlToPlain(finalBloggerHtml)], { type: "text/plain" }),
          }),
        ]);
        setCopyMessage("✅ Blogger 서식 포함 전체복사 완료 · Blogger 작성 화면에서 Ctrl+V 하세요.");
      } else {
        await navigator.clipboard.writeText(finalBloggerHtml);
        setCopyMessage("HTML 코드로 복사했습니다. Blogger의 HTML 보기에서 붙여넣으세요.");
      }
    } catch {
      setCopyMessage("복사에 실패했습니다. HTML 코드 복사를 사용해주세요.");
    }
  }

  async function copyHtmlCode() {
    if (!publishReady) {
      setCopyMessage(bloggerOutput.errors.length
        ? "⚠️ 원고 형식을 먼저 수정하세요: " + bloggerOutput.errors.join(" / ")
        : "⚠️ 이미지 6개를 모두 연결한 뒤 복사할 수 있습니다.");
      return;
    }
    await copyText(finalBloggerHtml, "✅ 이미지가 반영된 Blogger HTML 코드 복사 완료 · HTML 보기에서 붙여넣으세요.");
  }

  function addRow() {
    const lastDate = rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date : today;
    const date = nextDate(lastDate);
    const topic = pickRollingTopic(date, rows, publishHistory) || ROLLING_TOPIC_POOL[rollingSeed(date) % ROLLING_TOPIC_POOL.length];
    const row: ScheduleRow = {
      id: `experiment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      title: topic.title,
      keyword: topic.keyword,
      status: "예정",
      url: "",
      slug: topic.slug,
      relatedIds: [],
      note: topic.note,
      body: "",
      kind: "experiment",
      labVersion: "WORLD-LAB-V1-PLANNED",
      experimentCategory: topic.category,
      experimentHook: topic.hook,
    };
    setRows(prev => [...prev, row]);
    setSelectedId(prev => prev || row.id);
  }

  function addWeek() {
    let date = rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date : today;
    const extra: ScheduleRow[] = [];
    const simulated = [...rows];
    for (let i = 0; i < 7; i++) {
      date = nextDate(date);
      const topic = pickRollingTopic(date, [...simulated, ...extra], publishHistory) || ROLLING_TOPIC_POOL[(rollingSeed(date) + i) % ROLLING_TOPIC_POOL.length];
      extra.push({
        id: `experiment-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        date,
        title: topic.title,
        keyword: topic.keyword,
        status: "예정",
        url: "",
        slug: topic.slug,
        relatedIds: [],
        note: topic.note,
        body: "",
        kind: "experiment",
        labVersion: "WORLD-LAB-V1-PLANNED",
        experimentCategory: topic.category,
        experimentHook: topic.hook,
      });
    }
    setRows(prev => [...prev, ...extra]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(row => row.id !== id));
    if (selectedId === id) {
      const next = rows.find(row => row.id !== id);
      if (next) setSelectedId(next.id);
    }
  }

  function startExperimentDesign(row: ScheduleRow) {
    try {
      window.localStorage.setItem("ai-world-experiment-seed-v1", JSON.stringify({
        scheduleId: row.id,
        date: row.date,
        title: row.title,
        keyword: row.keyword,
        category: row.experimentCategory || "Global Curiosity",
        hook: row.experimentHook || row.note || "",
        mode: row.experimentMode || (row.labVersion==="WORLD-COMPARISON-V2"?"recommend":"quiz"),
        topicId: row.experimentTopicId || "",
        testQuestion: row.experimentQuestion || "",
      }));
    } catch {}
    window.location.href = "/google-blog-schedule/experiment?fromSchedule=1";
  }

  function resetRows() {
    if (!window.confirm("현재 스케줄을 지우고 엉뚱한 AI 실험 14일 발행리스트로 되돌릴까요?")) return;
    setRows(DEFAULT_ROWS);
    setSelectedId(DEFAULT_ROWS[0].id);
    setNotice("");
    setCopyMessage("");
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => window.location.href = "/"}>← 콘텐츠 메이커</button>
        <div className={styles.headerLinks}><a className={styles.labHeaderLink} href="/google-blog-schedule/experiment">🧪 글로벌 AI 실험</a><a className={styles.labHeaderLink} href="/google-blog-schedule/lab">🧮 숫자·PDF 검증</a><div className={styles.saved}>자동 저장됨</div></div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Google Blog · GLOBAL AI TESTS + PRICE ARCHIVE</span>
          <h1>Google Blog · 발행 제작실</h1>
          <p>기존 가격·국가·결제 검색글은 유지하고, 전 세계 공통 관심사를 활용한 엉뚱한 AI 실험 글을 함께 제작합니다.</p>
        </div>
        <div className={styles.heroDate}>오늘 {dayLabel(today)}</div>
      </section>

      <section className={styles.labSpotlight}>
        <div><span>NEW · GLOBAL CURIOSITY EXPERIMENTS</span><h2>나라·지도·음식·언어·동물까지, AI에게 엉뚱한 실험을 던져보세요.</h2>
          <p>주제 보관함 → 발행 스케줄 → AI 3사 실제 답변 수집 → ChatGPT 영문 글 작성 → 이미지 6장 → Blogger 발행. 추천 비교는 정답키가 필요하지 않습니다.</p>
          <small>가격 글은 그대로 유지 · 실험 글은 Can AI...? / I gave AI... 형식의 해외 유입용 콘텐츠로 확장</small>
        </div>
        <a href="/google-blog-schedule/experiment">글로벌 AI 실험 시작 →</a>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.stats}>
        <div><span>전체</span><b>{counts.total}</b></div>
        <div><span>예정</span><b>{counts.planned}</b></div>
        <div><span>작성 중</span><b>{counts.writing}</b></div>
        <div><span>발행 완료</span><b>{counts.done}</b></div>
      </section>

      <section className={styles.syncPanel}>
        <div className={styles.syncPanelMain}>
          <div className={styles.syncIcon}>☁</div>
          <div>
            <b>클라우드 동기화</b>
            <span>{syncKey ? "발행 URL·키워드·검증·내부링크 관계를 Supabase에 자동 저장합니다." : "다른 PC나 브라우저에서도 같은 스케줄을 이어서 사용하세요."}</span>
          </div>
        </div>

        {syncKey ? (
          <div className={styles.syncConnected}>
            <div className={styles.syncState}>
              <span className={syncStatus === "error" ? styles.syncError : syncStatus === "saving" || syncStatus === "loading" ? styles.syncBusy : styles.syncReady}>
                {syncStatus === "loading" ? "불러오는 중" : syncStatus === "saving" ? "저장 중" : syncStatus === "error" ? "동기화 오류" : "자동 저장됨"}
              </span>
              {cloudUpdatedAt && <small>최근 클라우드 저장 {new Date(cloudUpdatedAt).toLocaleString("ko-KR")}</small>}
            </div>
            <div className={styles.syncCodeBox}>
              <code>{syncKey.slice(0, 6)}••••••••••{syncKey.slice(-6)}</code>
              <button type="button" onClick={() => void copyText(syncKey, "동기화 코드를 복사했습니다. 다른 브라우저에서 이 코드를 입력하세요.")}>코드 복사</button>
              <button type="button" onClick={() => void saveCloudSchedule(syncKey, rows)}>지금 저장</button>
              <button type="button" className={styles.syncDisconnect} onClick={disconnectCloudSync}>연결 해제</button>
            </div>
          </div>
        ) : (
          <div className={styles.syncSetup}>
            <button type="button" className={styles.syncStart} onClick={startCloudSync}>클라우드 동기화 시작</button>
            <span>또는</span>
            <input value={syncInput} placeholder="다른 브라우저의 동기화 코드" onChange={e => setSyncInput(e.target.value.trim())} />
            <button type="button" onClick={connectCloudSync}>기존 코드 연결</button>
          </div>
        )}
        <small className={styles.syncHint}>동기화 코드는 비밀번호처럼 보관하세요. 코드 원문은 DB에 저장하지 않고 해시로만 확인합니다.</small>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>엉뚱한 AI 실험 · 14일 롤링 발행리스트</h2>
            <p>어제 + 오늘 + 앞으로 12일을 모두 글로벌 호기심형 AI 실험으로 유지합니다. 가격·결제 신규 주제는 자동 발행리스트에 넣지 않습니다.</p>
          </div>
          <div className={styles.actions}>
            <span className={styles.rollingBadge}>자동 롤링 · 발행 이력 {publishHistory.length}개</span>
          </div>
        </div>

        <div className={styles.bankToSchedule}>
          <div>
            <strong>주제 보관함에서 발행 스케줄에 바로 추가</strong>
            <small>사용 가능한 주제 {bankTopics.filter(t=>t.status!=="used").length}개 · 주제가 소진되면 실험실에서 ChatGPT로 추가하세요.</small>
          </div>
          <select value={selectedBankTopic} onChange={e=>setSelectedBankTopic(e.target.value)} aria-label="발행할 AI 비교 주제">
            <option value="">비교 주제 선택</option>
            {bankTopics.filter(t=>t.status!=="used").map(t=><option value={t.id} key={t.id}>{t.title} · {t.status==="active"?"진행 중":"대기"}</option>)}
          </select>
          <button type="button" onClick={scheduleTopicFromBank} disabled={!selectedBankTopic}>발행리스트에 추가 →</button>
          <a href="/google-blog-schedule/experiment">주제 보관함 열기 ↗</a>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>상태</th>
                <th>글 제목</th>
                <th>핵심 키워드</th>
                <th>실험</th>
                <th>URL</th>
                <th>작업</th>
                <th aria-label="삭제"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isToday = row.date === today;
                const yesterday = shiftDate(today, -1);
                const isYesterday = row.date === yesterday;
                const isOverdue = row.date < yesterday && row.status !== "발행 완료";
                return (
                  <tr key={row.id} className={`${isToday ? styles.todayRow : ""} ${isOverdue ? styles.overdueRow : ""} ${row.id === selectedId ? styles.selectedRow : ""}`}>
                    <td className={styles.dateCell}>
                      <input type="date" value={row.date} onChange={e => updateRow(row.id, { date: e.target.value })} />
                      <small>{dayLabel(row.date)}{isToday ? " · 오늘" : isYesterday ? " · 어제" : isOverdue ? " · 지연" : ""}</small>
                    </td>
                    <td>
                      <select
                        value={row.status}
                        className={`${styles.status} ${row.status === "발행 완료" ? styles.done : row.status === "작성 중" ? styles.writing : styles.planned}`}
                        onChange={e => changeStatus(row, e.target.value as Status)}
                      >
                        <option>예정</option>
                        <option>작성 중</option>
                        <option>발행 완료</option>
                      </select>
                    </td>
                    <td><input className={styles.titleInput} value={row.title} placeholder="글 제목" onChange={e => updateRow(row.id, { title: e.target.value })} /></td>
                    <td><input value={row.keyword} placeholder="SEO 키워드" onChange={e => updateRow(row.id, { keyword: e.target.value })} /></td>
                    <td className={styles.miniStateCell}>
                      {row.kind === "experiment" ? (
                        <span className={row.labReport?.trim() ? styles.miniGood : styles.miniWait}>{row.labReport?.trim() ? "DONE" : "LAB"}</span>
                      ) : (
                        <span className={styles.miniWait}>OLD</span>
                      )}
                    </td>
                    <td className={styles.miniStateCell}>
                      <span className={isValidPublishedUrl(row.url) ? styles.miniGood : styles.miniNeutral}>
                        {isValidPublishedUrl(row.url) ? "LIVE" : "대기"}
                      </span>
                    </td>
                    <td><button className={styles.workBtn} onClick={() => { setSelectedId(row.id); setNotice(""); }}>{row.id === selectedId ? "선택됨" : "열기"}</button></td>
                    <td><button className={styles.deleteBtn} onClick={() => removeRow(row.id)} aria-label="행 삭제">×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.footerNote}>
          <b>운영 팁</b>
          <span>어제 글은 하루 더 남겨 확인할 수 있습니다. 그보다 오래된 완료 글은 발행 이력으로 이동하며, 미완료 글은 지연 표시로 계속 남습니다.</span>
        </div>


        {selected && <section className={styles.workPanel}>
          <div className={styles.workHead}>
            <div>
              <span className={styles.workEyebrow}>GOOGLE BLOG WORKFLOW</span>
              <h2>{selected.title || "제목을 먼저 입력해 주세요."}</h2>
              <p>{selected.date} · {selected.keyword || "SEO 키워드 미입력"}</p>
            </div>
            <span className={styles.workStatus}>{selected.status}</span>
            <div className={styles.workHealth}>
              {selected.kind === "experiment"
                ? <span className={selectedExperimentReady ? styles.healthGood : styles.healthWait}>{selectedExperimentReady ? "실험 자료 준비" : "AI 답변 필요"}</span>
                : <span className={styles.healthNeutral}>기존 가격 글</span>}
              {selected.kind !== "experiment" && <span className={selected.contentPlan ? styles.healthGood : styles.healthWait}>{selected.contentPlan ? "기획 완료" : "통합 기획 필요"}</span>}
              <span className={duplicateCount ? styles.healthDanger : styles.healthGood}>{duplicateCount ? `중복 ${duplicateCount}` : "SEO OK"}</span>
              <span className={selectedUrlValid ? styles.healthGood : styles.healthNeutral}>{selectedUrlValid ? "LIVE" : "URL 대기"}</span>
              {selectedBacklinkRemaining > 0 && <span className={styles.healthWait}>역링크 {selectedBacklinkRemaining}</span>}
            </div>
          </div>

          {selected.kind === "experiment" && <section className={styles.labEvidencePanel}>
            <div><span>GLOBAL EXPERIMENT · {selected.experimentCategory || selected.labVersion || "실험 예정"}</span>
              <strong>{selectedExperimentReady ? (selected.experimentMode==="recommend"?"AI 3사 추천 비교자료 준비 완료":"정답형 실험 자료 준비 완료") : "이 주제는 먼저 글로벌 AI 실험 제작실에서 답변을 수집하세요."}</strong>
              <p>{selectedExperimentReady ? "저장된 AI 3사 원문 답변과 공통 질문을 바탕으로 ChatGPT에서 글을 작성합니다. 추천 비교에는 객관적 정답률을 매기지 않습니다." : (selected.experimentHook || selected.note || "해외 독자가 궁금해할 한 가지 질문을 실제 자료로 시험합니다.")}</p>
            </div>
            <div className={styles.labEvidenceActions}>
              {!selectedExperimentReady && <button type="button" onClick={() => startExperimentDesign(selected)}>🧪 이 주제로 실험 설계 시작 →</button>}
              {selectedExperimentReady && <a href="/google-blog-schedule/experiment">글로벌 실험 제작실 ↗</a>}
              <a href="/google-blog-schedule/lab">숫자·PDF 검증실 ↗</a>
              {selectedExperimentReady && <button type="button" onClick={() => void copyText(selected.labReport || "", "실험 검증 리포트를 복사했습니다.")}>검증 근거 복사</button>}
            </div>
          </section>}

          <section className={styles.publishSetup}>
            <div className={styles.publishSetupHead}>
              <div>
                <span className={styles.stepNo}>SET</span>
                <h3>발행 설정</h3>
              </div>
              <span className={selectedUrlValid ? styles.setupLive : styles.setupDraft}>{selectedUrlValid ? "LIVE" : "DRAFT"}</span>
            </div>
            <div className={styles.publishSetupGrid}>
              <label>
                <span>고정 슬러그</span>
                <input value={selected.slug || ""} placeholder="영문-슬러그" onChange={e => updateRow(selected.id, { slug: e.target.value.trim().toLowerCase().replace(/\s+/g, "-") })} />
                <small>{selectedPlannedUrl || "슬러그를 입력하면 예정 URL이 생성됩니다."}</small>
              </label>
              <label>
                <span>실제 발행 URL</span>
                <input
                  value={selected.url}
                  placeholder="https://aipriceatlas.blogspot.com/...html"
                  onChange={e => {
                    const url = e.target.value.trim();
                    if (selected.status === "발행 완료" && !isValidPublishedUrl(url)) {
                      void syncPublishHistory(selected, false).then(ok => {
                        if (ok) void loadPublishHistory();
                      });
                    }
                    updateRow(selected.id, {
                      url,
                      status: selected.status === "발행 완료" && !isValidPublishedUrl(url) ? "작성 중" : selected.status,
                    });
                  }}
                />
                <small className={selectedUrlValid ? styles.setupOkText : styles.setupWarnText}>{selectedUrlValid ? "✓ 실제 URL 확인됨" : "발행 완료 전에 실제 URL이 필요합니다."}</small>
              </label>
              <label className={styles.publishNote}>
                <span>운영 메모</span>
                <input value={selected.note} placeholder="이 글에서 확인할 포인트" onChange={e => updateRow(selected.id, { note: e.target.value })} />
              </label>
            </div>
          </section>

          <div className={styles.managementTools}>
          {selected.kind !== "experiment" && <details className={styles.toolDetails}>
            <summary>
              <div><b>출처 · 가격 검증</b><span>공식 가격·웹·앱·세금·결제수단</span></div>
              <em>{selectedVerificationResolved}/6</em>
            </summary>
            <section className={styles.verificationPanel}>
            <div className={styles.verificationHead}>
              <div>
                <span className={styles.stepNo}>✓</span>
                <h3>출처 · 가격 검증 체크리스트</h3>
                <p>발행 전에 확인한 내용을 기록합니다. 각 항목을 누르면 미확인 → 확인 → 해당 없음 순으로 바뀝니다.</p>
              </div>
              <a className={styles.verificationGpt} href={verificationChatUrl} target="_blank" rel="noopener noreferrer" onClick={() => void copyText(verificationPrompt, "가격·출처 검증 요청서를 GPT로 열고 복사했습니다.")}>GPT 검증 요청</a>
            </div>

            <div className={styles.verificationSummary}>
              <div><span>처리</span><b>{selectedVerificationResolved}/6</b></div>
              <div><span>직접 확인</span><b>{selectedVerificationChecked}/6</b></div>
              <div className={selectedVerificationResolved === 6 ? styles.verifyReady : styles.verifyPending}>
                <span>상태</span><b>{selectedVerificationResolved === 6 ? "검증 기록 완료" : "확인 필요"}</b>
              </div>
            </div>

            <div className={styles.verificationGrid}>
              {VERIFICATION_ITEMS.map(item => {
                const value = selectedVerification[item.key];
                return (
                  <button key={item.key} className={`${styles.verifyItem} ${value === "checked" ? styles.verifyChecked : value === "na" ? styles.verifyNa : styles.verifyTodo}`} onClick={() => cycleVerification(item.key)} type="button">
                    <span>{value === "checked" ? "✓" : value === "na" ? "—" : "○"}</span>
                    <b>{item.label}</b>
                    <small>{verificationValueLabel(value)}</small>
                  </button>
                );
              })}
            </div>

            <div className={styles.verificationMeta}>
              <label>
                <span>마지막 확인일</span>
                <div className={styles.dateVerifyRow}>
                  <input type="date" value={selectedVerification.checkedAt} onChange={e => updateVerification({ checkedAt: e.target.value })} />
                  <button type="button" onClick={() => updateVerification({ checkedAt: today })}>오늘</button>
                </div>
              </label>
              <label>
                <span>공식 출처 URL</span>
                <input type="url" value={selectedVerification.officialSource} placeholder="https://..." onChange={e => updateVerification({ officialSource: e.target.value.trim() })} />
              </label>
              <label>
                <span>보조 출처 URL</span>
                <input type="url" value={selectedVerification.secondarySource} placeholder="앱스토어·도움말 등 (선택)" onChange={e => updateVerification({ secondarySource: e.target.value.trim() })} />
              </label>
            </div>

            <div className={styles.verificationActions}>
              {selectedVerification.officialSource && <a href={selectedVerification.officialSource} target="_blank" rel="noopener noreferrer">공식 출처 열기 ↗</a>}
              {selectedVerification.secondarySource && <a href={selectedVerification.secondarySource} target="_blank" rel="noopener noreferrer">보조 출처 열기 ↗</a>}
              <button type="button" onClick={() => void copyText(verificationSummary(selected), "검증 기록을 복사했습니다.")}>검증 기록 복사</button>
            </div>
            </section>
          </details>}

          <details className={styles.toolDetails}>
            <summary>
              <div><b>SEO 중복 검사</b><span>비슷한 검색의도·기존 글 충돌 확인</span></div>
              <em className={duplicateCount ? styles.toolAlert : ""}>{duplicateCount ? `${duplicateCount}건` : "OK"}</em>
            </summary>
            <section className={styles.seoCheckPanel}>
            <div className={styles.seoCheckHead}>
              <div>
                <span className={styles.stepNo}>SEO</span>
                <h3>중복 키워드 · 검색의도 검사</h3>
                <p>현재 제목과 핵심 키워드를 기존 발행글·예정글과 비교합니다. 단어가 비슷해도 검색 목적이 다르면 유사 주제로만 표시합니다.</p>
              </div>
              {selectedSimilarTopics.length > 0 && (
                <a className={styles.seoGptBtn} href={differentiateChatUrl} target="_blank" rel="noopener noreferrer" onClick={() => void copyText(differentiatePrompt, "중복·차별화 검토 요청서를 GPT로 열고 복사했습니다.")}>GPT 차별화 검토</a>
              )}
            </div>

            <div className={styles.seoCheckSummary}>
              <div className={duplicateCount ? styles.seoDanger : styles.seoSafe}><span>중복 가능</span><b>{duplicateCount}</b></div>
              <div className={similarCount ? styles.seoWarn : styles.seoSafe}><span>유사 주제</span><b>{similarCount}</b></div>
              <div className={duplicateCount ? styles.seoDecisionWarn : styles.seoDecisionOk}><span>판단</span><b>{duplicateCount ? "기존 글 우선 검토" : "새 글 진행 가능"}</b></div>
            </div>

            {selectedSimilarTopics.length ? (
              <div className={styles.similarTopicList}>
                {selectedSimilarTopics.slice(0, 6).map(item => (
                  <div key={item.id} className={`${styles.similarTopicItem} ${item.level === "high" ? styles.similarHigh : styles.similarMedium}`}>
                    <div>
                      <div className={styles.similarBadges}>
                        <span>{item.level === "high" ? "중복 가능" : "유사 주제"}</span>
                        <em>{Math.round(item.score * 100)}%</em>
                        <small>{item.source === "published" ? "기존 발행글" : "스케줄 글"}</small>
                      </div>
                      <b>{item.title}</b>
                      <p>{item.keyword || "키워드 없음"}</p>
                    </div>
                    <div className={styles.similarActions}>
                      {item.url && isValidPublishedUrl(item.url) && <a href={item.url} target="_blank" rel="noopener noreferrer">글 열기 ↗</a>}
                      <button onClick={() => {
                        const scheduleRow = rows.find(row => row.id === item.id);
                        if (scheduleRow) setSelectedId(scheduleRow.id);
                        else void copyText(item.url, "기존 발행글 URL을 복사했습니다.");
                      }}>{item.source === "schedule" ? "이 글 보기" : "URL 복사"}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.seoClear}><b>뚜렷하게 겹치는 주제가 없습니다.</b><span>현재 스케줄과 등록된 기존 발행글 기준으로는 새 글을 진행해도 괜찮아 보입니다.</span></div>
            )}
            </section>
          </details>

          <details className={styles.toolDetails}>
            <summary>
              <div><b>내부링크</b><span>관련 글 URL과 연결 후보</span></div>
              <em>{selectedRelated.length}</em>
            </summary>
            <section className={styles.linkPanel}>
            <div className={styles.linkPanelHead}>
              <div>
                <span className={styles.stepNo}>URL</span>
                <h3>예정 URL · 내부링크 연결</h3>
                <p>슬러그를 미리 고정해두고, 실제 발행 URL이 입력되면 그 주소를 우선 사용합니다.</p>
              </div>
              <button onClick={() => void copyText(selectedResolvedUrl, "현재 글 URL을 복사했습니다.")}>현재 URL 복사</button>
            </div>
            <div className={styles.currentUrl}>
              <span>{isValidPublishedUrl(selected.url) ? "실제 발행 URL · LIVE" : "예정 URL · 아직 PLANNED"}</span>
              <b>{selectedResolvedUrl || "슬러그를 입력해 주세요."}</b>
              {!isValidPublishedUrl(selected.url) && <small>발행 완료하려면 공개된 실제 Blogger URL을 위 표에 입력해야 합니다.</small>}
            </div>
            <div className={styles.relatedList}>
              {selectedRelated.length ? selectedRelated.map(item => {
                const url = resolvedUrl(item);
                const live = isValidPublishedUrl(item.url);
                return (
                  <div key={item.id} className={styles.relatedItem}>
                    <div>
                      <span className={live ? styles.liveBadge : styles.plannedBadge}>{live ? "LIVE" : "PLANNED"}</span>
                      <b>{item.title}</b>
                      <small>{url}</small>
                    </div>
                    <div>
                      <button onClick={() => void copyText(url, "관련 글 URL을 복사했습니다.")}>URL 복사</button>
                      {live && url && <a href={url} target="_blank" rel="noopener noreferrer">열기 ↗</a>}
                    </div>
                  </div>
                );
              }) : <div className={styles.noRelated}>관련 글 연결 후보가 없습니다.</div>}
            </div>
            <button
              className={styles.copyLinkPlan}
              onClick={() => void copyText(relatedLinkText(selected, rows), "내부링크 연결 목록을 복사했습니다.")}
            >
              관련 URL 목록 한 번에 복사
            </button>
            </section>
          </details>

          <details className={styles.toolDetails}>
            <summary>
              <div><b>역방향 내부링크</b><span>기존 글에서 새 글로 다시 연결</span></div>
              <em>{selectedUrlValid ? selectedBacklinkRemaining : "발행 후"}</em>
            </summary>
            <section className={styles.backlinkPanel}>
            <div className={styles.backlinkHead}>
              <div>
                <span className={styles.stepNo}>↩</span>
                <h3>역방향 내부링크</h3>
                <p>새 글을 발행한 뒤, 기존 글에서 이 새 글로 다시 연결하면 좋은 위치를 관리합니다.</p>
              </div>
              <button onClick={() => void copyText(backlinkPlanText(selected, rows), "역방향 내부링크 작업 목록을 복사했습니다.")}>작업 목록 복사</button>
            </div>

            {!isValidPublishedUrl(selected.url) ? (
              <div className={styles.backlinkWaiting}>
                <b>새 글 발행 후 활성화됩니다.</b>
                <span>실제 Blogger URL을 입력하고 LIVE로 만들면 기존 글 수정 대상이 자동으로 표시됩니다.</span>
              </div>
            ) : selectedReverse.length ? (
              <>
                <div className={styles.backlinkSummary}>
                  <div><span>기존 LIVE 글</span><b>{selectedReverseLive.length}</b></div>
                  <div><span>반영 완료</span><b>{selectedReverseLive.filter(item => selectedBacklinkDone.includes(item.id)).length}</b></div>
                  <div><span>남은 작업</span><b>{selectedReverseLive.filter(item => !selectedBacklinkDone.includes(item.id)).length}</b></div>
                </div>
                <div className={styles.backlinkList}>
                  {selectedReverse.map(source => {
                    const live = isValidPublishedUrl(source.url);
                    const done = selectedBacklinkDone.includes(source.id);
                    const prompt = live ? buildBacklinkPrompt(source, selected) : "";
                    const chatUrl = prompt ? "https://chatgpt.com/?q=" + encodeURIComponent(prompt) : "";
                    return (
                      <div key={source.id} className={`${styles.backlinkItem} ${done ? styles.backlinkDone : ""}`}>
                        <div className={styles.backlinkMain}>
                          <div className={styles.backlinkBadges}>
                            <span className={live ? styles.liveBadge : styles.plannedBadge}>{live ? "LIVE" : "PLANNED"}</span>
                            {done && <span className={styles.doneBadge}>DONE</span>}
                          </div>
                          <b>{source.title}</b>
                          <small>{resolvedUrl(source)}</small>
                          <p>추천 앵커: <strong>{suggestedAnchorText(selected)}</strong></p>
                        </div>
                        <div className={styles.backlinkActions}>
                          {live ? (
                            <>
                              <a href={source.url} target="_blank" rel="noopener noreferrer">기존 글 열기 ↗</a>
                              <a className={styles.gptBacklink} href={chatUrl} target="_blank" rel="noopener noreferrer" onClick={() => void copyText(prompt, "역링크 수정 요청서를 GPT로 열고 복사했습니다.")}>GPT 수정 요청</a>
                              <button onClick={() => toggleBacklinkDone(source.id)}>{done ? "완료 취소" : "✓ 추가 완료"}</button>
                            </>
                          ) : (
                            <span className={styles.waitBadge}>이 글이 발행되면 수정 가능</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className={styles.backlinkWaiting}>
                <b>현재 지정된 역링크 후보가 없습니다.</b>
                <span>관련 글 연결 계획에 이 글을 포함한 기존 글이 생기면 자동으로 표시됩니다.</span>
              </div>
            )}
            </section>
          </details>
          </div>

          {selected.kind !== "experiment" && <section className={styles.contentPlanPanel}>
            <div className={styles.contentPlanHead}>
              <div>
                <span className={styles.planEyebrow}>FAST RESEARCH · ONE PASS</span>
                <h3>🎯 조사·기획 한 번에</h3>
                <p>MONEY INTENT → SEARCH PLAN → ORIGINAL VALUE → ANSWER FIRST를 한 번에 조사합니다. 운영자는 결과를 붙여넣기만 하면 됩니다.</p>
              </div>
              <span className={selected.contentPlan ? styles.planReady : styles.planWaiting}>
                {selected.contentPlan ? "✓ 본문·이미지 반영" : "기획 전"}
              </span>
            </div>
            <div className={styles.contentPlanActions}>
              <a
                href={contentPlanChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  startWork();
                  void copyText(contentPlanPrompt, "통합 조사·기획 요청서를 ChatGPT로 열고 복사했습니다.");
                }}
              >
                🔎 1 · 조사·기획 시작
              </a>
              <button type="button" onClick={() => void copyText(contentPlanPrompt, "통합 조사·기획 요청서를 복사했습니다.")}>요청서만 복사</button>
              {selected.contentPlan && <button type="button" className={styles.planClear} onClick={clearContentPlan}>기획 비우기</button>}
            </div>
            <details className={styles.contentPlanPaste}>
              <summary>2 · ChatGPT 조사 결과 붙여넣기</summary>
              <textarea
                value={selected.contentPlanRaw || ""}
                onChange={e => updateRow(selected.id, { contentPlanRaw: e.target.value })}
                placeholder="[GOOGLE_PLAN_JSON] ... [/GOOGLE_PLAN_JSON]이 포함된 조사 결과를 통째로 붙여넣으세요."
              />
              <button type="button" onClick={importContentPlan}>기획 자동 불러오기</button>
            </details>

            {selected.contentPlan && (
              <div className={styles.contentPlanCard}>
                <div className={styles.planSummaryGrid}>
                  <div><span>MONEY INTENT</span><b>{selected.contentPlan.moneyIntent}</b></div>
                  <div><span>CLUSTER</span><b>{selected.contentPlan.cluster || "미지정"}</b></div>
                  <div><span>PRIMARY QUERY</span><b>{selected.contentPlan.primaryQuery}</b></div>
                  <div><span>EVIDENCE</span><b>{selected.contentPlan.evidenceLevel || "B"}</b></div>
                </div>
                <div className={styles.planDecision}>
                  <span>USER DECISION</span>
                  <b>{selected.contentPlan.userDecision}</b>
                </div>
                <div className={styles.planOriginal}>
                  <span>ORIGINAL VALUE</span>
                  <p>{selected.contentPlan.originalValue}</p>
                </div>
                <div className={styles.planAnswer}>
                  <span>ANSWER FIRST</span>
                  <p>{selected.contentPlan.answerFirst}</p>
                </div>
                {!!selected.contentPlan.secondaryQueries.length && (
                  <div className={styles.planQueries}>
                    <span>SECONDARY QUERIES</span>
                    <p>{selected.contentPlan.secondaryQueries.join(" · ")}</p>
                  </div>
                )}
                <div className={styles.planMeta}>
                  <span>확인일 · {selected.contentPlan.checkedAt || "미기재"}</span>
                  <span>공식 근거 · {selected.contentPlan.sourceUrls.length}개</span>
                </div>
              </div>
            )}
          </section>}

          <div className={styles.sectionDivider}>
            <div><span>CREATE</span><b>콘텐츠 만들기</b></div>
            <small>관리 도구는 필요할 때만 열고, 아래에서 본문과 이미지를 제작하세요.</small>
          </div>

          <div className={styles.workflowGrid}>
            <section className={styles.requestCard}>
              <span className={styles.stepNo}>01</span>
              <h3>본문 요청서</h3>
              <p>{selected.kind === "experiment" ? "실험실에서 수집한 실제 AI 3사 답변과 공통 질문을 활용해 ChatGPT에서 영문 글을 작성합니다. 정답형과 추천형을 구분하며 가격·결제 글 템플릿은 적용하지 않습니다." : selected.contentPlan ? "통합 기획에서 확정한 검색 의도·차별화 가치·첫 답을 반영해 SEO 메타와 Blogger HTML까지 한 번에 만듭니다." : "통합 기획 없이도 작성할 수 있지만, 검색 의도와 차별화 가치를 먼저 확정하면 글 품질이 더 안정적입니다."}</p>
              <div className={styles.requestActions}>
                {selected.kind === "experiment" && !selectedExperimentReady ? (
                  <button className={styles.primaryAction} type="button" onClick={() => startExperimentDesign(selected)}>🧪 먼저 실험 설계·검증하기</button>
                ) : (
                  <>
                    <a
                      className={styles.primaryAction}
                      href={articleChatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        startWork();
                        void copyText(articlePrompt, "본문 요청서를 ChatGPT로 열고 클립보드에도 복사했습니다.");
                      }}
                    >
                      📝 GPT에 요청서 바로 열기
                    </a>
                    <button onClick={() => void copyText(articlePrompt, "본문 요청서를 복사했습니다.")}>요청서만 복사</button>
                  </>
                )}
              </div>
              <details className={styles.promptDetails}>
                <summary>본문 요청서 확인</summary>
                <textarea readOnly value={articlePrompt} />
              </details>
            </section>

            <section className={styles.requestCard}>
              <span className={styles.stepNo}>02</span>
              <h3>이미지 요청서 6장</h3>
              <p>{selected.kind === "experiment" ? (selectedRecommendationImages ? "6장 중복 방지 적용: 00 관심·01 공통 질문·02 선택 결과·03 선정 이유·04 단점·05 독자 체크리스트. 각각 다른 근거와 디자인으로 제작합니다." : selected.experimentMode === "recommend" ? "대표·공통 질문·3사 추천·선정 이유·장단점·요약 6장. 존재하지 않는 정답이나 승자는 넣지 않습니다." : "실험 대표·테스트 설정·실제 AI 답변·정답 공개·근거 검증·발견 6장. 없는 사실은 넣지 않습니다.") : "대표 이미지부터 가격·결제·비교·요약까지 슬롯별로 ChatGPT 새 창에 바로 전달합니다."}</p>
              <div className={styles.imagePromptGrid}>
                {IMAGE_SLOTS.map(slot => {
                  const prompt = buildImagePrompt(selected, slot, selected.contentPlan);
                  const chatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
                  return (
                    <div key={slot.id} className={styles.imagePromptItem}>
                      <div><b>{slot.id} · {imageSlotFor(selected, slot).label}</b><small>{imageSlotFor(selected, slot).role}</small></div>
                      <div>
                        <a
                          href={chatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            startWork();
                            void copyText(prompt, `${slot.id} 이미지 요청서를 열고 복사했습니다.`);
                          }}
                        >GPT 열기</a>
                        <button onClick={() => void copyText(prompt, `${slot.id} 이미지 요청서를 복사했습니다.`)}>복사</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className={styles.sectionDivider}>
            <div><span>WRITE</span><b>완성본 붙여넣기</b></div>
            <small>GPT 결과를 붙여넣으면 Blogger용 메타와 본문을 자동 분리합니다.</small>
          </div>

          <section className={styles.bodyCard}>
            <div className={styles.bodyHead}>
              <div>
                <span className={styles.stepNo}>03</span>
                <h3>ChatGPT 완성본 붙여넣기</h3>
                <p>[FINAL_TITLE]부터 [BLOGGER_HTML]까지 받은 전체 결과를 그대로 붙여넣으세요.</p>
              </div>
              <button
                className={styles.completeBtn}
                disabled={!publishReady}
                onClick={() => completeRow(selected)}
              >
                ✓ 발행 완료 표시
              </button>
            </div>
            <textarea
              className={styles.bodyEditor}
              value={selected.body || ""}
              placeholder="ChatGPT가 만든 최종 결과 전체를 붙여넣으세요."
              onChange={e => updateRow(selected.id, { body: e.target.value, status: selected.status === "발행 완료" ? "발행 완료" : "작성 중" })}
            />
          </section>

          <section className={styles.imageLinkCard}>
            <div className={styles.imageLinkHead}>
              <div>
                <span className={styles.stepNo}>IMG</span>
                <h3>이미지 최적화 · 업로드</h3>
                <p>GPT에서 저장한 이미지를 바로 올리세요. 자동으로 최대 1600px WebP(품질 82%)로 줄인 뒤 Supabase Storage에 저장하고 본문 위치까지 연결합니다.</p>
              </div>
              <div className={styles.imageTopStats}>
                <span className={imageReadyCount === IMAGE_SLOTS.length ? styles.imageAllReady : styles.imageProgress}>{imageReadyCount}/6 연결</span>
                {selectedImageBytes > 0 && <span className={styles.imageSizeBadge}>현재 {formatBytes(selectedImageBytes)}</span>}
              </div>
            </div>

            <label className={`${styles.batchDrop} ${batchUploading ? styles.batchUploading : ""}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={batchUploading}
                onChange={e => { void uploadImageBatch(e.target.files); e.currentTarget.value = ""; }}
              />
              <b>{batchUploading ? "이미지 최적화·업로드 중…" : "이미지 최대 6장 한 번에 선택"}</b>
              <span>파일명에 00~05가 있으면 해당 슬롯으로 자동 배치 · 없으면 파일명 순서대로 00→05</span>
            </label>

            <div className={styles.imageUploadGrid}>
              {IMAGE_SLOTS.map(slot => {
                const raw = selected.imageUrls?.[slot.id] || "";
                const src = extractImageUrl(raw);
                const meta = selected.imageMeta?.[slot.id];
                const uploading = !!uploadingSlots[slot.id];
                return (
                  <div key={slot.id} className={`${styles.uploadSlot} ${src ? styles.uploadSlotReady : ""}`}>
                    <div className={styles.uploadSlotHead}>
                      <div><b>{slot.id} · {imageSlotFor(selected, slot).label}</b><small>{imageSlotFor(selected, slot).role}</small></div>
                      <span>{uploading ? "업로드 중" : src ? "✓ 완료" : "대기"}</span>
                    </div>

                    {src ? (
                      <div className={styles.uploadPreview}>
                        <img src={src} alt={`${selected.title} — ${imageSlotFor(selected, slot).label}`} />
                      </div>
                    ) : (
                      <div className={styles.uploadEmpty}>이미지 없음</div>
                    )}

                    {meta && (
                      <div className={styles.optimizeInfo}>
                        <span>{meta.width}×{meta.height}</span>
                        <span>{formatBytes(meta.originalBytes)} → <b>{formatBytes(meta.optimizedBytes)}</b></span>
                        <span>{meta.originalBytes > 0 ? Math.max(0, Math.round((1 - meta.optimizedBytes / meta.originalBytes) * 100)) : 0}% 절감</span>
                      </div>
                    )}

                    <div className={styles.uploadSlotActions}>
                      <label className={styles.slotUploadBtn}>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={uploading || batchUploading}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) void uploadImageToSlot(slot.id, file);
                            e.currentTarget.value = "";
                          }}
                        />
                        {uploading ? "처리 중…" : src ? "이미지 교체" : "이미지 선택"}
                      </label>
                      {src && <button type="button" onClick={() => void removeUploadedImage(slot.id)}>삭제</button>}
                    </div>

                    <details className={styles.manualUrlDetails}>
                      <summary>URL 직접 입력</summary>
                      <input
                        value={raw}
                        placeholder="Blogger URL 또는 <img> HTML"
                        onChange={e => updateImageUrl(slot.id, e.target.value)}
                      />
                    </details>
                  </div>
                );
              })}
            </div>

            <div className={styles.imageLinkNote}>
              <b>저장공간 최적화</b>
              <span>원본은 저장하지 않고 WebP 결과만 저장합니다. 같은 슬롯을 다시 올리면 이전 업로드 파일을 자동 삭제합니다. Blogger 본문에는 공개 CDN URL만 들어갑니다.</span>
            </div>
          </section>
          <div className={styles.sectionDivider}>
            <div><span>PUBLISH</span><b>Blogger 발행</b></div>
            <small>제목·설명·슬러그·라벨·본문을 확인하고 최종 발행하세요.</small>
          </div>

          <section className={styles.bloggerCard}>
            <div className={styles.bloggerHead}>
              <div>
                <span className={styles.stepNo}>04</span>
                <h3>Blogger 기본 서식으로 바로 업로드</h3>
                <p>본문 디자인은 Blogger 테마에 맡깁니다. 제목(H2) · 부제목(H3) · 소제목(H4) · 보통(p)만 사용하고 글마다 폰트·크기·색상을 강제하지 않습니다.</p>
              </div>
              <a className={styles.bloggerOpen} href="https://www.blogger.com/" target="_blank" rel="noopener noreferrer">Blogger 열기 ↗</a>
            </div>

            <div className={styles.metaGrid}>
              <div><span>최종 제목</span><b>{bloggerOutput.valid ? bloggerOutput.title : "원고 형식 확인 필요"}</b><button disabled={!bloggerOutput.valid} onClick={() => void copyText(bloggerOutput.title, "최종 제목을 복사했습니다.")}>복사</button></div>
              <div><span>검색 설명</span><b>{bloggerOutput.valid ? bloggerOutput.description : "원고 형식 확인 필요"}</b><button disabled={!bloggerOutput.valid} onClick={() => void copyText(bloggerOutput.description, "검색 설명을 복사했습니다.")}>복사</button></div>
              <div><span>슬러그</span><b>{bloggerOutput.valid ? bloggerOutput.slug : "원고 형식 확인 필요"}</b><button disabled={!bloggerOutput.valid} onClick={() => void copyText(bloggerOutput.slug, "슬러그를 복사했습니다.")}>복사</button></div>
              <div><span>라벨</span><b>{bloggerOutput.valid ? bloggerOutput.labels : "원고 형식 확인 필요"}</b><button disabled={!bloggerOutput.valid} onClick={() => void copyText(bloggerOutput.labels, "라벨을 복사했습니다.")}>복사</button></div>
            </div>
            {Boolean(selected.body?.trim()) && !bloggerOutput.valid && (
              <div className={styles.copyMessage} role="alert" style={{ color: "#a12720" }}>
                ⚠️ 원고 분리 오류: {bloggerOutput.errors.join(" / ")} 원고를 확인한 뒤 다시 붙여넣어 주세요.
              </div>
            )}
            {bloggerOutput.valid && missingImageSlots.length > 0 && (
              <div className={styles.copyMessage} role="status">
                이미지 미연결 슬롯: {missingImageSlots.map(slot => slot.id).join(", ")} · 모두 연결해야 최종 발행 복사가 활성화됩니다.
              </div>
            )}

            <div className={styles.bloggerActions}>
              <button className={styles.bloggerPrimary} disabled={!publishReady} onClick={() => void copyBloggerRich()}>이미지 포함 전체복사</button>
              <button disabled={!publishReady} onClick={() => void copyHtmlCode()}>이미지 포함 HTML 복사</button>
              <span>이미지 {imageReadyCount}/6 연결 · URL이 없는 슬롯은 자리표시자가 그대로 남습니다.</span>
            </div>
            {copyMessage && <div className={styles.copyMessage}>{copyMessage}</div>}

            <div className={styles.previewPane}>
              <div className={styles.previewHead}><b>Blogger 최종 미리보기</b><span>{finalBloggerHtml ? `이미지 ${imageReadyCount}/6 반영` : "완성본 대기"}</span></div>
              {bloggerOutput.valid && finalBloggerHtml ? (
                <iframe
                  title="Blogger preview"
                  sandbox=""
                  className={styles.previewFrame}
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#202124;line-height:1.7;padding:24px;max-width:860px;margin:auto}h2{font-size:26px;margin:36px 0 14px}h3{font-size:21px;margin:28px 0 12px}h4{font-size:18px;margin:22px 0 10px}p{font-size:17px;margin:0 0 16px}strong{font-weight:700}table{width:100%;border-collapse:collapse;margin:22px 0}th,td{border:1px solid #ddd;padding:10px;text-align:left}a{color:#1769aa}img{max-width:100%;height:auto}</style></head><body>${finalBloggerHtml}</body></html>`}
                />
              ) : (
                <div className={styles.previewEmpty}>ChatGPT 결과를 위에 붙여넣으면 Blogger에 들어갈 본문을 여기서 확인할 수 있습니다.</div>
              )}
            </div>
          </section>
        </section>}
      </section>
    </main>
  );
}
