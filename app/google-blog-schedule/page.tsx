"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";
import styles from "./page.module.css";

type Status = "예정" | "작성 중" | "발행 완료";
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
  body?: string;
  imageUrls?: Record<string, string>;
  imageMeta?: Record<string, ImageUploadMeta>;
};

type BloggerOutput = {
  title: string;
  description: string;
  slug: string;
  labels: string;
  html: string;
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

const IMAGE_SLOTS = [
  { id: "00", label: "대표 이미지", role: "글의 핵심 제품·국가·가격 주제를 한눈에 보여주는 대표 비주얼" },
  { id: "01", label: "가격 요약", role: "현재 확인된 가격과 통화, 기준 시점을 간결하게 보여주는 정보 이미지" },
  { id: "02", label: "웹 vs 앱", role: "웹 결제와 앱스토어 결제 차이를 비교하는 설명 이미지" },
  { id: "03", label: "결제 방법", role: "지원되는 결제수단·결제 흐름을 쉽게 보여주는 설명 이미지" },
  { id: "04", label: "국가·지역 맥락", role: "해당 국가의 통화·세금·지역 가격 맥락을 보여주는 이미지" },
  { id: "05", label: "핵심 정리", role: "독자가 마지막에 기억할 핵심 3~4가지를 정리하는 요약 이미지" },
] as const;

const STORAGE_KEY = "content-maker-google-blog-schedule-v3-links";
const SYNC_KEY_STORAGE = "content-maker-google-blog-sync-key-v1";
const LOCAL_UPDATED_KEY = "content-maker-google-blog-local-updated-v1";
const BLOG_BASE = "https://aipriceatlas.blogspot.com";
const IMAGE_BUCKET = "content-maker-assets";

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

const DEFAULT_ROWS: ScheduleRow[] = [
  { id: "2026-09-29-1", date: "2026-09-29", title: "Claude Pro Price in South Korea 2026: Web, App & Billing Guide", keyword: "Claude Pro Korea price", status: "예정", url: "", slug: "claude-pro-price-south-korea-2026", relatedIds: ["2026-10-02-1","2026-09-30-1","2026-10-12-1"], note: "가격 검증형 · 웹/앱 가격 · 세금 · 실제 결제 단계까지 확인" },
  { id: "2026-09-30-1", date: "2026-09-30", title: "Gemini AI Subscription Price in South Korea 2026: Plans, Tax & Payment", keyword: "Gemini Korea price", status: "예정", url: "", slug: "gemini-ai-price-south-korea-2026", relatedIds: ["2026-10-02-1","2026-09-29-1","2026-10-12-1"], note: "가격 검증형 · 플랜별 가격 · 세금 · 결제 방식 구분" },
  { id: "2026-10-01-1", date: "2026-10-01", title: "ChatGPT Plus Web vs App Store Price 2026: Why Mobile Can Cost More", keyword: "ChatGPT web vs app price", status: "예정", url: "", slug: "chatgpt-plus-web-vs-app-store-price-2026", relatedIds: ["2026-10-10-1","2026-10-11-1","2026-10-06-1","2026-10-05-1"], note: "문제 해결형 · 웹/iOS/Android 가격 차이 원인과 확인 방법" },
  { id: "2026-10-02-1", date: "2026-10-02", title: "ChatGPT vs Claude vs Gemini Price in South Korea 2026", keyword: "AI subscription price Korea", status: "예정", url: "", slug: "chatgpt-claude-gemini-price-south-korea-2026", relatedIds: ["2026-09-29-1","2026-09-30-1","2026-10-12-1"], note: "비교형 · 동일 기준일에 가격·세금·결제 방식·주요 플랜 비교" },
  { id: "2026-10-03-1", date: "2026-10-03", title: "ChatGPT Plus Price in Taiwan 2026: Web, iOS & Android Compared", keyword: "ChatGPT Plus Taiwan price", status: "예정", url: "", slug: "chatgpt-plus-price-taiwan-2026", relatedIds: ["2026-10-05-1","2026-10-04-1","2026-10-11-1"], note: "국가 가격 검증형 · TWD 실제 표시 여부 · 앱 가격 · 세금 확인" },
  { id: "2026-10-04-1", date: "2026-10-04", title: "ChatGPT Plus Price in Singapore 2026: Web, iOS & Android Compared", keyword: "ChatGPT Plus Singapore price", status: "예정", url: "", slug: "chatgpt-plus-price-singapore-2026", relatedIds: ["2026-10-05-1","2026-10-03-1","2026-10-11-1"], note: "국가 가격 검증형 · SGD · GST · 웹/앱 차이 확인" },
  { id: "2026-10-05-1", date: "2026-10-05", title: "ChatGPT Plus Price by Country 2026: Live Comparison Table", keyword: "ChatGPT Plus price by country", status: "예정", url: "", slug: "chatgpt-plus-price-by-country-2026", relatedIds: ["2026-10-03-1","2026-10-04-1","2026-10-11-1","2026-10-08-1"], note: "대표 기둥글 · 동일 날짜 기준 국가별 가격·통화·세금·플랫폼을 직접 비교하고 계속 업데이트" },
  { id: "2026-10-06-1", date: "2026-10-06", title: "ChatGPT Plus Payment Failed? Common Causes and Fixes in 2026", keyword: "ChatGPT Plus payment failed", status: "예정", url: "", slug: "chatgpt-plus-payment-failed-fixes-2026", relatedIds: ["2026-10-01-1","2026-10-10-1","2026-10-11-1"], note: "문제 해결형 · 카드 거절·앱스토어·지역·결제 프로필 등 공식 해결책 중심" },
  { id: "2026-10-07-1", date: "2026-10-07", title: "Claude Pro Price in Japan 2026: Web, App & Billing Guide", keyword: "Claude Pro Japan price", status: "예정", url: "", slug: "claude-pro-price-japan-2026", relatedIds: ["2026-10-09-1","2026-09-29-1","2026-10-12-1"], note: "국가 가격 검증형 · JPY 실제 가격 · 세금 · 웹/앱 결제 차이" },
  { id: "2026-10-08-1", date: "2026-10-08", title: "ChatGPT Plus Price History 2025–2026: What Changed?", keyword: "ChatGPT Plus price history", status: "예정", url: "", slug: "chatgpt-plus-price-history-2025-2026", relatedIds: ["2026-10-05-1","2026-10-11-1","2026-10-01-1"], note: "가격 추적형 · 날짜별 확인 가능한 변화만 연표로 정리 · 과거와 현재 가격 구분" },
  { id: "2026-10-09-1", date: "2026-10-09", title: "AI Subscription Prices in Japan 2026: ChatGPT vs Claude vs Gemini", keyword: "AI subscription price Japan", status: "예정", url: "", slug: "ai-subscription-prices-japan-2026", relatedIds: ["2026-10-07-1","2026-10-12-1","2026-10-05-1"], note: "비교형 · JPY 기준 동일 시점 가격·세금·플랜·결제 차이 비교" },
  { id: "2026-10-10-1", date: "2026-10-10", title: "How to Switch ChatGPT Plus From App Store to Web Billing", keyword: "switch ChatGPT Plus to web billing", status: "예정", url: "", slug: "switch-chatgpt-plus-app-store-to-web-billing", relatedIds: ["2026-10-01-1","2026-10-06-1","2026-10-11-1"], note: "실전 가이드형 · 중복 결제 방지 · 구독 취소/재구독 단계는 공식 안내 기준" },
  { id: "2026-10-11-1", date: "2026-10-11", title: "Does ChatGPT Plus Include Tax? Country-by-Country Billing Guide 2026", keyword: "ChatGPT Plus tax", status: "예정", url: "", slug: "does-chatgpt-plus-include-tax-2026", relatedIds: ["2026-10-05-1","2026-10-01-1","2026-10-03-1","2026-10-04-1"], note: "결제 가이드형 · VAT/GST/판매세 포함 여부를 국가별로 확인하고 불확실한 지역은 구분" },
  { id: "2026-10-12-1", date: "2026-10-12", title: "AI Subscription Price Comparison by Country 2026: ChatGPT, Claude & Gemini", keyword: "AI subscription prices by country", status: "예정", url: "", slug: "ai-subscription-price-comparison-by-country-2026", relatedIds: ["2026-10-05-1","2026-10-02-1","2026-10-09-1","2026-09-29-1"], note: "종합 데이터형 · 국가·서비스별 가격을 동일 기준으로 비교하는 장기 업데이트 페이지" },
];

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDate(value: string) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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


function buildArticlePrompt(row: ScheduleRow, allRows: ScheduleRow[]) {
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
- 별도의 H1은 만들지 말 것. Blogger의 글 제목이 H1 역할을 함.
- 검색 의도에 맞는 H2 4~7개를 구성.
- 짧은 도입 2~3문단.
- 핵심 답 또는 핵심 비교표를 초반에 배치.
- 독자가 실제로 행동할 수 있는 확인 방법 또는 체크리스트 포함.
- FAQ는 실제 검색자가 추가로 궁금해할 내용이 있을 때만 3~6개.
- Final takeaway는 새 내용을 반복하지 말고 핵심 판단 기준을 짧게 정리.
- 문단은 짧고 모바일에서 읽기 쉽게 작성

[이미지 위치]
본문 HTML 안에 아래 위치 문구를 각각 한 줄로 정확히 넣어줘.
[IMAGE 00 — Hero]
[IMAGE 01 — Price snapshot]
[IMAGE 02 — Web vs app]
[IMAGE 03 — Payment methods]
[IMAGE 04 — Country context]
[IMAGE 05 — Key takeaways]

[내부 링크]
관련성이 있을 때 아래 기존 글을 자연스럽게 1~2개만 연결해줘.
- ChatGPT Plus Price in South Korea 2026: https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-south-korea-2026.html
- ChatGPT Plus Price in Japan 2026: https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-japan-2026-3000.html
관련성이 낮으면 억지로 넣지 말 것.

[Blogger HTML 규칙]
- 본문은 Blogger HTML 보기에서 바로 붙여넣을 수 있는 깨끗한 HTML로 작성.
- <html>, <head>, <body>, <style>, <script> 태그 금지.
- h2, h3, p, strong, em, ul, ol, li, table, thead, tbody, tr, th, td, a, br 정도의 단순한 태그만 사용.
- 마크다운 문법을 HTML 안에 섞지 말 것.
- 표에는 width 고정값이나 복잡한 CSS를 넣지 말 것.
- 외부 광고 스크립트나 임베드 코드를 넣지 말 것.
- URL은 실제 내부링크 외에는 본문에 길게 노출하지 말 것.

[최종 출력 형식 — 매우 중요]
아래 마커를 정확히 사용하고, 마커 사이 내용만 출력할 것.
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

function buildImagePrompt(row: ScheduleRow, slot: typeof IMAGE_SLOTS[number]) {
  return `AI Price Atlas 구글 블로그용 이미지를 1장 만들어줘.

[글 정보]
글 제목: ${row.title || "제목 미입력"}
핵심 키워드: ${row.keyword || "키워드 미입력"}
기획 메모: ${row.note || "없음"}

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
- ${slot.id === "00" ? "대표 이미지이므로 제목 전체를 반복하지 말고 제품명·국가·핵심 가격 포인트가 1초 안에 보이게 구성." : "본문 설명 이미지이므로 큰 광고성 헤드라인보다 비교·과정·요약이 중심이 되게 구성."}
- 한글, 워터마크, 타사 편집툴 로고 금지.

중요: 여러 장 합본이 아니라 슬롯 ${slot.id}에 사용할 이미지 한 장만 바로 생성해줘.`;
}

function parseSection(raw: string, name: string) {
  const pattern = new RegExp("\\[" + name + "\\]\\s*([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]|$)", "i");
  return raw.match(pattern)?.[1]?.trim() || "";
}

function parseBloggerOutput(raw: string): BloggerOutput {
  const htmlMatch = raw.match(/\[BLOGGER_HTML\]\s*([\s\S]*?)\s*\[\/BLOGGER_HTML\]/i);
  return {
    title: parseSection(raw, "FINAL_TITLE"),
    description: parseSection(raw, "META_DESCRIPTION"),
    slug: parseSection(raw, "SLUG"),
    labels: parseSection(raw, "LABELS"),
    html: (htmlMatch?.[1] || "").replace(/^```html\s*/i, "").replace(/```$/i, "").trim(),
  };
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
  return value
    .filter((row): row is ScheduleRow => !!row && typeof row === "object" && typeof (row as ScheduleRow).id === "string")
    .map(row => row.status === "발행 완료" && !isValidPublishedUrl(row.url || "")
      ? { ...row, status: "작성 중" as Status }
      : row);
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
    const alt = escapeHtmlAttr(`${row.title || "AI Price Atlas"} — ${slot.label}`);
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
  const localWriteReady = useRef(false);
  const preferCloudOnConnect = useRef(false);
  const today = todayLocal();

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

  const counts = useMemo(() => ({
    total: rows.length,
    planned: rows.filter(r => r.status === "예정").length,
    writing: rows.filter(r => r.status === "작성 중").length,
    done: rows.filter(r => r.status === "발행 완료").length,
  }), [rows]);
  const selected = rows.find(row => row.id === selectedId) || rows[0];
  const articlePrompt = selected ? buildArticlePrompt(selected, rows) : "";
  const selectedPlannedUrl = selected ? plannedUrl(selected) : "";
  const selectedResolvedUrl = selected ? resolvedUrl(selected) : "";
  const selectedRelated = selected ? relatedRows(selected, rows) : [];
  const selectedReverse = selected ? reverseLinkRows(selected, rows) : [];
  const selectedReverseLive = selectedReverse.filter(item => isValidPublishedUrl(item.url));
  const selectedBacklinkDone = selected?.backlinkDoneIds || [];
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
  const bloggerOutput = useMemo(() => parseBloggerOutput(selected?.body || ""), [selected?.body]);
  const finalBloggerHtml = selected ? replaceImagePlaceholders(bloggerOutput.html, selected) : bloggerOutput.html;
  const imageReadyCount = selected ? IMAGE_SLOTS.filter(slot => extractImageUrl(selected.imageUrls?.[slot.id] || "")).length : 0;
  const selectedImageBytes = selected ? Object.values(selected.imageMeta || {}).reduce((sum, meta) => sum + (meta.optimizedBytes || 0), 0) : 0;

  async function saveCloudSchedule(key: string, payload: ScheduleRow[], showNotice = true) {
    if (!key || key.length < 20) return;
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
    if (key.length < 20) {
      setNotice("⚠️ 동기화 코드는 20자 이상이어야 합니다.");
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
    setNotice("✅ 실제 발행 URL 확인 완료 · 이 글을 LIVE로 표시했습니다.");
    return true;
  }

  function changeStatus(row: ScheduleRow, nextStatus: Status) {
    if (nextStatus === "발행 완료") {
      completeRow(row);
      return;
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
    if (!finalBloggerHtml) {
      setCopyMessage("ChatGPT 완성본을 먼저 붙여넣어 주세요.");
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
    if (!finalBloggerHtml) {
      setCopyMessage("ChatGPT 완성본을 먼저 붙여넣어 주세요.");
      return;
    }
    await copyText(finalBloggerHtml, "✅ 이미지가 반영된 Blogger HTML 코드 복사 완료 · HTML 보기에서 붙여넣으세요.");
  }

  function addRow() {
    const lastDate = rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date : today;
    const date = nextDate(lastDate);
    setRows(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      title: "",
      keyword: "",
      status: "예정",
      url: "",
      slug: "",
      relatedIds: [],
      note: "",
      body: "",
    }]);
    setSelectedId(prev => prev || rows[0]?.id || "");
  }

  function addWeek() {
    let date = rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date : today;
    const extra: ScheduleRow[] = [];
    for (let i = 0; i < 7; i++) {
      date = nextDate(date);
      extra.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        date,
        title: "",
        keyword: "",
        status: "예정",
        url: "",
        slug: "",
        relatedIds: [],
        note: "",
        body: "",
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

  function resetRows() {
    if (!window.confirm("현재 스케줄을 지우고 기본 14일 스케줄로 되돌릴까요?")) return;
    setRows(DEFAULT_ROWS);
    setSelectedId(DEFAULT_ROWS[0].id);
    setNotice("");
    setCopyMessage("");
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => window.location.href = "/"}>← 콘텐츠 메이커</button>
        <div className={styles.saved}>자동 저장됨</div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Google Blog · AI Price Atlas</span>
          <h1>구글 블로그 글 스케줄</h1>
          <p>1일 1포스팅 기준으로 제목, 핵심 키워드, 진행 상태와 발행 링크를 한곳에서 관리합니다.</p>
        </div>
        <div className={styles.heroDate}>오늘 {dayLabel(today)}</div>
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
            <h2>발행 일정표</h2>
            <p>기본안은 2026년 9월 29일부터 14일치입니다. 셀을 클릭해 바로 수정할 수 있습니다.</p>
          </div>
          <div className={styles.actions}>
            <button onClick={addRow}>+ 하루 추가</button>
            <button onClick={addWeek}>+ 7일 추가</button>
            <button className={styles.reset} onClick={resetRows}>기본안 복원</button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>상태</th>
                <th>글 제목</th>
                <th>핵심 키워드</th>
                <th>검증</th>
                <th>URL</th>
                <th>작업</th>
                <th aria-label="삭제"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isToday = row.date === today;
                return (
                  <tr key={row.id} className={`${isToday ? styles.todayRow : ""} ${row.id === selectedId ? styles.selectedRow : ""}`}>
                    <td className={styles.dateCell}>
                      <input type="date" value={row.date} onChange={e => updateRow(row.id, { date: e.target.value })} />
                      <small>{dayLabel(row.date)}{isToday ? " · 오늘" : ""}</small>
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
                      <span className={verificationResolvedCount(row) === 6 ? styles.miniGood : styles.miniWait}>
                        {verificationResolvedCount(row)}/6
                      </span>
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
          <span>일정표에서는 핵심 상태만 확인하고, 상세 URL·검증·SEO·내부링크 관리는 아래 선택 글 작업 영역에서 진행합니다.</span>
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
              <span className={selectedVerificationResolved === 6 ? styles.healthGood : styles.healthWait}>검증 {selectedVerificationResolved}/6</span>
              <span className={duplicateCount ? styles.healthDanger : styles.healthGood}>{duplicateCount ? `중복 ${duplicateCount}` : "SEO OK"}</span>
              <span className={selectedUrlValid ? styles.healthGood : styles.healthNeutral}>{selectedUrlValid ? "LIVE" : "URL 대기"}</span>
              {selectedBacklinkRemaining > 0 && <span className={styles.healthWait}>역링크 {selectedBacklinkRemaining}</span>}
            </div>
          </div>

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
          <details className={styles.toolDetails}>
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
          </details>

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

          <div className={styles.sectionDivider}>
            <div><span>CREATE</span><b>콘텐츠 만들기</b></div>
            <small>관리 도구는 필요할 때만 열고, 아래에서 본문과 이미지를 제작하세요.</small>
          </div>

          <div className={styles.workflowGrid}>
            <section className={styles.requestCard}>
              <span className={styles.stepNo}>01</span>
              <h3>본문 요청서</h3>
              <p>최신 가격을 웹에서 검증하고 SEO 제목·검색 설명·슬러그·라벨·Blogger HTML까지 한 번에 받습니다.</p>
              <div className={styles.requestActions}>
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
              </div>
              <details className={styles.promptDetails}>
                <summary>본문 요청서 확인</summary>
                <textarea readOnly value={articlePrompt} />
              </details>
            </section>

            <section className={styles.requestCard}>
              <span className={styles.stepNo}>02</span>
              <h3>이미지 요청서 6장</h3>
              <p>대표 이미지부터 가격·결제·비교·요약까지 슬롯별로 ChatGPT 새 창에 바로 전달합니다.</p>
              <div className={styles.imagePromptGrid}>
                {IMAGE_SLOTS.map(slot => {
                  const prompt = buildImagePrompt(selected, slot);
                  const chatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
                  return (
                    <div key={slot.id} className={styles.imagePromptItem}>
                      <div><b>{slot.id} · {slot.label}</b><small>{slot.role}</small></div>
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
                disabled={!selected.body?.trim()}
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
                      <div><b>{slot.id} · {slot.label}</b><small>{slot.role}</small></div>
                      <span>{uploading ? "업로드 중" : src ? "✓ 완료" : "대기"}</span>
                    </div>

                    {src ? (
                      <div className={styles.uploadPreview}>
                        <img src={src} alt={`${selected.title} — ${slot.label}`} />
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
                <h3>Blogger 바로 업로드 서식</h3>
                <p>제목·검색 설명·슬러그·라벨을 복사하고, 입력한 이미지 URL이 반영된 최종 본문을 Blogger에 붙여넣으세요.</p>
              </div>
              <a className={styles.bloggerOpen} href="https://www.blogger.com/" target="_blank" rel="noopener noreferrer">Blogger 열기 ↗</a>
            </div>

            <div className={styles.metaGrid}>
              <div><span>최종 제목</span><b>{bloggerOutput.title || "완성본을 붙여넣으면 표시됩니다."}</b><button disabled={!bloggerOutput.title} onClick={() => void copyText(bloggerOutput.title, "최종 제목을 복사했습니다.")}>복사</button></div>
              <div><span>검색 설명</span><b>{bloggerOutput.description || "META_DESCRIPTION"}</b><button disabled={!bloggerOutput.description} onClick={() => void copyText(bloggerOutput.description, "검색 설명을 복사했습니다.")}>복사</button></div>
              <div><span>슬러그</span><b>{bloggerOutput.slug || "SLUG"}</b><button disabled={!bloggerOutput.slug} onClick={() => void copyText(bloggerOutput.slug, "슬러그를 복사했습니다.")}>복사</button></div>
              <div><span>라벨</span><b>{bloggerOutput.labels || "LABELS"}</b><button disabled={!bloggerOutput.labels} onClick={() => void copyText(bloggerOutput.labels, "라벨을 복사했습니다.")}>복사</button></div>
            </div>

            <div className={styles.bloggerActions}>
              <button className={styles.bloggerPrimary} disabled={!finalBloggerHtml} onClick={() => void copyBloggerRich()}>이미지 포함 전체복사</button>
              <button disabled={!finalBloggerHtml} onClick={() => void copyHtmlCode()}>이미지 포함 HTML 복사</button>
              <span>이미지 {imageReadyCount}/6 연결 · URL이 없는 슬롯은 자리표시자가 그대로 남습니다.</span>
            </div>
            {copyMessage && <div className={styles.copyMessage}>{copyMessage}</div>}

            <div className={styles.previewPane}>
              <div className={styles.previewHead}><b>Blogger 최종 미리보기</b><span>{finalBloggerHtml ? `이미지 ${imageReadyCount}/6 반영` : "완성본 대기"}</span></div>
              {finalBloggerHtml ? (
                <iframe
                  title="Blogger preview"
                  sandbox=""
                  className={styles.previewFrame}
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#202124;line-height:1.7;padding:24px;max-width:860px;margin:auto}h2{font-size:26px;margin-top:34px}h3{font-size:21px;margin-top:28px}p{font-size:17px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:10px;text-align:left}a{color:#1769aa}img{max-width:100%}</style></head><body>${finalBloggerHtml}</body></html>`}
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
