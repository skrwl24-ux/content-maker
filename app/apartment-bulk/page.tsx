"use client";

import { ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";
import Top3Workspace from "./Top3Workspace";
import SchoolDistrictWorkspace from "./SchoolDistrictWorkspace";
import MegaComplexWorkspace from "./MegaComplexWorkspace";
import { Top3Work, emptyTop3, normalizeTop3 } from "./top3-model";
import { parseApartmentStoryResearch, makeApartmentStoryResearchPrompt } from "../../lib/apartment-story.mjs";
import type { ApartmentStoryCandidate } from "../../lib/apartment-story.mjs";

type ThumbnailTone = "auto" | "standard" | "hook" | "humor";
type ArticleThemeId = "price" | "band" | "trade" | "mixed" | "rebound" | "volatility" | "highlow" | "stable";
type ArticleThemeMode = "auto" | ArticleThemeId;
type ArticleThemeChoice = {
  id: ArticleThemeId;
  label: string;
  angle: string;
  score: number;
};

type DailyContentType = "bulk" | "top3" | "tip" | "moving" | "compare" | "power";
type WorkImageSlot = "00" | "01" | "02";
type ContentMode = "bulk" | "school" | "mega";
type WorkProgress = "not_started" | "preparing" | "drafting" | "images" | "review";
type WorkAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};
type DailySlot = {
  id: number;
  type: DailyContentType;
  done: boolean;
  workId: string;
  topic?: string;
  complexId?: string;
  complexName?: string;
  candidateRegion?: string;
  candidateRegionGroup?: string;
  candidateArea?: string;
  candidateAngle?: string;
};

type DailyApartmentCandidate = {
  id: string;
  name: string;
  regionCode: string;
  regionLabel: string;
  regionGroup: string;
  representativeArea: string | null;
  recent30Count: number;
  sixMonthCount: number;
  daysSinceLastTrade: number | null;
  priceChangePct: number | null;
  marketSignalCount: number;
  recommendedAngle: string;
  status: string;
};

type PublishHistoryFilter = "all" | "bulk" | "top3" | "tip" | "power";
type PublishHistoryItem = {
  item_type: "topic" | "complex";
  normalized_key: string;
  title: string;
  content_type: string | null;
  complex_id: string | null;
  complex_name: string | null;
  published_on: string;
};
type StoryWork = {
  identity: string;
  raw: string;
  candidates: ApartmentStoryCandidate[];
  selectedId: string;
  sourceChecked: boolean;
};

type DailyWorkSnapshot = {
  top3?: Top3Work;
  workId: string;
  dateKey: string;
  slotId: number;
  contentType: DailyContentType;
  topic: string;
  materials: string;
  body: string;
  imageNotes: string;
  attachments: WorkAttachment[];
  progress: WorkProgress;
  updatedAt: string;
  bulk?: {
    data: ApartmentData;
    monthlyStats: MonthlyStat[];
    mapDataUrl: string;
    aptPoint: Point;
    stationPoint: Point;
    outputs: Outputs | null;
    selectedComplexName: string;
    recommendedAngle: string;
    articleThemeMode: ArticleThemeMode;
    autoMapGenerated: boolean;
    autoMapMessage: string;
    nearbyMessage: string;
    story?: StoryWork;
  };
};

type ApartmentData = {
  name: string;
  region: string;
  area: string;
  recentPrice: string;
  previousPrice: string;
  households: string;
  moveIn: string;
  station: string;
  locationLine: string;
  question: string;
  thumbnailTone: ThumbnailTone;
};

type Point = { x: number; y: number } | null;
type OutputKey = "price" | "map";
type Outputs = Record<OutputKey, string>;
type MonthlyStat = { month: string; medianPrice: number | null; tradeCount: number };
type NaverBlock = {
  type: "title" | "subheading" | "body" | "image" | "tags" | "card";
  text: string;
};
type MarkdownTable = {
  heading: string;
  headers: string[];
  rows: string[][];
};
type TableHandlingMode = "image" | "card" | "original";
type PhotoCandidate = {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  imageToken: string;
  thumbnailToken: string;
};

type ComplexDetailResponse = {
  complex: {
    id: string;
    name: string;
    sido?: string | null;
    sigungu?: string | null;
    legal_dong?: string | null;
    households?: number | null;
    use_date?: string | null;
  };
  representativeArea: string | null;
  monthly: MonthlyStat[];
  latestTrade: { date: string; price: number; area: number; floor: number | null } | null;
  snapshot?: {
    first_median_price?: number | string | null;
    latest_median_price?: number | string | null;
    recommended_angle?: string | null;
  } | null;
};

const SAMPLE: ApartmentData = {
  name: "산본 퇴계아파트",
  region: "경기 군포시 금정동",
  area: "전용 42㎡",
  recentPrice: "3억 5,000만원",
  previousPrice: "직전 3억 3,000만원",
  households: "1,992세대",
  moveIn: "1993년 6월",
  station: "수리산역",
  locationLine: "수리산역·학교·공원을 가까이 누리는 생활권",
  question: "",
  thumbnailTone: "auto",
};

const DAILY_TYPE_META: Record<DailyContentType, { label: string; short: string }> = {
  bulk: { label: "아파트 대량발행", short: "단지" },
  top3: { label: "지역 TOP3", short: "TOP3" },
  tip: { label: "검색형 콘텐츠", short: "검색형" },
  moving: { label: "이사 체크리스트", short: "이사체크" },
  compare: { label: "지역·단지 비교글", short: "비교글" },
  power: { label: "파워글 · 주력 콘텐츠", short: "파워글" },
};

const DEFAULT_DAILY_SLOTS: DailySlot[] = [
  { id: 1, type: "bulk", done: false, workId: "" },
  { id: 2, type: "bulk", done: false, workId: "" },
  { id: 3, type: "bulk", done: false, workId: "" },
  { id: 4, type: "top3", done: false, workId: "" },
  { id: 5, type: "bulk", done: false, workId: "" },
  { id: 6, type: "tip", done: false, workId: "" },
  { id: 7, type: "power", done: false, workId: "" },
];

type DailyTopicPlan = Partial<Record<number, { type: DailyContentType; topic: string }>>;

const DAILY_TOPIC_PLANS: Record<string, DailyTopicPlan> = {
  "2026-09-30": {
    4: { type: "tip", topic: "2026년 10월 공모주 일정 총정리｜청약일·상장일 한눈에 보기" },
    6: { type: "tip", topic: "금시세 왜 움직일까? 달러와 금리가 금값에 미치는 영향" },
    7: { type: "power", topic: "엔화 환율 왜 다시 움직이나? 일본 금리와 달러로 보는 엔화 흐름" },
  },
};

const DAILY_TOPIC_POOLS: Partial<Record<DailyContentType, string[]>> = {
  top3: [
    "의왕 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "시흥 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "평택 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "오산 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "양주 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "의정부 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "인천 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "고양 덕양 아파트 어디가 많이 팔렸나? 최근 6개월 거래 TOP3",
    "노원 10억 이하 아파트 거래 활발 TOP3",
    "강동 15억 이하 아파트 거래 활발 TOP3",
  ],
  tip: [
    "채권 가격은 금리가 내리면 왜 오를까?",
    "금 ETF와 KRX 금시장은 뭐가 다를까?",
    "환헤지 ETF와 환노출 ETF, 환율 영향은 어떻게 다를까?",
    "배당락일에는 왜 주가가 내려갈까?",
    "미국채 10년물 금리와 기준금리는 왜 다르게 움직일까?",
    "달러예금과 달러 ETF는 뭐가 다를까?",
    "아파트 실거래가는 신고 후 언제 반영될까?",
    "전세가율은 어떻게 계산하고 어디에 써먹을까?",
    "LTV와 DSR은 뭐가 다를까? 주택대출 핵심 용어 정리",
    "아파트 관리비에서 장기수선충당금은 무엇일까?",
  ],
  power: [
    "미국채 10년물 금리가 오르면 성장주는 왜 흔들릴까?",
    "원달러 환율과 외국인 코스피 수급은 왜 같이 움직일까?",
    "한국은행과 연준의 금리차는 환율에 어떤 영향을 줄까?",
    "달러가 약해질 때 금과 신흥국 자산이 움직이는 이유",
    "유가 상승은 물가·금리·환율에 어떻게 번질까?",
    "미국 고용지표가 금리 기대와 주식시장을 움직이는 이유",
    "미국 CPI 발표에 주식·채권·환율이 동시에 반응하는 이유",
    "장단기 금리차는 경기 흐름을 어떻게 보여줄까?",
    "엔캐리 트레이드 청산이 글로벌 시장을 흔드는 과정",
  ],
};

const PUBLISHED_TOPIC_SEEDS = [
  "2026년 10월 공모주 일정 총정리｜청약일·상장일 한눈에 보기",
  "금시세 왜 움직일까? 달러와 금리가 금값에 미치는 영향",
  "엔화 환율 왜 다시 움직이나? 일본 금리와 달러로 보는 엔화 흐름",
  "수원 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "용인 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "성남 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "군포 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "광명 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "안양 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "김포 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
  "달러 환율은 왜 움직일까? 미국 금리와 원화의 관계",
  "미국 국채금리가 오르면 주식시장은 왜 흔들릴까?",
  "ETF와 펀드는 뭐가 다를까? 초보자가 알아야 할 차이",
  "전세가율이 높으면 집값에는 어떤 의미일까?",
  "실거래가와 호가는 왜 다를까?",
  "용적률과 건폐율, 아파트 볼 때 왜 중요할까?",
  "금리 인하가 시작되면 예금·채권·주식은 어떻게 달라질까?",
  "달러 강세가 이어질 때 한국 증시와 원화는 어떻게 움직일까?",
  "미국 기준금리 변화가 한국 집값과 환율에 미치는 영향",
  "미국 국채금리와 나스닥은 왜 반대로 움직일 때가 많을까?",
  "금·달러·채권이 동시에 움직일 때 돈은 어디로 가고 있을까?",
  "비트코인과 미국 유동성은 어떤 관계가 있을까?",
  "코스피 상승을 외국인 수급과 환율로 읽는 법",
  "남양주 아파트 어디가 많이 팔렸나? 최근 거래 TOP3",
];

const PUBLISHED_TOPIC_STORAGE_KEY = "apartment-bulk-published-topics-v1";
const PUBLISHED_COMPLEX_STORAGE_KEY = "apartment-bulk-published-complexes-v1";
const PUBLISH_QUEUE_STORAGE_KEY = "apartment-bulk-publish-queue-v2";
const PUBLISH_QUEUE_WORK_INDEX_KEY = "apartment-bulk-publish-queue-work-index-v2";
const PUBLISH_QUEUE_ACTIVE_WORK_KEY = "apartment-bulk-publish-queue-active-work-v2";
const APARTMENT_STORY_STORAGE_PREFIX = "apartment-bulk-story-v1:";
const PUBLISHED_COMPLEX_NAME_SEEDS = [
  "평촌어바인퍼스트",
  "산성역포레스티아",
  "광명소하휴먼시아6단지",
  "은계어반리더스",
  "e편한세상송도",
  "동탄2 디에트르 포레",
  "판교밸리 제일풍경채",
];

function normalizeTopicKey(topic: string) {
  return topic
    .toLowerCase()
    .replace(/\d{4}년|\d{1,2}월|\d{1,2}일/g, "")
    .replace(/[\s·｜|?？!！,.'\"“”‘’()\[\]{}:;~_-]/g, "");
}

function isPublishedTopic(topic: string, publishedTopics: string[]) {
  const key = normalizeTopicKey(topic);
  if (!key) return false;
  return [...PUBLISHED_TOPIC_SEEDS, ...publishedTopics].some((published) => normalizeTopicKey(published) === key);
}

function getStoredPublishedTopics() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PUBLISHED_TOPIC_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function syncPublishedHistoryRecord(
  itemType: "topic" | "complex",
  title: string,
  published: boolean,
  options: { contentType?: string; complexId?: string; complexName?: string } = {}
) {
  if (typeof window === "undefined" || !title.trim()) return;
  try {
    await fetch("/api/publish-history", {
      method: published ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemType,
        title: title.trim(),
        contentType: options.contentType || null,
        complexId: options.complexId || null,
        complexName: options.complexName || null,
        source: "apartment-bulk",
      }),
    });
  } catch {
    // 서버 동기화 실패 시에도 localStorage 이력으로 중복 방지는 계속 작동합니다.
  }
}

function savePublishedTopic(topic: string, published: boolean, contentType?: string) {
  if (typeof window === "undefined" || !topic.trim()) return;
  const current = getStoredPublishedTopics();
  const key = normalizeTopicKey(topic);
  const next = published
    ? Array.from(new Set([...current, topic.trim()]))
    : current.filter((item) => normalizeTopicKey(item) !== key);
  try {
    window.localStorage.setItem(PUBLISHED_TOPIC_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 발행 이력 저장 실패는 작업 진행을 막지 않습니다.
  }
  void syncPublishedHistoryRecord("topic", topic, published, { contentType });
}

function normalizeComplexName(name: string) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/아파트/g, "")
    .replace(/[\s·ㆍ.\-_,()[\]{}]/g, "")
    .trim();
}

function getStoredPublishedComplexes() {
  if (typeof window === "undefined") return [] as Array<{ id: string; name: string }>;
  try {
    const raw = window.localStorage.getItem(PUBLISHED_COMPLEX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is { id: string; name: string } => Boolean(item && typeof item.id === "string" && typeof item.name === "string"))
      : [];
  } catch {
    return [];
  }
}

function isPublishedComplex(candidate: DailyApartmentCandidate, published: Array<{ id: string; name: string }>) {
  const key = normalizeComplexName(candidate.name);
  return published.some((item) => item.id === candidate.id || normalizeComplexName(item.name) === key)
    || PUBLISHED_COMPLEX_NAME_SEEDS.some((name) => normalizeComplexName(name) === key);
}

function savePublishedComplex(id: string, name: string, published: boolean) {
  if (typeof window === "undefined" || !id || !name.trim()) return;
  const current = getStoredPublishedComplexes();
  const next = published
    ? [...current.filter((item) => item.id !== id), { id, name: name.trim() }]
    : current.filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(PUBLISHED_COMPLEX_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 단지 발행 이력 저장 실패는 작업 진행을 막지 않습니다.
  }
  void syncPublishedHistoryRecord("complex", name, published, {
    contentType: "bulk",
    complexId: id,
    complexName: name,
  });
}

function formatDailyApartmentTopic(candidate: DailyApartmentCandidate) {
  const area = candidate.representativeArea ? " " + candidate.representativeArea : "";
  return `${candidate.regionLabel} · ${candidate.name}${area} · ${candidate.recommendedAngle}`;
}


function dailyTopicSeed(dateKey: string, slotId: number) {
  return (dateKey + "-" + slotId).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getDailyTopicSuggestion(
  type: DailyContentType,
  dateKey: string,
  slotId: number,
  publishedTopics: string[] = [],
  excludedTopics: string[] = []
) {
  const pool = DAILY_TOPIC_POOLS[type] || [];
  if (!pool.length) return "";
  const excludedKeys = new Set(excludedTopics.map(normalizeTopicKey));
  const available = pool.filter((topic) => !isPublishedTopic(topic, publishedTopics) && !excludedKeys.has(normalizeTopicKey(topic)));
  if (!available.length) return "";
  return available[dailyTopicSeed(dateKey, slotId) % available.length];
}

const WORK_IMAGE_META: Record<WorkImageSlot, { label: string; role: string; width: number; height: number }> = {
  "00": { label: "썸네일", role: "대표 썸네일", width: 1254, height: 1254 },
  "01": { label: "핵심 정보", role: "본문 핵심 정보 이미지", width: 1600, height: 900 },
  "02": { label: "원인·흐름", role: "본문 원인·비교 이미지", width: 1600, height: 900 },
};

const WORK_DB_NAME = "jibssuk-apartment-work-v1";
const WORK_STORE_NAME = "dailyWorks";

function createWorkId(dateKey: string, slotId: number) {
  const compact = dateKey.replace(/-/g, "");
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `jibssuk-${compact}-${String(slotId).padStart(2, "0")}-${suffix}`;
}

function makeDailySlots(dateKey: string, publishedTopics: string[] = []) {
  const plan = DAILY_TOPIC_PLANS[dateKey] || {};
  const picked: string[] = [];
  return DEFAULT_DAILY_SLOTS.map((slot) => {
    const planned = plan[slot.id];
    const type = planned?.type || slot.type;
    const plannedTopic = planned?.topic && !isPublishedTopic(planned.topic, publishedTopics) ? planned.topic : "";
    const topic = plannedTopic || getDailyTopicSuggestion(type, dateKey, slot.id, publishedTopics, picked);
    if (topic) picked.push(topic);
    return {
      ...slot,
      type,
      topic,
      workId: createWorkId(dateKey, slot.id),
    };
  });
}

function makeSavedWorkPrompt(contentType: DailyContentType | null, topic: string, materials: string, dateKey: string) {
  const safeTopic = topic.trim() || "작업 주제 미정";
  const typeLabel = contentType ? DAILY_TYPE_META[contentType].label : "블로그 콘텐츠";
  const financeTopic = /(공모주|금시세|금값|엔화|환율|ISA|적금|주식|ETF|채권|비트코인|코인|달러|금리)/.test(safeTopic);

  let topicGuide = "";
  if (safeTopic.includes("공모주")) {
    topicGuide = `
[주제별 검증 포인트]
- 2026년 10월 국내 공모주 청약 일정을 최신 기준으로 확인할 것.
- 청약일, 상장 예정일, 주관사 등 일정 정보는 거래소·DART·증권사 등 신뢰 가능한 출처와 교차 확인할 것.
- 일정은 변경될 수 있으므로 확정/예정 여부를 구분하고, 확인되지 않은 종목이나 날짜를 만들지 말 것.
- 종목 추천이나 청약 권유보다 '언제 무엇을 확인해야 하는지' 중심의 일정형 정보글로 구성할 것.`;
  } else if (safeTopic.includes("금시세") || safeTopic.includes("금값")) {
    topicGuide = `
[주제별 검증 포인트]
- 국제 금 가격, 국내 원화 기준 금값, KRX 금시장 가격을 같은 숫자처럼 섞지 말 것.
- 달러 가치, 미국 실질금리·국채금리, 중앙은행 수요, 위험회피 심리, 원/달러 환율을 금 가격의 주요 변수로 구분해 설명할 것.
- 최신 가격을 언급하면 기준 시각·시장·단위를 함께 표시할 것.
- 최근 1년 흐름을 보여줄 수 있는 신뢰 가능한 월별 자료가 확보되면 국제 금 가격(USD/트로이온스) 기준의 시세표를 별도 소제목 아래 포함할 것.
- 1년 시세표는 월별 대표값의 기준을 통일하고, 확인되지 않은 월을 임의 보간하거나 추정해서 채우지 말 것.
- 단기 등락 원인을 하나로 단정하지 말고 확인 가능한 배경을 여러 변수로 나눠 설명할 것.`;
  } else if (safeTopic.includes("엔화") || safeTopic.includes("환율")) {
    topicGuide = `
[주제별 검증 포인트]
- 달러/엔(USD/JPY)과 원/엔(KRW/JPY 또는 100엔당 원화)을 혼동하지 말 것.
- 일본은행 정책금리·발언, 미국 연준과 미일 금리차, 달러 흐름, 원화 움직임을 나눠 설명할 것.
- 환율 숫자를 제시할 때 기준 시각과 통화쌍을 분명히 표시할 것.
- 최근 1년 흐름을 보여줄 수 있는 신뢰 가능한 월별 자료가 확보되면 통화쌍과 단위를 통일한 시세표를 별도 소제목 아래 포함할 것.
- 1년 시세표는 확인되지 않은 월을 임의 보간하거나 추정해서 채우지 말 것.
- '엔화가 오른 이유'를 단일 원인으로 확정하지 말고 최신 정책·시장 자료와 함께 설명할 것.`;
  } else if (financeTopic) {
    topicGuide = `
[재테크 글 추가 원칙]
- 가격·금리·환율·지수는 작성 기준일의 최신 수치를 확인하고 기준 시각과 단위를 명확히 할 것.
- 단순 시세 나열보다 '왜 움직였는가'를 독자가 이해하도록 원인과 연결 구조를 설명할 것.
- 매수·매도·가입을 권유하거나 수익을 확정적으로 표현하지 말 것.`;
  }

  return `재테크·생활정보 네이버 블로그용 글을 최종 발행본으로 작성해줘.

[작성 기준일]
${dateKey || "작성일 기준 최신"}

[콘텐츠 유형]
${typeLabel}

[주제]
${safeTopic}

[운영자 메모]
${materials.trim() || "별도 메모 없음"}

[가장 중요한 작업 방식]
- 먼저 웹 검색으로 최신 사실을 확인한 뒤 작성할 것.
- 현재 가격·일정·정책·금리처럼 바뀔 수 있는 내용은 작성 기준일과 맞는 최신 자료를 우선할 것.
- 정부기관, 거래소, 중앙은행, 공시, 공식 증권사 자료 등 1차 출처를 우선하고 보조 출처로 교차 확인할 것.
- 숫자, 날짜, 비율, 일정은 임의로 만들지 말 것.
- 확인되지 않은 원인은 사실처럼 단정하지 말고 '배경 중 하나', '함께 볼 변수'처럼 구분할 것.
- 검색 결과를 그대로 베끼지 말고 한국 독자가 이해하기 쉬운 말로 재구성할 것.
- 투자 권유가 아니라 정보 제공과 흐름 설명을 목적으로 작성할 것.
${topicGuide}

[글 방향]
- 단순히 '얼마다'를 나열하기보다 '왜 움직이는가 / 무엇을 확인해야 하는가'를 중심으로 설명할 것.
- 초보 투자자도 이해할 수 있게 전문 용어는 바로 풀어서 설명할 것.
- 첫 3문장 안에 이 글에서 얻을 핵심 답을 먼저 보여줄 것.
- 제목 후보는 내부적으로 5개 정도 비교한 뒤 최종 제목 1개만 출력할 것.
- 제목에는 핵심 검색어를 자연스럽게 앞쪽에 배치하고 과장형 낚시 표현은 피할 것.
- 소제목 4~6개 정도로 구성하고 모바일에서 읽기 좋게 짧은 문단으로 작성할 것.
- 핵심 숫자나 일정이 여러 개면 마크다운 표를 우선 활용하되, 검증된 값만 사용할 것.
- 표를 사용할 때는 첫 행을 항목명 헤더로 만들고 표 바로 위에 내용을 설명하는 소제목을 둘 것. 콘텐츠메이커가 이 표를 자동 감지해 이미지 요청서로 활용한다.
- 글 마지막에는 앞으로 확인할 변수 2~4개와 핵심 요약 3줄을 넣을 것.
- 네이버 태그는 핵심 검색어 중심으로 8~12개를 마지막 한 줄에 작성할 것.

[이미지 기획]
본문 마지막에 이미지 제작 메모도 함께 정리할 것.
- 이미지 00 · 썸네일: 모바일 목록에서 주제를 1초 안에 이해할 수 있는 짧은 후킹 문구
- 이미지 01 · 핵심 정보: 일정·가격·환율·구조 중 가장 중요한 내용을 한눈에 보여주는 16:9 이미지
- 이미지 02 · 원인·흐름: 가격이나 환율이 움직이는 연결 구조 또는 비교를 보여주는 16:9 이미지
- 실제 이미지 생성 프롬프트는 길게 쓰지 말고 각 이미지가 무엇을 보여줄지 1~2문장 기획 메모만 작성할 것.

[최종 출력 순서]
1. 최종 제목
2. 네이버 발행용 본문
3. 태그
4. 이미지 00~02 기획 메모
5. 검수 메모: 사용한 주요 출처와 확인 기준일을 짧게 정리

중요: 일반 상식만으로 작성하지 말고 반드시 최신 웹 검색과 사실 검증을 거쳐 완성해줘.`;
}

function compactArticleForImagePrompt(body: string) {
  const text = body.trim();
  if (text.length <= 9000) return text;
  return text.slice(0, 6500) + "\n\n[중간 일부 생략]\n\n" + text.slice(-2500);
}

function makeSavedWorkImagePrompt(slot: WorkImageSlot, topic: string, body: string, imageNotes: string) {
  const meta = WORK_IMAGE_META[slot];
  const safeTopic = topic.trim() || "블로그 글";
  const article = compactArticleForImagePrompt(body);
  const ratio = meta.width === meta.height ? "1:1 정사각형" : "16:9 가로형";
  const tables = extractMarkdownTables(body);
  const timeSeriesTable = tables.find(isTimeSeriesTable);

  if (slot === "01" && timeSeriesTable) {
    return makeTimeSeriesChartPrompt(safeTopic, timeSeriesTable, imageNotes);
  }

  if (slot === "01" && tables.length > 0) {
    return makeTableImagePrompt(safeTopic, tables[0], imageNotes);
  }

  const slotGuide = slot === "00"
    ? `[썸네일 구성]
- 본문 전체를 대표하는 장면 1개를 중심으로 구성
- 모바일 목록에서도 바로 이해되는 짧은 한글 후킹 문구 1~2줄
- 본문 제목 전체를 길게 반복하지 말고 핵심 검색어와 궁금증만 남길 것
- 숫자·날짜를 넣는다면 아래 본문에서 명확히 확인된 값만 사용할 것`
    : slot === "01"
      ? `[핵심 정보 이미지 구성]
- 본문에서 독자가 가장 먼저 기억해야 할 핵심 정보 하나를 시각화
- 일정 글이면 달력·타임라인, 가격 글이면 핵심 숫자·시장 구분, 환율 글이면 통화쌍·주요 변수처럼 주제에 맞는 구조를 선택
- 짧은 라벨 2~5개는 허용하되 긴 설명문은 넣지 말 것
- 본문에 없는 숫자나 날짜를 새로 만들지 말 것`
      : `[원인·흐름 이미지 구성]
- 본문이 설명하는 원인→과정→결과 또는 변수 간 관계를 한눈에 보여줄 것
- 필요하면 화살표, 단계, 간단한 비교 카드 2~4개를 사용
- 인과관계가 확정되지 않은 내용은 단정적인 화살표 대신 '영향 요인', '함께 보는 변수'처럼 표현
- 본문에서 확인되지 않은 수치·예측·투자 결론은 추가하지 말 것`;

  return `네이버 블로그용 이미지를 1장 만들어줘.

[글 주제]
${safeTopic}

[이미지 역할]
슬롯 ${slot} · ${meta.label}
역할: ${meta.role}

[제작 크기]
${meta.width}×${meta.height}px
${ratio}

[가장 중요한 기준]
- 아래에 붙여넣은 완성 글의 내용만 근거로 이미지를 구성할 것.
- 본문에 없는 숫자, 일정, 정책, 가격, 전망을 새로 만들지 말 것.
- 재테크 주제는 매수·매도·청약을 권유하는 광고처럼 보이지 않게 정보형으로 제작할 것.
- 모바일에서도 핵심이 바로 보이도록 단순하고 선명하게 구성할 것.
- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게 만들 것.
- 과도한 AI 느낌, 네온, 유리질감, 복잡한 3D 효과, 작은 글자를 빽빽하게 채운 구성은 피할 것.
- 색상은 2~3개 중심으로 절제하고 카드·도표·아이콘은 꼭 필요한 만큼만 사용할 것.
- 워터마크와 타사 로고는 넣지 말 것.
- 여러 이미지를 콜라주로 합치지 말고 한 장의 완성 이미지로 만들 것.
- 한글 문구는 오탈자 없이 표시할 것.

${slotGuide}

[운영자 이미지 메모]
${imageNotes.trim() || "별도 메모 없음"}

[완성 글]
${article || "본문이 아직 입력되지 않았습니다."}

중요: 위 글을 바탕으로 설명문을 답하지 말고, 바로 이미지 1장을 제작해줘.`;
}

function openWorkDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORK_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORK_STORE_NAME)) {
        db.createObjectStore(WORK_STORE_NAME, { keyPath: "workId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("작업 저장소를 열지 못했습니다."));
  });
}

async function readWorkSnapshot(workId: string): Promise<DailyWorkSnapshot | null> {
  const db = await openWorkDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORK_STORE_NAME, "readonly");
    const request = tx.objectStore(WORK_STORE_NAME).get(workId);
    request.onsuccess = () => resolve((request.result as DailyWorkSnapshot | undefined) || null);
    request.onerror = () => reject(request.error || new Error("작업을 불러오지 못했습니다."));
    tx.oncomplete = () => db.close();
  });
}

async function writeWorkSnapshot(snapshot: DailyWorkSnapshot) {
  const db = await openWorkDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORK_STORE_NAME, "readwrite");
    tx.objectStore(WORK_STORE_NAME).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("작업을 저장하지 못했습니다."));
    };
  });
}

const FONT = 'Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasUrl(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.");
  ctx.textBaseline = "top";
  draw(ctx);
  return canvas.toDataURL("image/png");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number, weight = 800) {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = [...text.trim()];
  let line = "";
  const lines: string[] = [];
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + lineHeight * index));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function dataUrlBase64(dataUrl: string) {
  return dataUrl.split(",")[1] || "";
}

function cleanNaverLine(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .replace(/^__(.*?)__$/, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\\#/g, "#")
    .trim();
}

function splitMarkdownTableRow(line: string) {
  let value = line.trim();
  if (!value.includes("|")) return [];
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cleanNaverLine(cell.trim()));
}

function isMarkdownTableDivider(line: string) {
  const cells = splitMarkdownTableRow(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function extractMarkdownTables(raw: string): MarkdownTable[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const tables: MarkdownTable[] = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    const headers = splitMarkdownTableRow(lines[i]);
    if (headers.length < 2 || !isMarkdownTableDivider(lines[i + 1])) continue;

    let heading = "";
    for (let h = i - 1; h >= 0; h -= 1) {
      const candidate = cleanNaverLine(lines[h]);
      if (!candidate) continue;
      heading = candidate;
      break;
    }

    const rows: string[][] = [];
    i += 2;
    while (i < lines.length) {
      const row = splitMarkdownTableRow(lines[i]);
      if (row.length < 2 || isMarkdownTableDivider(lines[i])) {
        i -= 1;
        break;
      }
      rows.push(row);
      i += 1;
    }

    tables.push({ heading, headers, rows });
    if (i >= lines.length) break;
  }

  return tables;
}

function countMarkdownTables(raw: string) {
  return extractMarkdownTables(raw).length;
}

function markdownTableToText(table: MarkdownTable) {
  return [
    `| ${table.headers.join(" | ")} |`,
    `| ${table.headers.map(() => "---").join(" | ")} |`,
    ...table.rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function isTimeSeriesTable(table: MarkdownTable) {
  if (table.rows.length < 4) return false;

  const heading = table.heading.replace(/\s+/g, " ").trim();
  const headers = table.headers.join(" ");
  const combined = `${heading} ${headers}`;

  const timeSeriesHeading = /(최근\s*(?:1년|12개월|6개월)|1년\s*(?:시세|가격|환율|흐름|추이)|12개월\s*(?:시세|가격|환율|흐름|추이)|월별\s*(?:시세|가격|환율|흐름|추이)|시세\s*(?:흐름|추이)|가격\s*(?:흐름|추이)|환율\s*(?:흐름|추이)|지수\s*(?:흐름|추이)|연간\s*(?:흐름|추이)|price\s*trend|exchange\s*rate\s*trend)/i.test(heading);
  const hasTimeAxis = /(시점|날짜|일자|월|월말|기간|연도|년월|date|month|period)/i.test(headers);
  const hasMarketValue = /(가격|금값|금시세|시세|환율|지수|종가|대표값|금액|수치|price|rate|index|close)/i.test(headers);
  const looksLikeSchedule = /(일정|청약|상장|공모|예정|주관사|발표일|배당일|실적\s*발표)/i.test(combined);

  return timeSeriesHeading && hasTimeAxis && hasMarketValue && !looksLikeSchedule;
}

function makeTableImagePrompt(topic: string, table: MarkdownTable, imageNotes: string) {
  const safeTopic = topic.trim() || table.heading || "블로그 글";
  const tableTitle = table.heading || safeTopic;
  const rowCount = table.rows.length;
  const layoutGuide = rowCount >= 14
    ? "- 행이 많으므로 한 장 안에서 좌우 2단 또는 명확한 구획으로 나눠 글자 크기를 확보할 것."
    : rowCount >= 8
      ? "- 행 수가 많은 편이므로 여백을 줄이고 행 높이를 균일하게 잡아 모바일 가독성을 확보할 것."
      : "- 표 전체가 한눈에 들어오도록 단순한 단일 표 레이아웃을 우선할 것.";

  return `네이버 블로그용 표 이미지를 1장 만들어줘.

[글 주제]
${safeTopic}

[이미지 역할]
슬롯 01 · 핵심 정보
역할: 본문 표 데이터를 한눈에 보여주는 정보 이미지

[표 제목]
${tableTitle}

[제작 크기]
1600×900px
16:9 가로형

[가장 중요한 기준]
- 아래 표 데이터를 한 글자도 임의로 바꾸거나 새로 만들지 말 것.
- 숫자, 날짜, 종목명, 단지명, 가격, 주관사 등 표의 원문 정보를 그대로 사용할 것.
- 표의 행을 누락하지 말 것.
- 네이버 블로그 모바일에서도 읽을 수 있도록 글자 크기와 행 간격을 충분히 확보할 것.
- 광고 배너가 아니라 정보 정리 이미지처럼 자연스럽고 신뢰감 있게 제작할 것.
- 과도한 AI 느낌, 네온, 유리질감, 복잡한 3D 효과를 사용하지 말 것.
- 색상은 2~3개 중심으로 절제하고 헤더와 핵심 구간만 약하게 강조할 것.
- 워터마크와 타사 로고를 넣지 말 것.
- 여러 이미지를 콜라주로 합치지 말고 한 장의 완성 이미지로 만들 것.
${layoutGuide}

[운영자 이미지 메모]
${imageNotes.trim() || "별도 메모 없음"}

[반드시 포함할 표 데이터]
${markdownTableToText(table)}

중요: 설명문을 답하지 말고 위 표 데이터를 그대로 반영한 이미지 1장을 바로 제작해줘.`;
}

function makeTimeSeriesChartPrompt(topic: string, table: MarkdownTable, imageNotes: string) {
  const safeTopic = topic.trim() || table.heading || "블로그 글";
  const chartTitle = table.heading || "최근 시세 흐름";

  return `네이버 블로그용 시세 그래프 이미지를 1장 만들어줘.

[글 주제]
${safeTopic}

[이미지 역할]
슬롯 01 · 최근 시세 그래프
역할: 본문의 기간별 시세 데이터를 주식 시세 앱처럼 한눈에 보여주는 라인차트

[그래프 제목]
${chartTitle}

[제작 크기]
1600×900px
16:9 가로형

[가장 중요한 기준]
- 아래 표 데이터만 사용하고 숫자, 날짜, 단위, 월을 임의로 추가하거나 바꾸지 말 것.
- 가로축은 날짜·월·시점을 원문 순서 그대로 배치할 것.
- 가격·시세·환율·지수·종가·대표값처럼 주된 시장값 열을 하나의 시세선으로 연결할 것.
- 등락률, 비고, 흐름 같은 보조 열은 별도의 두 번째 선으로 만들지 말고 필요하면 작은 주석으로만 활용할 것.
- 값이 없는 기간을 임의로 보간하거나 추정해 연결하지 말 것.
- 시가·고가·저가·종가 4개가 모두 제공된 데이터가 아니라면 캔들차트를 만들지 말고 라인차트로 제작할 것.
- 증권앱의 1년 시세 차트처럼 깔끔하고 전문적인 금융 차트 느낌으로 구성할 것.
- 차트의 시장·단위가 모바일에서도 바로 보이도록 명확히 표시할 것.
- 매수·매도 신호, 목표가, 전망 화살표처럼 투자 권유로 보이는 요소는 넣지 말 것.
- 과도한 네온, 유리질감, 복잡한 3D 효과, 작은 글자 남발을 피할 것.
- 워터마크와 타사 로고를 넣지 말 것.

[운영자 이미지 메모]
${imageNotes.trim() || "별도 메모 없음"}

[반드시 반영할 시계열 데이터]
${markdownTableToText(table)}

중요: 설명문을 답하지 말고 위 데이터를 정확히 반영한 라인차트 이미지 1장을 바로 제작해줘.`;
}

function markdownTableSignature(table: MarkdownTable) {
  return [
    table.heading,
    table.headers.join("\u001f"),
    ...table.rows.map((row) => row.join("\u001f")),
  ].join("\u001e");
}

function makeTimeSeriesNaverLabel(table: MarkdownTable) {
  const heading = table.heading.trim() || "최근 시세";
  const title = /그래프/.test(heading) ? heading : `${heading} 그래프`;
  return `[이미지 01 · ${title}]`;
}

function makeMarkdownTableCard(headers: string[], row: string[]) {
  const preferred = /(종목|단지|기업|항목|이름|상품|지역|학교|주제|구분)/;
  const rankLike = /^(순위|랭킹|번호|no\.?|rank)$/i;
  let primaryIndex = headers.findIndex((header) => preferred.test(header));
  if (primaryIndex < 0) primaryIndex = rankLike.test(headers[0] || "") && row.length > 1 ? 1 : 0;

  const primaryValue = row[primaryIndex] || row.find(Boolean) || "항목";
  const prefix = primaryIndex > 0 && rankLike.test(headers[0] || "") && row[0]
    ? `${row[0]} · `
    : "";

  const details = headers
    .map((header, index) => ({ header, value: row[index] || "", index }))
    .filter((item) => item.index !== primaryIndex && item.value)
    .filter((item) => !(item.index === 0 && rankLike.test(item.header)))
    .map((item) => `${item.header || `항목 ${item.index + 1}`} ${item.value}`)
    .join(" · ");

  return details ? `${prefix}${primaryValue}\n${details}` : `${prefix}${primaryValue}`;
}

function parseNaverBlog(raw: string, tableMode: TableHandlingMode = "image"): NaverBlock[] {
  const sourceTables = extractMarkdownTables(raw);
  const primaryTimeSeriesTable = sourceTables.find(isTimeSeriesTable) || null;
  const primaryTimeSeriesSignature = primaryTimeSeriesTable
    ? markdownTableSignature(primaryTimeSeriesTable)
    : "";

  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line &&
      !/^:::writing\b/i.test(line) &&
      line !== ":::" &&
      !/^---option\b/i.test(line)
    );

  if (!lines.length) return [];

  const blocks: NaverBlock[] = [];
  let firstContent = true;
  let timeSeriesImageInserted = false;

  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];

    if (
      tableMode !== "original" &&
      index + 1 < lines.length &&
      splitMarkdownTableRow(original).length >= 2 &&
      isMarkdownTableDivider(lines[index + 1])
    ) {
      const headers = splitMarkdownTableRow(original);
      const tableHeading = (() => {
        for (let h = index - 1; h >= 0; h -= 1) {
          const candidate = cleanNaverLine(lines[h]);
          if (!candidate) continue;
          return candidate;
        }
        return "표 정보";
      })();

      index += 2;
      const rows: string[][] = [];
      while (index < lines.length) {
        const row = splitMarkdownTableRow(lines[index]);
        if (row.length < 2 || isMarkdownTableDivider(lines[index])) {
          index -= 1;
          break;
        }
        rows.push(row);
        index += 1;
      }

      const currentTable: MarkdownTable = { heading: tableHeading, headers, rows };

      if (tableMode === "image") {
        if (primaryTimeSeriesTable) {
          const isPrimaryTimeSeries =
            !timeSeriesImageInserted &&
            markdownTableSignature(currentTable) === primaryTimeSeriesSignature;

          if (isPrimaryTimeSeries) {
            blocks.push({ type: "image", text: makeTimeSeriesNaverLabel(currentTable) });
            timeSeriesImageInserted = true;
          } else {
            rows.forEach((row) => {
              blocks.push({ type: "card", text: makeMarkdownTableCard(headers, row) });
            });
          }
        } else {
          const priorTableImages = blocks.filter(
            (block) => block.type === "image" && /^\[이미지 01(?:-|\s|·)/.test(block.text)
          ).length;
          const slotLabel = priorTableImages === 0 ? "01" : `01-${priorTableImages + 1}`;
          blocks.push({ type: "image", text: `[이미지 ${slotLabel} · ${tableHeading}]` });
        }
      } else {
        rows.forEach((row) => {
          blocks.push({ type: "card", text: makeMarkdownTableCard(headers, row) });
        });
      }

      firstContent = false;
      if (index >= lines.length) break;
      continue;
    }

    const line = cleanNaverLine(original);
    if (!line) continue;

    if (firstContent) {
      blocks.push({ type: "title", text: line });
      firstContent = false;
      continue;
    }

    const hashtagCount = (line.match(/#[^\s#]+/g) || []).length;
    if (hashtagCount >= 2 && line.startsWith("#")) {
      blocks.push({ type: "tags", text: line });
      continue;
    }

    if (/^\[이미지\s*\d+/i.test(line)) {
      blocks.push({ type: "image", text: line });
      continue;
    }

    const markdownHeading = /^#{2,6}\s+/.test(original);
    const wholeBold = /^(\*\*|__)[\s\S]+\1$/.test(original);
    const emojiHeading = /^[🏠📊🚉🔎✅📌]/u.test(line) && line.length <= 40 && !/[.!?]$/.test(line);

    if (markdownHeading || wholeBold || emojiHeading) {
      blocks.push({ type: "subheading", text: line });
      continue;
    }

    blocks.push({ type: "body", text: line });
  }

  if (tableMode === "image" && primaryTimeSeriesTable) {
    const hasThumbnailSlot = blocks.some(
      (block) => block.type === "image" && /^\[이미지\s*00(?:\s|·|\])/i.test(block.text)
    );
    if (!hasThumbnailSlot) {
      const titleIndex = blocks.findIndex((block) => block.type === "title");
      if (titleIndex >= 0) {
        blocks.splice(titleIndex + 1, 0, { type: "image", text: "[이미지 00 · 썸네일]" });
      }
    }

    const hasFlowSlot = blocks.some(
      (block) => block.type === "image" && /^\[이미지\s*02(?:\s|·|\])/i.test(block.text)
    );
    if (!hasFlowSlot) {
      const chartIndex = blocks.findIndex(
        (block) => block.type === "image" && /^\[이미지\s*01(?:\s|·|\])/i.test(block.text)
      );
      if (chartIndex >= 0) {
        const nextSectionIndex = blocks.findIndex(
          (block, blockIndex) => blockIndex > chartIndex && block.type === "subheading"
        );
        const insertAt = nextSectionIndex >= 0 ? nextSectionIndex : chartIndex + 1;
        blocks.splice(insertAt, 0, { type: "image", text: "[이미지 02 · 원인·흐름]" });
      }
    }
  }

  return blocks;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function naverPlainText(blocks: NaverBlock[]) {
  return blocks.map((block, index) => {
    const next = blocks[index + 1];
    const separator = block.type === "card" && next?.type === "card" ? "\r\n" : "\r\n \r\n";
    return block.text + (index < blocks.length - 1 ? separator : "");
  }).join("");
}

function naverRichHtml(blocks: NaverBlock[]) {
  const font = "'Nanum Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif";
  const blockHtml = blocks.map((block) => {
    const safe = escapeHtml(block.text);
    if (block.type === "title") {
      return `<div style="font-family:${font};font-size:20pt;line-height:1.5;font-weight:700;margin:0;">${safe}</div>`;
    }
    if (block.type === "subheading") {
      return `<div style="font-family:${font};font-size:18pt;line-height:1.55;font-weight:700;margin:0;">${safe}</div>`;
    }
    if (block.type === "tags") {
      return `<div style="font-family:${font};font-size:13.5pt;line-height:1.6;font-weight:400;margin:0;">${safe}</div>`;
    }
    if (block.type === "image") {
      return `<div style="font-family:${font};font-size:15pt;line-height:1.6;font-weight:600;margin:0;">${safe}</div>`;
    }
    if (block.type === "card") {
      const [cardTitle, ...cardDetails] = safe.split("\n");
      const detailHtml = cardDetails.join("<br>");
      return `<div style="font-family:${font};font-size:15pt;line-height:1.65;font-weight:400;margin:0;padding:10px 12px;border-left:3px solid #8aa99d;"><div style="font-weight:700;margin:0 0 4px;">${cardTitle}</div>${detailHtml ? `<div>${detailHtml}</div>` : ""}</div>`;
    }
    return `<div style="font-family:${font};font-size:15pt;line-height:1.7;font-weight:400;margin:0;">${safe}</div>`;
  });

  const spacer = `<div style="font-family:${font};font-size:15pt;line-height:1.7;margin:0;"><br></div>`;
  const merged = blockHtml.map((html, index) => {
    const next = blocks[index + 1];
    const separator = blocks[index]?.type === "card" && next?.type === "card" ? "" : spacer;
    return html + (index < blockHtml.length - 1 ? separator : "");
  }).join("");
  return `<div>${merged}</div>`;
}

function drawBrand(ctx: CanvasRenderingContext2D, x: number, y: number, dark = false) {
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = dark ? "#0d1827" : "rgba(255,255,255,.94)";
  ctx.fillText("집값쓱", x, y);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = dark ? "#65748b" : "rgba(255,255,255,.62)";
  ctx.fillText("APARTMENT NOTE", x, y + 42);
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}


function buildThumbnailHook(monthlyStats: MonthlyStat[], fallback = "요즘 얼마에 거래될까?") {
  const monthly = monthlyStats.slice(-6);
  const valid = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last || !first.medianPrice) return fallback;

  const delta = last.medianPrice - first.medianPrice;
  const rate = (delta / first.medianPrice) * 100;
  const priceStrong = Math.abs(delta) >= 70000000 || Math.abs(rate) >= 8;
  const firstTrades = first.tradeCount ?? 0;
  const lastTrades = last.tradeCount ?? 0;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isCurrentMonthIncomplete = last.month === currentMonthKey && now.getDate() < lastDayOfMonth;
  const completedTradeLast = isCurrentMonthIncomplete && valid.length >= 2 ? valid[valid.length - 2] : last;
  const completedLastTrades = completedTradeLast?.tradeCount ?? 0;

  const tradeSurge = lastTrades >= 3 && (
    (firstTrades === 0 && lastTrades >= 3) ||
    (firstTrades > 0 && lastTrades >= firstTrades * 2 && lastTrades - firstTrades >= 2)
  );
  const tradeDrop = firstTrades >= 3 &&
    completedLastTrades <= Math.max(1, Math.floor(firstTrades / 2)) &&
    firstTrades - completedLastTrades >= 2;

  if (priceStrong && delta !== 0) {
    return delta > 0
      ? "6개월 새 00억 올랐다"
      : "6개월 새 00억 빠졌다";
  }
  if (tradeSurge) return "거래가 다시 몰렸다";
  if (tradeDrop) return "거래가 눈에 띄게 줄었다";
  return fallback;
}

const ARTICLE_THEME_META: Record<ArticleThemeId, { label: string; angle: string }> = {
  price: {
    label: "가격 변화",
    angle: "6개월 첫 대표값과 최근 대표값의 변화폭·변화율을 중심으로 보되 단순 숫자 나열은 피한다.",
  },
  band: {
    label: "가격대 전환",
    angle: "몇 억대에서 몇 억대로 가격대가 바뀌었는지와 그 과정의 월별 흐름을 중심으로 본다.",
  },
  trade: {
    label: "거래량 변화",
    angle: "거래가 유독 몰린 달·줄어든 달을 찾고 가격 흐름과 함께 해석한다. 거래량만으로 심리를 단정하지 않는다.",
  },
  mixed: {
    label: "가격·거래 엇갈림",
    angle: "가격 방향과 거래량 방향이 서로 다르게 움직였는지를 중심으로 본다.",
  },
  rebound: {
    label: "저점·고점·반등",
    angle: "6개월 중간 저점 또는 고점 이후 최근 대표값이 어디까지 회복·조정됐는지를 중심으로 본다.",
  },
  volatility: {
    label: "가격 변동성",
    angle: "월별 대표값의 고저 차이와 출렁임 자체를 핵심 장면으로 잡는다.",
  },
  highlow: {
    label: "6개월 고점·저점 위치",
    angle: "최근 대표값이 6개월 범위의 고점·저점 중 어디에 가까운지를 중심으로 본다.",
  },
  stable: {
    label: "보합·관망",
    angle: "큰 방향성보다 좁은 가격 범위와 거래량 변화를 중심으로 차분하게 본다.",
  },
};

function analyzeArticleThemes(monthlyStats: MonthlyStat[]): ArticleThemeChoice[] {
  const valid = monthlyStats.slice(-6).filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const baseScores: Record<ArticleThemeId, number> = {
    price: 25,
    band: 5,
    trade: 15,
    mixed: 5,
    rebound: 5,
    volatility: 10,
    highlow: 15,
    stable: 5,
  };

  if (valid.length < 2) {
    return (Object.keys(baseScores) as ArticleThemeId[])
      .map((id) => ({ id, ...ARTICLE_THEME_META[id], score: baseScores[id] }))
      .sort((a, b) => b.score - a.score);
  }

  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = last.medianPrice - first.medianPrice;
  const rate = first.medianPrice ? (delta / first.medianPrice) * 100 : 0;
  const prices = valid.map((item) => item.medianPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minIndex = prices.indexOf(minPrice);
  const maxIndex = prices.indexOf(maxPrice);
  const rangeRate = minPrice ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const completed = valid.filter((item) => !(item.month === currentMonthKey && now.getDate() < lastDayOfMonth));
  const tradeStats = completed.length ? completed : valid;
  const tradeCounts = tradeStats.map((item) => item.tradeCount ?? 0);
  const sortedTrades = [...tradeCounts].sort((a, b) => a - b);
  const medianTrade = sortedTrades.length
    ? sortedTrades[Math.floor(sortedTrades.length / 2)]
    : 0;
  const firstTrades = tradeStats[0]?.tradeCount ?? 0;
  const lastTrades = tradeStats[tradeStats.length - 1]?.tradeCount ?? 0;
  const maxTrades = Math.max(...tradeCounts, 0);
  const tradeSurge = lastTrades >= 3 && firstTrades > 0 && lastTrades >= firstTrades * 1.6 && lastTrades - firstTrades >= 2;
  const tradeDrop = firstTrades >= 3 && lastTrades <= Math.max(1, Math.floor(firstTrades * 0.6)) && firstTrades - lastTrades >= 2;
  const tradeConcentration = maxTrades >= 5 && maxTrades >= Math.max(5, medianTrade * 1.7);

  baseScores.price = 35 + Math.min(35, Math.abs(rate) * 2.4);

  const firstBand = Math.floor(first.medianPrice / 100000000);
  const lastBand = Math.floor(last.medianPrice / 100000000);
  if (firstBand !== lastBand) baseScores.band = 88;

  if (tradeSurge || tradeDrop) baseScores.trade = 84;
  else if (tradeConcentration) baseScores.trade = 72;

  const priceUp = rate >= 4;
  const priceDown = rate <= -4;
  if ((priceUp && tradeDrop) || (priceDown && tradeSurge)) baseScores.mixed = 92;
  else if ((priceUp && lastTrades < firstTrades) || (priceDown && lastTrades > firstTrades)) baseScores.mixed = 70;

  const reboundedFromLow = minIndex > 0 && minIndex < valid.length - 1 && minPrice > 0 && ((last.medianPrice - minPrice) / minPrice) * 100 >= 5;
  const pulledBackFromHigh = maxIndex > 0 && maxIndex < valid.length - 1 && maxPrice > 0 && ((maxPrice - last.medianPrice) / maxPrice) * 100 >= 4;
  if (reboundedFromLow || pulledBackFromHigh) baseScores.rebound = 86;

  if (rangeRate >= 12) baseScores.volatility = 82;
  else if (rangeRate >= 8) baseScores.volatility = 68;

  const nearHigh = maxPrice > 0 && last.medianPrice >= maxPrice * 0.98;
  const nearLow = minPrice > 0 && last.medianPrice <= minPrice * 1.02;
  if (nearHigh || nearLow) baseScores.highlow = 74;

  if (Math.abs(rate) <= 3 && rangeRate <= 6) baseScores.stable = 88;
  else if (Math.abs(rate) <= 5 && rangeRate <= 8) baseScores.stable = 68;

  return (Object.keys(baseScores) as ArticleThemeId[])
    .map((id) => ({ id, ...ARTICLE_THEME_META[id], score: baseScores[id] }))
    .sort((a, b) => b.score - a.score);
}

function selectArticleTheme(
  monthlyStats: MonthlyStat[],
  mode: ArticleThemeMode,
  recentThemes: ArticleThemeId[],
  recommendedAngle: string
): ArticleThemeChoice {
  const candidates = analyzeArticleThemes(monthlyStats);
  if (mode !== "auto") {
    const manual = candidates.find((item) => item.id === mode);
    if (manual) return manual;
  }

  const recent = new Set(recentThemes.slice(-2));
  const fresh = candidates.find((item) => item.score >= 60 && !recent.has(item.id));
  const choice = fresh || candidates.find((item) => !recent.has(item.id)) || candidates[0];

  if (recommendedAngle.trim() && monthlyStats.filter((item) => item.medianPrice != null).length < 2) {
    return { ...choice, angle: recommendedAngle.trim() };
  }
  return choice;
}

function makeThumbnailPrompt(data: ApartmentData, monthlyStats: MonthlyStat[], articleTheme: ArticleThemeChoice) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const valid = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = first && last ? last.medianPrice - first.medianPrice : null;
  const changeRate = first?.medianPrice && last?.medianPrice
    ? (delta! / first.medianPrice) * 100
    : null;
  const userMainCopy = data.question.trim();
  const toneLabel: Record<ThumbnailTone, string> = {
    auto: "자동 추천",
    standard: "정석형",
    hook: "후킹형",
    humor: "유머형",
  };
  const toneInstruction: Record<ThumbnailTone, string> = {
    auto: "정석형·후킹형·유머형 3가지를 내부적으로 비교한 뒤 가장 잘 맞는 1픽을 선택할 것.",
    standard: "정석형만 사용. 데이터가 바로 이해되는 안정적이고 신뢰감 있는 문구를 선택할 것.",
    hook: "후킹형만 사용. 실제 데이터에 근거한 놀람·의문·반전 표현으로 클릭을 유도하되 과장하지 말 것.",
    humor: "유머형만 사용. 부동산 신뢰감을 해치지 않는 선에서 가볍고 재치 있는 문구를 선택할 것.",
  };
  const mainCopyBlock = userMainCopy
    ? `\n[사용자 지정 메인 문구]\n${userMainCopy}\n- 사용자가 직접 입력한 문구이므로 이 문구를 우선 사용하되, 숫자나 사실이 제공 데이터와 충돌하면 데이터에 맞게 최소 수정할 것.\n`
    : "";
  const selectedCopyGuide = userMainCopy
    ? userMainCopy
    : data.thumbnailTone === "auto"
      ? "정석형·후킹형·유머형 3가지를 내부적으로 비교해 고른 최종 1픽"
      : `${toneLabel[data.thumbnailTone]} 톤으로 고른 최종 1픽`;

  return `네이버 블로그용 아파트 썸네일 이미지를 만들어줘.

[기본 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
최근 실거래가: ${value(data.recentPrice)}
비교 가격: ${value(data.previousPrice)}
세대수: ${value(data.households)}
입주년도: ${value(data.moveIn)}
주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}

[가격·거래 흐름 정보]
비교 시점: 최근 6개월
비교값: ${first ? formatWon(first.medianPrice) : "확인 필요"}
최근값: ${last ? formatWon(last.medianPrice) : "확인 필요"}
변화액: ${delta == null ? "계산 불가" : (delta >= 0 ? "+" : "-") + formatWon(Math.abs(delta))}
변화율: ${changeRate == null ? "계산 불가" : (changeRate >= 0 ? "+" : "") + changeRate.toFixed(1) + "%"}
첫 유효월 거래량: ${first ? first.tradeCount + "건" : "확인 필요"}
최근 유효월 거래량: ${last ? last.tradeCount + "건" : "확인 필요"}

${mainCopyBlock}
[이번 글의 주제 방향]
주제: ${articleTheme.label}
관점: ${articleTheme.angle}

[썸네일 톤 선택]
${toneLabel[data.thumbnailTone]}
${toneInstruction[data.thumbnailTone]}

[썸네일 제작 방향 — 최우선]
이번 썸네일은 광고 배너나 분양 홍보물처럼 보이지 않게 한다.
네이버에서 개인 블로거가 직접 편집한 것처럼 자연스럽고 깔끔하게 구성한다.
'지역명 + 단지명 + 핵심 숫자 또는 핵심 변화 1개'가 빠르게 이해되게 한다.
정보를 전부 설명하지 말고 클릭 후 본문에서 확인할 여지를 남긴다.
텍스트와 장식 요소를 최소화하고 생활감 있는 주거 이미지를 활용한다.

[썸네일 메인 문구 생성 규칙]
- 사용자가 메인 문구를 직접 입력했다면 그 문구를 우선 사용한다.
- 입력값이 비어 있으면 위 [썸네일 톤 선택]을 최우선으로 따를 것.
- 자동 추천이면 ① 정석형 ② 후킹형 ③ 가벼운 재치형을 내부적으로 비교한 뒤 최종 1개만 사용할 것.
- 정석형·후킹형·유머형 중 하나를 직접 선택했다면 선택한 톤 안에서 가장 좋은 문구를 만들 것.
- 후보나 선택 과정을 이미지에 표시하지 말 것.
- 지역명 또는 대표 생활권을 자연스럽게 활용할 수 있다.
- 단지명만 덩그러니 보여주기보다 지역 맥락이 함께 느껴지게 할 것.
- 위 [이번 글의 주제 방향]과 같은 핵심 이야기를 하게 할 것.
- 가격 상승·하락, 가격대 전환, 저점 반등, 고점 접근, 거래량 변화, 가격과 거래량의 엇갈림 중 실제 데이터가 뒷받침하는 장면을 사용할 것.
- '6개월 새 00억 올랐다' 같은 한 가지 문법을 반복하지 말 것.
- 숫자가 강하면 숫자 1개만 가장 크게 강조할 것.
- '4억대였는데 5억 넘었다', '저점 찍고 다시 5억대'처럼 사람이 바로 이해하는 장면형 표현을 적극 검토할 것.
- 후킹형은 실제 데이터에 근거한 가벼운 놀람·의문형을 사용할 수 있다.
- 유머형은 신뢰감을 해치지 않는 한 스푼 정도의 재치만 허용한다.
- '폭등', '급등 확정', '지금 사야 한다', '무조건 오른다', '지금 안 보면 후회' 같은 과장·투자유도 표현은 금지한다.
- 진행 중인 최신 월의 낮은 거래건수만으로 거래 감소형을 선택하지 말고 완료된 월끼리 비교할 것.
- 거래량만으로 사람들의 심리나 의도를 추정하지 말 것.
- 본문 제목과 썸네일 문구는 완전히 같을 필요가 없지만 같은 가격·거래 맥락 안에서 연결할 것.
- 숫자와 기간은 제공된 데이터만 사용하고 임의로 만들지 말 것.
- 모바일 목록에서 한 번에 읽히도록 짧고 강하게 작성할 것.

[이미지 제작 기준]
- 정확한 크기 1254×1254px
- 정사각형 1:1
- 네이버 블로그용 단일 썸네일
- 핵심 문구는 중앙 안전영역에 배치
- 색상은 2~3개 정도로 절제
- 단지명과 메인 문구가 모바일에서도 즉시 읽히도록 할 것
- 메인 카피는 핵심 변화 또는 숫자 1개만 강조
- 작은 정보칩을 여러 개 늘어놓지 말 것
- 하단 보조정보는 꼭 필요할 때만 1줄로 제한
- 과한 배지, 스티커, 말풍선, 네온, 유리질감, 과한 3D 효과 금지
- '고급 부동산 광고'보다 '사람이 직접 만든 정보형 블로그 썸네일' 느낌을 우선
- 실제 아파트 생활권을 연상시키는 자연스러운 주거·도시 배경 사용
- 특정 단지의 실제 모습을 정확히 재현한 것처럼 보이지 않게 할 것
- 검색 사진, 로고, 워터마크, 출처 불명의 사진을 복제하거나 재사용하지 말 것
- 한글 오탈자 없이 제작

[권장 구성]
상단 작은 글씨: 지역 또는 대표 생활권
중앙: 단지명
메인 카피: 핵심 변화 또는 숫자 1개
하단: 꼭 필요한 보조정보 1줄 이하

이미지를 바로 생성해줘.`;
}


function makePriceImagePrompt(data: ApartmentData, monthlyStats: MonthlyStat[]) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const valid = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const change = first?.medianPrice && last?.medianPrice
    ? ((last.medianPrice - first.medianPrice) / first.medianPrice) * 100
    : null;
  const lines = monthly.length
    ? monthly.map((item) =>
        `- ${item.month}: 대표가격 ${item.medianPrice == null ? "거래 없음" : formatWon(item.medianPrice)} / 거래 ${item.tradeCount}건`
      ).join("\n")
    : "- 최근 6개월 데이터 없음";

  return `네이버 블로그 본문용 아파트 시세 그래프 이미지를 만들어줘.

[단지 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}

[최근 6개월 월별 실거래 데이터]
${lines}

[요약값]
첫 유효 대표값: ${first ? formatWon(first.medianPrice) : "확인 필요"}
최근 유효 대표값: ${last ? formatWon(last.medianPrice) : "확인 필요"}
대표값 변화율: ${change == null ? "계산 불가" : (change >= 0 ? "+" : "") + change.toFixed(1) + "%"}

[이미지 역할]
이 이미지는 광고물이 아니라 본문의 실제 데이터 확인용 이미지다.
한눈에 '가격은 어떻게 움직였고 거래는 얼마나 있었는지'를 이해시키는 것이 목적이다.

[이미지 제작 기준]
- 정확한 크기 1600×900px
- 16:9 가로형
- 네이버 블로그 본문용 단일 이미지
- 제목은 '지역·단지 최근 6개월 실거래 흐름'처럼 지역 맥락이 보이게 구성
- 월별 대표가격을 선그래프로 표현할 것
- 거래가 있는 모든 월의 데이터 포인트 위에 가격 라벨을 표시할 것
- 최신 유효월 가격은 다른 월보다 조금 더 강조할 것
- 각 월 아래 거래건수를 표시할 것
- 거래가 없는 달은 임의의 가격을 만들지 말고 '거래 없음'으로 표시할 것
- 중간에 거래 없는 월이 있어도 앞뒤 유효 거래가 있다면 흐름 선은 연결하되 해당 월의 가짜 가격 포인트를 만들지 말 것
- 진행 중인 월은 '현재까지'임을 알 수 있게 표시할 것
- 오른쪽 또는 하단 요약 영역은 최근 대표값 / 첫 대표값 / 변화율 정도만 간단히 정리할 것
- 장식보다 숫자 가독성을 우선할 것
- 배경, 카드, 색상을 과하게 사용하지 말 것
- 광고 카드뉴스보다 실제 블로거가 엑셀·그래프를 정리한 듯한 자연스러운 정보 이미지로 만들 것
- 제공한 숫자를 임의로 수정하거나 새로운 가격을 만들지 말 것
- 한글과 숫자 오탈자 없이 제작

이미지를 바로 생성해줘.`;
}

function makeLocationImagePrompt(data: ApartmentData) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  return `네이버 블로그 본문용 아파트 입지 인포그래픽 이미지를 만들어줘.

[단지 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
가까운 주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}

[지도 참고 방식]
- 이 요청과 함께 붙여넣은 네이버 지도 캡처는 위치 관계 확인용 참고자료로만 사용한다.
- 지도 캡처가 없다면 위치를 임의로 만들지 말고 먼저 지도 캡처를 요청한다.
- 캡처에서 단지 위치, 주요 역, 도로, 확인 가능한 생활권의 상대적 위치만 파악한다.
- 네이버 지도 타일, 색상, 폰트, 아이콘, 로고, UI를 그대로 복제하지 않는다.
- 원본 지도 이미지를 배경으로 그대로 재사용하지 않는다.
- 지도에서 확인되지 않는 학교·공원·상권·교통시설을 임의로 추가하지 않는다.

[이미지 역할]
정확한 길찾기 지도가 아니라 '이 단지가 어느 생활권에 있고 무엇과 가까운지'를 한눈에 이해시키는 이미지다.

[이미지 제작 기준]
- 정확한 크기 1600×900px
- 16:9 가로형
- 네이버 블로그 본문용 단일 이미지
- 제목은 '지역 또는 생활권에서 이 단지는 어디쯤?'처럼 자연스럽게 구성
- 단지 위치를 가장 크게 표시
- 주요 역은 두 번째로 강조
- 주변 생활권·도로·공원·학교 등은 지도에서 확인되는 것만 최소 표시
- 정보 카드가 화면을 가득 채우지 않게 할 것
- 과한 부동산 광고·분양 홍보 디자인 금지
- 실제 블로그 운영자가 간단히 재구성한 지도·생활권 이미지 느낌
- 우측 또는 하단에 입지 설명 1줄만 배치
- 정확한 축척이나 도보시간처럼 오해할 표현 금지
- 직선거리를 임의의 도보시간으로 환산하지 말 것
- 색상은 2~3개 정도로 절제
- 한글 오탈자 없이 제작

지도 캡처의 위치 관계를 참고해서 새로운 입지 이미지를 바로 생성해줘.`;
}


function apartmentStoryIdentity(data: ApartmentData) {
  return [normalizeComplexName(data.name), data.region.trim().replace(/\s+/g, " ")].join("|");
}

function emptyApartmentStory(identity = ""): StoryWork {
  return { identity, raw: "", candidates: [], selectedId: "", sourceChecked: false };
}

function makeBodyPrompt(
  data: ApartmentData,
  monthlyStats: MonthlyStat[],
  recommendedAngle: string,
  articleTheme: ArticleThemeChoice,
  story: ApartmentStoryCandidate | null
) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const monthlyLines = monthly.length
    ? monthly.map((item) =>
        `- ${item.month}: 월 대표값 ${item.medianPrice == null ? "거래 없음" : formatWon(item.medianPrice)}, 거래 ${item.tradeCount}건`
      ).join("\n")
    : "- 월별 실거래 데이터 없음";
  const validMonthly = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const firstMonthly = validMonthly[0];
  const lastMonthly = validMonthly[validMonthly.length - 1];
  const priceDelta = firstMonthly && lastMonthly ? lastMonthly.medianPrice - firstMonthly.medianPrice : null;
  const priceRate = firstMonthly?.medianPrice && lastMonthly?.medianPrice
    ? (priceDelta! / firstMonthly.medianPrice) * 100
    : null;
  const firstTradeCount = firstMonthly?.tradeCount ?? null;
  const lastTradeCount = lastMonthly?.tradeCount ?? null;
  const articleAngle = recommendedAngle.trim();
  const storyBlock = story ? `[선정한 동네 스토리 — 본문 반영 전에 원문 재확인]
주제: ${story.title}
유형: ${story.kind}
확인된 핵심 사실: ${story.facts}
단지와의 생활권 연결: ${story.connection}
연결 문장 초안: ${story.bridge}
원문 제목: ${story.sourceTitle}
원문 URL(검증용, 최종 발행본문에는 출력하지 말 것): ${story.sourceUrl}
원문 발표일: ${story.sourceDate}
행사·사업 실제 날짜: ${story.eventDate}
시점 상태: ${story.timing}
- 이 자료는 별도 조사 결과이다. 최종 원고 작성 시 원문을 다시 확인하고 사실이 불확실하면 해당 내용은 제외할 것.
- 가격 변동 원인이 아니라 입지·생활권을 이해하는 별도 이야기로 전개할 것.
- 지역 스토리는 전체 글의 약 15~20% 이내에서 간결하게 쓰고 억지로 고정 소제목을 만들지 말 것.`
    : `[동네 스토리]
선정·검증된 스토리가 없음. 지역 행사·뉴스·커뮤니티 정보를 억지로 추가하지 말고 실거래와 확인된 입지 설명을 중심으로 완성할 것.`;
  const today = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `네이버 블로그용 아파트 분석글을 최종 발행본으로 작성해줘.

[작성 기준일]
${today}

[단지 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
최근 실거래가: ${value(data.recentPrice)}
비교값: ${value(data.previousPrice)}
세대수: ${value(data.households)}
입주년도: ${value(data.moveIn)}
주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}
참고 관점: ${articleAngle || "없음 — GPT가 최근 6개월 데이터에서 직접 선정"}

[이번 글의 주제 — 최우선]
주제 유형: ${articleTheme.label}
핵심 관점: ${articleTheme.angle}
- 제목, 도입부, ⑤ 이 단지만의 핵심 포인트는 이 주제를 중심으로 작성할 것.
- 선택 주제가 '가격 변화'가 아닌데 가격 상승폭만 다시 메인 제목으로 가져오지 말 것.
- 데이터가 선택 주제를 뒷받침하지 못할 때만 가장 가까운 다른 주제로 최소 조정할 것.

[최근 6개월 실거래 데이터]
${monthlyLines}

[제목용 요약 — 월 대표값 기준]
첫 유효 대표값: ${firstMonthly ? formatWon(firstMonthly.medianPrice) : "확인 필요"}
최근 유효 대표값: ${lastMonthly ? formatWon(lastMonthly.medianPrice) : "확인 필요"}
대표값 변화액: ${priceDelta == null ? "계산 불가" : (priceDelta >= 0 ? "+" : "-") + formatWon(Math.abs(priceDelta))}
대표값 변화율: ${priceRate == null ? "계산 불가" : (priceRate >= 0 ? "+" : "") + priceRate.toFixed(1) + "%"}
첫 유효월 거래량: ${firstTradeCount == null ? "확인 필요" : firstTradeCount + "건"}
최근 유효월 거래량: ${lastTradeCount == null ? "확인 필요" : lastTradeCount + "건"}

중요:
최근 실거래가는 개별 계약 가격이고 월 대표값은 월별 통계값이다.
두 값을 하나의 가격처럼 섞거나 서로 비교해 상승률을 계산하지 말 것.

${storyBlock}

[최신 정보 확인]
- 웹 검색이 가능하면 작성 전에 이 단지와 직접 관련된 최신 정보만 확인할 것.
- 정비사업, 교통, 공급, 생활권, 개발계획은 공식자료를 우선할 것.
- 계획·검토·추진·지정·착공·개통 목표·확정을 정확히 구분할 것.
- 확인되지 않은 호재나 인과관계는 쓰지 말 것.
- 정비사업이나 교통 이슈와 거래 증가가 동시에 나타났더라도 직접 원인이라고 단정하지 말 것.
- 웹 검색이 불가능하면 최신 정보를 추정하지 말 것.
- 직선거리 정보를 도보시간으로 임의 환산하지 말 것.
- 최종 발행본문에는 원문 URL, 마크다운 링크, 괄호형 출처 링크, UTM 주소를 절대 넣지 말 것.
- 외부 정보를 반영할 때는 '군포시 고시자료에 따르면', 'LH 보도자료에 따르면'처럼 기관명과 자료 성격만 자연스러운 일반 문장으로 적을 것.
- 별도의 출처 목록이나 링크 모음은 출력하지 말 것.

[제목 규칙 — 검색 범위 확대형]
- 최종 제목은 1개만 출력할 것.
- 제목 후보는 내부적으로 최소 5개를 만들어 비교한 뒤 가장 좋은 1개만 출력할 것. 후보 목록은 표시하지 말 것.
- 단지명만 제목 맨 앞에 반복 배치하는 방식에서 벗어날 것.
- 가능하면 제목 앞부분에 독자가 실제로 검색할 만한 상위 지역명 또는 대표 생활권명을 자연스럽게 넣을 것.
- 기본 구조는 '지역명 → 생활권/단지명 → 핵심 변화·숫자·궁금증' 순서를 우선 검토할 것.
- 시·구·동·생활권을 전부 억지로 나열하지 말고 검색 가치가 높은 지역 표현 1~2개만 사용할 것.
- 지역명, 단지명, 핵심 주제가 한 번에 이해돼야 한다.
- 지역 키워드를 반복 삽입한 SEO식 문장은 금지한다.
- 위 [이번 글의 주제 — 최우선]을 제목의 핵심 소재로 사용할 것.
- '6개월 새 ○○억 올랐다' 같은 한 가지 제목 문법을 모든 단지에 반복하지 말 것.
- 가격대 전환, 거래량, 반등, 고점·저점, 보합, 변동성, 가격과 거래의 엇갈림 등 실제 데이터가 뒷받침하는 장면을 적극 활용할 것.
- 상승액·상승률이 크더라도 숫자만 기계적으로 나열하지 말고 더 직관적인 장면이 있으면 그쪽을 우선 검토할 것.
- 검색 유입을 고려해 무엇을 다루는 글인지 바로 알 수 있게 쓰되 답을 제목에서 전부 공개하지 말 것.
- 가능하면 32자 이내, 최대 38자 이내로 작성할 것.
- 작성 기준일이 해당 월의 말일 이전이면 최신 월 거래량은 아직 집계 중인 값으로 취급할 것.
- 진행 중인 최신 월 거래건수를 사용할 때는 '현재' 또는 '현재까지'라는 의미가 드러나게 표현할 것.
- 거래 증가·감소 판단은 가급적 완료된 월끼리 비교하고 진행 중인 월은 보조 정보로만 사용할 것.
- 거래량만으로 사람들의 심리나 관심을 사실처럼 추정하지 말 것.
- '왜/이유/까닭'은 원인이 확인됐을 때만 사용할 것. 원인이 확정되지 않았다면 '배경은?', '무엇이 달라졌나', '이어질까'처럼 열어 둘 것.
- 최근 실거래가와 월 대표값을 하나의 가격처럼 섞어 제목을 만들지 말 것.
- 썸네일 문구와 제목은 완전히 같을 필요가 없지만 같은 데이터·주제 맥락을 유지할 것.
- 과장, 매수 권유, 투자 확정 표현은 금지할 것.

[첫 문장·도입 규칙 — 매우 중요]
- 첫 문장은 검색 범위를 넓히고 독자가 계속 읽을지를 결정하는 문장으로 작성할 것.
- '안녕하세요', '오늘은 ○○아파트를 알아보겠습니다'로 시작하지 말 것.
- 첫 문장에는 가능하면 '시·구급 상위 지역명 + 대표 생활권'을 함께 자연스럽게 포함할 것.
- 입력 지역이 동 단위라면 그 동만 반복하지 말고, 최신 웹 확인을 통해 독자가 실제로 검색할 상위 지역명(예: 화성·동탄, 군포·산본, 용인·수지)을 먼저 잡을 것.
- 해당 지역에 여러 생활권이 있다면 검증 가능한 대표 생활권 2~4곳을 자연스럽게 언급할 수 있다.
- 예: '화성 동탄 아파트 시장을 보면 동탄역·동탄2신도시·신동 생활권마다 가격과 거래 흐름이 조금씩 다릅니다.'
- 생활권 이름을 키워드 나열처럼 억지로 넣지 말 것.
- 지역 또는 생활권 정보가 확실하지 않으면 임의로 만들지 말 것.
- 첫 3문장은 '① 큰 지역(시·구)과 대표 생활권을 연다 → ② 이번 단지로 좁힌다 → ③ 가장 강한 가격·거래 숫자나 궁금증을 던진다' 흐름을 우선할 것.
- 숫자가 강한 글이라면 첫 문장 또는 두 번째 문장에 숫자를 바로 넣어도 된다.
- 단일 단지 분석글이어도 먼저 지역을 열고 단지로 좁히는 방식을 적극 사용한다.
- 같은 도입 문장을 여러 단지에 복사한 것처럼 반복하지 말고 지역별 특성에 맞게 표현을 바꿀 것.

[본문 규칙]
- 한 문장 = 한 문단으로 작성할 것.
- 한 문단에 2문장 이상 붙이지 말 것.
- 짧고 자연스러운 문장을 우선할 것.
- 과장, 매수 권유, 투자 확정 표현 금지.
- 제공되지 않은 숫자를 만들지 말 것.
- 개별 계약 가격은 '최근 실거래가' 또는 '개별 실거래가'라고 표현할 것.
- 월별 통계값은 반드시 '월 대표값'이라고 표현할 것.
- 전용면적은 '전용 84㎡대'처럼 표현할 것.
- 이모지는 🏠📊🚉🔎✅📌 정도만 자연스럽게 사용할 것.
- 확인되지 않은 원인은 '~때문이다'라고 단정하지 말고 '배경 중 하나로 볼 수 있다', '함께 살펴볼 요소다'처럼 표현할 것.
- 거래 건수가 적으면 소수 거래의 영향도 함께 언급할 것.
- 같은 숫자와 같은 설명을 여러 섹션에서 반복하지 말 것.

[본문 구조 — 지역 확장 + 단지 집중]
① 지역을 여는 강한 도입 3문장
② 최근 6개월 시세 흐름
③ 거래량 변화
④ 입지·생활권. 선택한 동네 스토리가 있으면 실제 단지와의 연결을 짧게 짚으며 여기에서 자연스럽게 전개. 없으면 입지만 충실하게 작성
⑤ 이 단지만의 핵심 포인트
⑥ 앞으로 체크할 것
⑦ 짧은 마무리 + 정확히 3줄 요약
- 세대수·입주년도 같은 기본정보는 별도 스펙표처럼 길게 나열하지 않고 도입이나 관련 섹션에 자연스럽게 녹일 것.
- ⑤ 핵심 포인트는 단지별 데이터에 따라 반등, 거래 급증·감소, 고점 접근, 가격과 거래량의 엇갈림, 정비사업, 신축·입주 등으로 자유롭게 바꿀 것.
- 전체 원칙은 '틀은 일정하게, 첫 문장·핵심 포인트·제목은 단지마다 다르게'로 할 것.
- 동네 이야기는 실거래 상승·하락의 직접 원인이라고 단정하지 말 것. 연결이 부자연스러우면 생략할 것.
- 지난 행사·예정 행사 등 시점을 정확히 밝히고, 일부 공개 커뮤니티 게시물을 주민 전체 의견으로 일반화하지 말 것.
- 모바일 가독성을 위해 한 문단은 짧게 유지할 것.

[검색 키워드 사용 원칙]
- 상위 지역명, 대표 생활권명, 단지명, '지역명 + 아파트', '지역명 + 실거래가', '지역명 + 아파트 시세', '단지명 + 실거래가'를 문맥에 맞을 때만 자연스럽게 활용할 것.
- 키워드를 모두 반드시 넣으려고 하지 말 것.
- 같은 키워드를 반복해서 검색용 문장처럼 만들지 말 것.
- 독자가 읽었을 때 자연스러운 문장을 최우선으로 할 것.

[이미지 톤과 연결]
- 본문에서도 '핫한 단지', '놓치면 안 될 단지'처럼 광고·홍보성 표현을 피할 것.
- 글의 분위기는 '매물을 홍보하는 사람'보다 '지역 아파트 데이터를 꾸준히 관찰하는 블로거'에 가깝게 작성할 것.

[이미지 위치]
도입부 뒤:
[이미지 1 — 썸네일]

최근 6개월 가격 흐름 설명 뒤:
[이미지 2 — 최근 6개월 시세 그래프]

입지와 생활권 설명 전후:
[이미지 3 — 입지 인포그래픽]

각 이미지 문구는 반드시 한 줄 단독으로 출력할 것.

[폰트·출력 서식 — 최우선]
- 제목 20pt / 소제목 18pt / 일반 본문 15pt / 태그 13~14pt 기준으로 작성할 것.
- 실제 최종 글에 '20pt', '18pt', '15pt', '13~14pt' 같은 편집 지시문은 출력하지 말 것.
- 일반 본문은 네이버 블로그 기본 본문 크기로 유지하고 제목과 소제목만 크게 구분할 것.
- 제목은 가장 크게, 소제목은 본문보다 한 단계 크게 보이도록 각각 독립된 줄로 작성할 것.
- 소제목은 굵게, 일반 본문은 기본 굵기로 유지할 것.
- 네이버 모바일에서 읽기 쉽게 본문은 '한 문장 = 한 문단'으로 작성할 것.
- 일반 본문 문장과 다음 문장 사이에는 네이버 블로그에 붙여넣어도 간격이 유지되도록 스페이스바 1칸이 들어간 간격용 줄을 1개 넣을 것.
- 기본 형식은 '문장 → 엔터 → 스페이스바 1칸이 있는 줄 → 엔터 → 다음 문장'으로 할 것.
- 완전히 비어 있는 빈 줄을 사용하지 말 것.
- 제목 다음에도 스페이스바 1칸이 들어간 간격용 줄을 1개 넣을 것.
- 소제목 앞뒤에도 각각 같은 간격용 줄을 1개 넣을 것.
- 이미지 위치 문구는 한 줄 단독으로 두고 위아래 각각 같은 간격용 줄을 1개 넣을 것.
- 3줄 요약은 각 문장을 한 줄씩 따로 쓰고 문장 사이에도 같은 간격용 줄을 1개 넣을 것.
- 일반 텍스트가 있는 줄의 시작에는 불필요한 공백을 넣지 말 것.
- 코드블록과 HTML은 사용하지 말 것.

[마무리]
- 앞으로 체크할 것은 매수 권유가 아니라 월 대표값, 거래량, 개별 실거래가, 정비사업 진행 단계 등 실제 데이터 중심으로 작성할 것.
- 3줄 요약은 정확히 3문장으로 작성할 것.
- 네이버 태그는 단지명·지역명·핵심 검색어 중심으로 중복 없이 정확히 7개만 작성할 것.
- 태그는 마지막 한 줄에 '#백두동성 #산본동아파트'처럼 일반 # 기호를 그대로 사용해 출력할 것.
- 태그 앞의 #을 '\#'처럼 백슬래시로 이스케이프하지 말 것.
- 태그에 마크다운 기호나 코드 표시를 붙이지 말 것.

[최종 출력]
아래 3가지만 출력할 것.
1) 최종 제목 1개
2) 최종 본문
3) 네이버 태그 7개

제목 후보, 검색 과정, 출처 목록, 작성 설명, 내부링크 추천, 기타 부가 설명은 출력하지 말 것.

[출력 직전 자가검수]
- 제목 1개
- 태그 정확히 7개
- 모든 문장·제목·소제목·이미지 위치·요약 사이에 스페이스바 1칸이 들어간 간격용 줄 1개
- 완전히 비어 있는 빈 줄 0개
- 코드블록/HTML 사용 없음
- 최근 실거래가와 월 대표값 혼동 없음
- 제공되지 않은 숫자 생성 없음
- 이미지 위치 3개 포함
- 3줄 요약 정확히 3문장
- 원문 URL/마크다운 링크/괄호형 링크 0개
- 태그의 # 앞에 백슬래시 0개
- 진행 중인 최신 월 거래량은 '현재/현재까지'로 표시

하나라도 어기면 스스로 수정한 뒤 최종 발행본만 출력할 것.

복사해서 네이버 블로그에 바로 붙여넣을 수 있는 내용만 작성해줘.`;

}

function formatWon(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  const eok = value / 100000000;
  if (eok >= 1) {
    const fixed = eok >= 10 ? eok.toFixed(1) : eok.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "억";
  }
  return Math.round(value / 10000).toLocaleString("ko-KR") + "만원";
}

async function makeThumbnail(data: ApartmentData, photoDataUrl: string) {
  const photo = photoDataUrl ? await loadImage(photoDataUrl) : null;
  return canvasUrl(1254, 1254, (ctx) => {
    if (photo) {
      drawCover(ctx, photo, 0, 0, 1254, 1254);
      const shade = ctx.createLinearGradient(0, 0, 0, 1254);
      shade.addColorStop(0, "rgba(8,19,34,.36)");
      shade.addColorStop(.42, "rgba(8,19,34,.28)");
      shade.addColorStop(1, "rgba(5,16,30,.92)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, 1254, 1254);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 1254, 1254);
      bg.addColorStop(0, "#0a1829");
      bg.addColorStop(.58, "#123c50");
      bg.addColorStop(1, "#0a6d70");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1254, 1254);

      ctx.save();
      ctx.globalAlpha = .18;
      ctx.strokeStyle = "#b9fff4";
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        roundRect(ctx, 740 + i * 48, 160 + i * 36, 250, 760 - i * 38, 18);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,.06)";
      roundRect(ctx, 760, 300, 330, 650, 22);
      ctx.fill();
      ctx.fillStyle = "rgba(161,246,231,.42)";
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
          roundRect(ctx, 804 + col * 62, 356 + row * 60, 30, 24, 5);
          ctx.fill();
        }
      }
    }

    drawBrand(ctx, 78, 70);

    roundRect(ctx, 862, 70, 314, 52, 26);
    ctx.fillStyle = "rgba(8,22,36,.52)";
    ctx.fill();
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.textAlign = "center";
    ctx.fillText(data.region || "지역", 1019, 83);
    ctx.textAlign = "left";

    ctx.font = `700 23px ${FONT}`;
    ctx.fillStyle = "#88efe2";
    ctx.fillText("단지 실거래 · 가격 흐름", 78, 328);

    const nameSize = fitText(ctx, data.name || "아파트 단지", 1080, 94, 58, 900);
    ctx.font = `900 ${nameSize}px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.28)";
    ctx.shadowBlur = 18;
    ctx.fillText(data.name || "아파트 단지", 78, 374);
    ctx.shadowBlur = 0;

    roundRect(ctx, 78, 650, 1098, 196, 32);
    ctx.fillStyle = "rgba(7,20,34,.78)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ff8f84";
    roundRect(ctx, 78, 650, 14, 196, 7);
    ctx.fill();

    ctx.font = `900 66px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    drawWrapped(ctx, data.question || "요즘 얼마에 거래될까?", 128, 690, 980, 80, 2);

    const chips = [data.area || "대표면적", "최근 실거래", "입지 핵심"];
    let chipX = 78;
    chips.forEach((label) => {
      ctx.font = `800 22px ${FONT}`;
      const w = Math.max(150, ctx.measureText(label).width + 48);
      roundRect(ctx, chipX, 914, w, 54, 27);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText(label, chipX + 24, 928);
      chipX += w + 14;
    });

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.moveTo(78, 1040);
    ctx.lineTo(1176, 1040);
    ctx.stroke();

    ctx.font = `700 24px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.fillText("실거래 원자료를 기준으로 최근 흐름을 정리했습니다.", 78, 1084);
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = "#86e9dc";
    ctx.textAlign = "right";
    ctx.fillText("집값쓱", 1176, 1088);
    ctx.textAlign = "left";
  });
}

function makePriceCard(data: ApartmentData, monthlyStats: MonthlyStat[]) {
  return canvasUrl(1600, 900, (ctx) => {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, 0, 1600, 900);
    drawBrand(ctx, 76, 52, true);

    const stats = monthlyStats.slice(-6);
    const valid = stats.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
    const last = valid[valid.length - 1];

    ctx.font = `900 46px ${FONT}`;
    ctx.fillStyle = "#101b2c";
    ctx.fillText("최근 6개월 실거래 흐름", 76, 134);

    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#718096";
    ctx.fillText(`${data.name} · ${data.area || "대표 전용면적"}`, 76, 198);

    if (!valid.length) {
      roundRect(ctx, 76, 270, 1448, 500, 30);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e1e8f1";
      ctx.stroke();
      ctx.font = `900 38px ${FONT}`;
      ctx.fillStyle = "#203047";
      ctx.fillText("실거래 데이터 연결 후 그래프가 자동 생성됩니다.", 154, 430);
      ctx.font = `700 22px ${FONT}`;
      ctx.fillStyle = "#7a8799";
      ctx.fillText("월별 중앙값 · 거래건수 · 최근 대표값을 한 장에서 보여줍니다.", 154, 494);
      return;
    }

    const lastMonth = last.month.split("-");
    ctx.textAlign = "right";
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = "#78869a";
    ctx.fillText(`${lastMonth[0]}년 ${Number(lastMonth[1])}월 확인 기준`, 1524, 64);
    ctx.textAlign = "left";

    roundRect(ctx, 76, 260, 1090, 540, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e1e8f1";
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, 1192, 260, 332, 540, 30);
    ctx.fillStyle = "#0f2036";
    ctx.fill();

    const prices = valid.map((v) => v.medianPrice);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (min === max) {
      min *= .96;
      max *= 1.04;
    } else {
      const pad = (max - min) * .18;
      min -= pad;
      max += pad;
    }

    const gx = 152, gy = 344, gw = 936, gh = 320;
    ctx.strokeStyle = "#e8edf3";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = gy + (gh / 3) * i;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
    }

    const points: Array<{ x: number; y: number; item: MonthlyStat }> = [];
    stats.forEach((item, index) => {
      const x = gx + (stats.length === 1 ? gw / 2 : (gw * index) / (stats.length - 1));
      if (item.medianPrice != null) {
        const y = gy + gh - ((item.medianPrice - min) / (max - min)) * gh;
        points.push({ x, y, item });
      }
      ctx.font = `700 18px ${FONT}`;
      ctx.fillStyle = "#728196";
      ctx.textAlign = "center";
      ctx.fillText(item.month.slice(5) + "월", x, gy + gh + 34);
      ctx.font = `700 16px ${FONT}`;
      ctx.fillStyle = "#9aa5b4";
      ctx.fillText(item.tradeCount ? item.tradeCount + "건" : "거래 없음", x, gy + gh + 64);
    });

    if (points.length >= 2) {
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = "#0f8b86";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Show the representative price on every valid monthly point.
    points.forEach((p, index) => {
      const isLatest = index === points.length - 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isLatest ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isLatest ? "#ef746e" : "#0f8b86";
      ctx.fill();

      const label = formatWon(p.item.medianPrice);
      ctx.font = `${isLatest ? 900 : 800} ${isLatest ? 21 : 18}px ${FONT}`;
      const labelWidth = ctx.measureText(label).width + (isLatest ? 26 : 22);
      const labelHeight = isLatest ? 36 : 32;
      const labelY = p.y - (isLatest ? 54 : 48);

      roundRect(ctx, p.x - labelWidth / 2, labelY, labelWidth, labelHeight, labelHeight / 2);
      ctx.fillStyle = isLatest ? "#fff0ee" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isLatest ? "rgba(239,116,110,.34)" : "rgba(15,139,134,.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isLatest ? "#d85f59" : "#28545a";
      ctx.textAlign = "center";
      ctx.fillText(label, p.x, labelY + (isLatest ? 7 : 6));
    });
    ctx.textAlign = "left";

    const first = valid[0];
    const change = first.medianPrice ? ((last.medianPrice - first.medianPrice) / first.medianPrice) * 100 : null;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = "#83eadc";
    ctx.fillText("최근 대표값", 1236, 320);
    ctx.font = `900 50px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(formatWon(last.medianPrice), 1236, 360);

    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.moveTo(1236, 444);
    ctx.lineTo(1480, 444);
    ctx.stroke();

    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.fillText("6개월 첫 대표값", 1236, 486);
    ctx.font = `900 31px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(formatWon(first.medianPrice), 1236, 524);

    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.fillText("대표값 변화", 1236, 594);
    ctx.font = `900 34px ${FONT}`;
    ctx.fillStyle = change != null && change < 0 ? "#83c9ff" : "#ff9a96";
    ctx.fillText(change == null ? "-" : (change >= 0 ? "+" : "") + change.toFixed(1) + "%", 1236, 632);

    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.48)";
    ctx.fillText("각 월 대표가격 · 중앙값 기준", 1236, 724);
    ctx.fillText("거래 없는 달은 공백 처리", 1236, 750);
  });
}

function drawContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.22)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  roundRect(ctx, x + 22, y - 23, 142, 46, 18);
  ctx.fillStyle = "rgba(255,255,255,.96)";
  ctx.fill();
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = "#172033";
  ctx.fillText(label, x + 38, y - 13);
  ctx.restore();
}

async function makeMapCard(data: ApartmentData, mapDataUrl: string, aptPoint: Point, stationPoint: Point) {
  const image = await loadImage(mapDataUrl);
  return canvasUrl(1600, 900, (ctx) => {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, 0, 1600, 900);
    drawBrand(ctx, 70, 48, true);

    ctx.font = `900 42px ${FONT}`;
    ctx.fillStyle = "#101b2c";
    ctx.fillText("입지 한눈에 보기", 70, 132);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#6e7d92";
    ctx.fillText(`${data.name} · ${data.station}`, 70, 188);

    const mapX = 70, mapY = 244, mapW = 1080, mapH = 590;
    roundRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#e9eef5";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    const box = drawContain(ctx, image, mapX, mapY, mapW, mapH);
    if (aptPoint) drawMarker(ctx, box.x + aptPoint.x * box.w, box.y + aptPoint.y * box.h, "단지", "#ef476f");
    if (stationPoint) drawMarker(ctx, box.x + stationPoint.x * box.w, box.y + stationPoint.y * box.h, data.station || "주요 역", "#118ab2");
    ctx.restore();
    roundRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.strokeStyle = "#dce4ee";
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, 1190, 244, 340, 590, 30);
    ctx.fillStyle = "#0f2036";
    ctx.fill();
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = "#8de8db";
    ctx.fillText("LOCATION NOTE", 1232, 294);
    ctx.font = `900 36px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(data.station || "주요 역", 1232, 350);
    ctx.font = `700 25px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.78)";
    drawWrapped(ctx, data.locationLine || "한 줄 입지 설명", 1232, 430, 250, 38, 5);
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.moveTo(1232, 660);
    ctx.lineTo(1488, 660);
    ctx.stroke();
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.52)";
    ctx.fillText("지도 출처 표시는 원본 유지", 1232, 706);
    ctx.fillText("왜곡 없이 비율 보존", 1232, 738);
  });
}

export default function ApartmentBulkPage() {
  const [contentMode, setContentMode] = useState<ContentMode>("bulk");
  const [data, setData] = useState<ApartmentData>(SAMPLE);
  const [mapDataUrl, setMapDataUrl] = useState("");
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [selectedComplexLoading, setSelectedComplexLoading] = useState(false);
  const [selectedComplexName, setSelectedComplexName] = useState("");
  const [autoMapLoading, setAutoMapLoading] = useState(false);
  const [autoMapMessage, setAutoMapMessage] = useState("");
  const [autoMapGenerated, setAutoMapGenerated] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyMessage, setNearbyMessage] = useState("");
  const [photoCandidates, setPhotoCandidates] = useState<PhotoCandidate[]>([]);
  const [photoCandidatesLoading, setPhotoCandidatesLoading] = useState(false);
  const [photoSearchMessage, setPhotoSearchMessage] = useState("");
  const [photoSearchStart, setPhotoSearchStart] = useState(1);
  const [recommendedAngle, setRecommendedAngle] = useState("");
  const [articleThemeMode, setArticleThemeMode] = useState<ArticleThemeMode>("auto");
  const [recentArticleThemes, setRecentArticleThemes] = useState<ArticleThemeId[]>([]);
  const [aptPoint, setAptPoint] = useState<Point>(null);
  const [stationPoint, setStationPoint] = useState<Point>(null);
  const [markMode, setMarkMode] = useState<"apt" | "station" | null>(null);
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [pricePromptCopied, setPricePromptCopied] = useState(false);
  const [locationPromptCopied, setLocationPromptCopied] = useState(false);
  const [bodyPromptCopied, setBodyPromptCopied] = useState(false);
  const [workPromptCopied, setWorkPromptCopied] = useState(false);
  const [workImagePromptCopied, setWorkImagePromptCopied] = useState<WorkImageSlot | "">("");
  const [finalBlogText, setFinalBlogText] = useState("");
  const [storyState, setStoryState] = useState<StoryWork>(() => emptyApartmentStory());
  const [storyNotice, setStoryNotice] = useState("");
  const [tableHandlingMode, setTableHandlingMode] = useState<TableHandlingMode>("image");
  const [naverCopyMessage, setNaverCopyMessage] = useState("");
  const [mapCopyMessage, setMapCopyMessage] = useState("");
  const [dailyDateKey, setDailyDateKey] = useState("");
  const [dailySlots, setDailySlots] = useState<DailySlot[]>(DEFAULT_DAILY_SLOTS);
  const [dailyApartmentCandidates, setDailyApartmentCandidates] = useState<DailyApartmentCandidate[]>([]);
  const [publishHistoryItems, setPublishHistoryItems] = useState<PublishHistoryItem[]>([]);
  const [publishHistoryFilter, setPublishHistoryFilter] = useState<PublishHistoryFilter>("all");
  const [publishHistorySearch, setPublishHistorySearch] = useState("");
  const [publishHistoryLoading, setPublishHistoryLoading] = useState(false);
  const [publishHistoryMessage, setPublishHistoryMessage] = useState("");
  const dailyApartmentLoadingRef = useRef(false);
  const dailyApartmentLoadedDateRef = useRef("");
  const [activeWorkId, setActiveWorkId] = useState("");
  const [activeWorkType, setActiveWorkType] = useState<DailyContentType | null>(null);
  const [workTopic, setWorkTopic] = useState("");
  const [workMaterials, setWorkMaterials] = useState("");
  const [workBody, setWorkBody] = useState("");
  const [workImageNotes, setWorkImageNotes] = useState("");
  const [workAttachments, setWorkAttachments] = useState<WorkAttachment[]>([]);
  const [workProgress, setWorkProgress] = useState<WorkProgress>("not_started");
  const [top3Work, setTop3Work] = useState<Top3Work>(emptyTop3);
  const workOpeningRef = useRef(false);
  const [startedWorkIds, setStartedWorkIds] = useState<string[]>([]);
  const [workSaveMessage, setWorkSaveMessage] = useState("");
  const workHydratingRef = useRef(false);
  const mapPreviewRef = useRef<HTMLImageElement | null>(null);

  const ready = useMemo(() => Boolean(data.name.trim() && data.recentPrice.trim() && mapDataUrl), [data.name, data.recentPrice, mapDataUrl]);
  const selectedArticleTheme = useMemo(
    () => selectArticleTheme(monthlyStats, articleThemeMode, recentArticleThemes, recommendedAngle),
    [monthlyStats, articleThemeMode, recentArticleThemes, recommendedAngle]
  );
  const thumbnailPrompt = useMemo(() => makeThumbnailPrompt(data, monthlyStats, selectedArticleTheme), [data, monthlyStats, selectedArticleTheme]);
  const priceImagePrompt = useMemo(() => makePriceImagePrompt(data, monthlyStats), [data, monthlyStats]);
  const locationImagePrompt = useMemo(() => makeLocationImagePrompt(data), [data]);
  const storyIdentity = apartmentStoryIdentity(data);
  const storyCurrent = storyState.identity === storyIdentity;
  const storyCandidates = storyCurrent ? storyState.candidates : [];
  const chosenStory = storyCandidates.find(item => item.id === storyState.selectedId) || null;
  const appliedStory = chosenStory && storyState.sourceChecked ? chosenStory : null;
  const storyResearchPrompt = useMemo(
    () => makeApartmentStoryResearchPrompt(data, selectedArticleTheme),
    [data, selectedArticleTheme]
  );
  const bodyPrompt = useMemo(
    () => makeBodyPrompt(data, monthlyStats, recommendedAngle, selectedArticleTheme, appliedStory),
    [data, monthlyStats, recommendedAngle, selectedArticleTheme, appliedStory]
  );
  const workGptPrompt = useMemo(
    () => makeSavedWorkPrompt(activeWorkType, workTopic, workMaterials, dailyDateKey),
    [activeWorkType, workTopic, workMaterials, dailyDateKey]
  );
  const workImagePrompts = useMemo<Record<WorkImageSlot, string>>(
    () => ({
      "00": makeSavedWorkImagePrompt("00", workTopic, workBody, workImageNotes),
      "01": makeSavedWorkImagePrompt("01", workTopic, workBody, workImageNotes),
      "02": makeSavedWorkImagePrompt("02", workTopic, workBody, workImageNotes),
    }),
    [workTopic, workBody, workImageNotes]
  );
  const workBodyReadyForImages = workBody.trim().length >= 80;
  const workTables = useMemo(() => extractMarkdownTables(workBody), [workBody]);
  const workTimeSeriesTable = useMemo(() => workTables.find(isTimeSeriesTable) || null, [workTables]);
  const workPrimaryTable = workTimeSeriesTable || workTables[0] || null;
  const workTableCount = workTables.length;
  const naverTables = useMemo(() => extractMarkdownTables(finalBlogText), [finalBlogText]);
  const markdownTableCount = naverTables.length;
  const naverTimeSeriesTable = useMemo(
    () => naverTables.find(isTimeSeriesTable) || null,
    [naverTables]
  );
  const naverBlocks = useMemo(
    () => parseNaverBlog(finalBlogText, tableHandlingMode),
    [finalBlogText, tableHandlingMode]
  );
  const dailyDoneCount = useMemo(() => dailySlots.filter((slot) => slot.done).length, [dailySlots]);
  const dailyBulkCount = useMemo(() => dailySlots.filter((slot) => slot.type === "bulk").length, [dailySlots]);
  const nextDailySlot = useMemo(() => dailySlots.find((slot) => !slot.done) || null, [dailySlots]);
  const activeWorkSlot = useMemo(
    () => dailySlots.find((slot) => slot.workId && slot.workId === activeWorkId) || null,
    [dailySlots, activeWorkId]
  );
  const filteredPublishHistory = useMemo(() => {
    const keyword = publishHistorySearch.trim().toLowerCase();
    return publishHistoryItems.filter((item) => {
      const typeMatch = publishHistoryFilter === "all" || item.content_type === publishHistoryFilter;
      const searchTarget = [item.title, item.complex_name || "", item.published_on].join(" ").toLowerCase();
      return typeMatch && (!keyword || searchTarget.includes(keyword));
    });
  }, [publishHistoryItems, publishHistoryFilter, publishHistorySearch]);

  async function loadPublishHistory() {
    setPublishHistoryLoading(true);
    setPublishHistoryMessage("");
    try {
      const res = await fetch("/api/publish-history", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "발행 이력 조회 실패");
      const items = Array.isArray(json.items)
        ? json.items.filter((item: unknown): item is PublishHistoryItem =>
            Boolean(item && typeof item === "object" && typeof (item as PublishHistoryItem).title === "string")
          )
        : [];
      setPublishHistoryItems(items);
      setPublishHistoryMessage(items.length ? "" : "저장된 발행 이력이 없습니다.");
    } catch (error) {
      setPublishHistoryMessage(error instanceof Error ? error.message : "발행 이력을 불러오지 못했습니다.");
    } finally {
      setPublishHistoryLoading(false);
    }
  }

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateKey = formatter.format(new Date());
    setDailyDateKey(dateKey);
    try {
      const persistentRaw = window.localStorage.getItem(PUBLISH_QUEUE_STORAGE_KEY);
      const legacyRaw = window.localStorage.getItem("apartment-bulk-daily-board-v1:" + dateKey);
      const raw = persistentRaw || legacyRaw;
      const saved = raw ? JSON.parse(raw) : null;

      if (Array.isArray(saved) && saved.length === 7) {
        const validTypes = new Set(Object.keys(DAILY_TYPE_META));
        const plan = DAILY_TOPIC_PLANS[dateKey] || {};
        const publishedTopics = getStoredPublishedTopics();
        const picked: string[] = [];
        const normalized = saved.map((slot, index) => {
          const planned = plan[index + 1];
          const savedType = validTypes.has(slot?.type) ? slot.type as DailyContentType : DEFAULT_DAILY_SLOTS[index].type;
          const savedTopic = typeof slot?.topic === "string" ? slot.topic.trim() : "";
          const savedDone = Boolean(slot?.done);
          const usableSavedTopic = savedTopic && (savedDone || !isPublishedTopic(savedTopic, publishedTopics)) ? savedTopic : "";
          const resolvedType = usableSavedTopic ? savedType : (planned?.type || savedType);
          const plannedTopic = planned?.topic && !isPublishedTopic(planned.topic, publishedTopics) ? planned.topic : "";
          const suggested = getDailyTopicSuggestion(resolvedType, dateKey, index + 1, publishedTopics, picked);
          const topic = usableSavedTopic || plannedTopic || suggested;
          if (topic) picked.push(topic);
          return {
            id: index + 1,
            type: resolvedType,
            done: savedDone,
            workId: typeof slot?.workId === "string" && slot.workId
              ? slot.workId
              : createWorkId(dateKey, index + 1),
            topic,
            complexId: typeof slot?.complexId === "string" ? slot.complexId : "",
            complexName: typeof slot?.complexName === "string" ? slot.complexName : "",
            candidateRegion: typeof slot?.candidateRegion === "string" ? slot.candidateRegion : "",
            candidateRegionGroup: typeof slot?.candidateRegionGroup === "string" ? slot.candidateRegionGroup : "",
            candidateArea: typeof slot?.candidateArea === "string" ? slot.candidateArea : "",
            candidateAngle: typeof slot?.candidateAngle === "string" ? slot.candidateAngle : "",
          };
        });
        setDailySlots(normalized);
        window.localStorage.setItem(PUBLISH_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
      } else {
        const next = makeDailySlots(dateKey, getStoredPublishedTopics());
        setDailySlots(next);
        window.localStorage.setItem(PUBLISH_QUEUE_STORAGE_KEY, JSON.stringify(next));
      }

      const persistentIndexRaw = window.localStorage.getItem(PUBLISH_QUEUE_WORK_INDEX_KEY);
      const legacyIndexRaw = window.localStorage.getItem("apartment-bulk-work-index-v1:" + dateKey);
      const indexRaw = persistentIndexRaw || legacyIndexRaw;
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      const normalizedIndex = Array.isArray(index) ? index.filter((item): item is string => typeof item === "string") : [];
      setStartedWorkIds(normalizedIndex);
      window.localStorage.setItem(PUBLISH_QUEUE_WORK_INDEX_KEY, JSON.stringify(normalizedIndex));

      const legacyActive = window.localStorage.getItem("apartment-bulk-active-work-v1:" + dateKey) || "";
      if (!window.localStorage.getItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY) && legacyActive) {
        window.localStorage.setItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY, legacyActive);
      }
    } catch {
      setDailySlots(makeDailySlots(dateKey, getStoredPublishedTopics()));
      setStartedWorkIds([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydratePublishedHistory() {
      try {
        const localTopics = getStoredPublishedTopics();
        const localComplexes = getStoredPublishedComplexes();
        const localItems = [
          ...localTopics.map((title) => ({ itemType: "topic", title, source: "local-migration" })),
          ...localComplexes.map((item) => ({
            itemType: "complex",
            title: item.name,
            complexId: item.id,
            complexName: item.name,
            contentType: "bulk",
            source: "local-migration",
          })),
        ];

        if (localItems.length) {
          await fetch("/api/publish-history", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: localItems }),
          });
        }

        const res = await fetch("/api/publish-history", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || cancelled) return;

        const serverTopics = Array.isArray(json.topics)
          ? json.topics.filter((item: unknown): item is string => typeof item === "string")
          : [];
        const mergedTopics = Array.from(new Set([...localTopics, ...serverTopics]));
        window.localStorage.setItem(PUBLISHED_TOPIC_STORAGE_KEY, JSON.stringify(mergedTopics));

        const serverComplexes = Array.isArray(json.complexes)
          ? json.complexes.filter((item: unknown): item is { id: string; name: string } =>
              Boolean(item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string")
            )
          : [];
        const byName = new Map<string, { id: string; name: string }>();
        [...localComplexes, ...serverComplexes].forEach((item) => {
          if (!item?.name) return;
          const key = normalizeComplexName(item.name);
          const previous = byName.get(key);
          byName.set(key, {
            id: item.id || previous?.id || "",
            name: item.name,
          });
        });
        window.localStorage.setItem(PUBLISHED_COMPLEX_STORAGE_KEY, JSON.stringify([...byName.values()]));
      } catch {
        // DB 동기화가 실패해도 기존 로컬 발행 이력은 그대로 사용합니다.
      }
    }

    void hydratePublishedHistory();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dailyDateKey || dailyApartmentLoadingRef.current || dailyApartmentLoadedDateRef.current === dailyDateKey) return;
    const missingBulkSlots = dailySlots.filter((slot) => slot.type === "bulk" && !slot.done && !slot.complexId);

    dailyApartmentLoadingRef.current = true;
    fetch("/api/apartment/daily-picks?date=" + encodeURIComponent(dailyDateKey) + "&limit=48", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "오늘의 단지 후보 조회 실패");
        return (json.candidates || []) as DailyApartmentCandidate[];
      })
      .then((candidates) => {
        setDailyApartmentCandidates(candidates);
        const published = getStoredPublishedComplexes();
        const existingIds = new Set(dailySlots.map((slot) => slot.complexId || "").filter(Boolean));
        const existingGroups = new Set(dailySlots.map((slot) => slot.candidateRegionGroup || "").filter(Boolean));
        const available = candidates.filter((candidate) => !isPublishedComplex(candidate, published) && !existingIds.has(candidate.id));
        const next = dailySlots.map((slot) => ({ ...slot }));

        for (const slot of next) {
          if (slot.type !== "bulk" || slot.done || slot.complexId) continue;
          let pick = available.find((candidate) => !existingIds.has(candidate.id) && !existingGroups.has(candidate.regionGroup));
          if (!pick) pick = available.find((candidate) => !existingIds.has(candidate.id));
          if (!pick) break;
          slot.complexId = pick.id;
          slot.complexName = pick.name;
          slot.candidateRegion = pick.regionLabel;
          slot.candidateRegionGroup = pick.regionGroup;
          slot.candidateArea = pick.representativeArea || "";
          slot.candidateAngle = pick.recommendedAngle;
          slot.topic = formatDailyApartmentTopic(pick);
          existingIds.add(pick.id);
          existingGroups.add(pick.regionGroup);
        }
        saveDailySlots(next);
        dailyApartmentLoadedDateRef.current = dailyDateKey;
      })
      .catch(() => {
        dailyApartmentLoadedDateRef.current = dailyDateKey;
      })
      .finally(() => {
        dailyApartmentLoadingRef.current = false;
      });
  }, [dailyDateKey, dailySlots]);

  useEffect(() => {
    if (!dailyDateKey || activeWorkId || !dailySlots.some((slot) => slot.workId)) return;
    try {
      const lastActive = window.localStorage.getItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY) || "";
      const slot = dailySlots.find((item) => item.workId === lastActive);
      if (slot) void openDailyWork(slot, false);
    } catch {
      // 자동 이어하기가 실패해도 작업판은 그대로 사용합니다.
    }
  }, [dailyDateKey, dailySlots, activeWorkId]);

  useEffect(() => {
    if (!activeWorkId || !activeWorkType || workHydratingRef.current) return;
    const timer = window.setTimeout(() => {
      void persistActiveWork();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    activeWorkId,
    activeWorkType,
    workTopic,
    workMaterials,
    workBody,
    workImageNotes,
    workAttachments,
    workProgress,
    top3Work,
    data,
    monthlyStats,
    mapDataUrl,
    aptPoint,
    stationPoint,
    outputs,
    selectedComplexName,
    recommendedAngle,
    articleThemeMode,
    autoMapGenerated,
    autoMapMessage,
    nearbyMessage,
    finalBlogText,
    storyState,
  ]);

  // 독립 단지 편집 시에는 단지·지역별로 보관하고, 발행 큐는 기존 IndexedDB 작업 스냅샷에 저장한다.
  useEffect(() => {
    if (activeWorkId || !data.name.trim() || !data.region.trim()) return;
    try {
      const raw = window.localStorage.getItem(APARTMENT_STORY_STORAGE_PREFIX + storyIdentity);
      const saved = raw ? JSON.parse(raw) as StoryWork : null;
      setStoryState(saved?.identity === storyIdentity ? saved : emptyApartmentStory(storyIdentity));
    } catch {
      setStoryState(emptyApartmentStory(storyIdentity));
    }
  }, [activeWorkId, storyIdentity]);

  useEffect(() => {
    if (activeWorkId || !data.name.trim() || !data.region.trim() || !storyCurrent) return;
    try {
      window.localStorage.setItem(APARTMENT_STORY_STORAGE_PREFIX + storyIdentity, JSON.stringify(storyState));
    } catch {
      // 스토리 로컬 저장 실패로 기존 실거래 제작을 막지 않는다.
    }
  }, [activeWorkId, data.name, data.region, storyIdentity, storyCurrent, storyState]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("apartment-bulk-theme-history-v1") || "[]");
      if (Array.isArray(saved)) {
        const valid = saved.filter((item): item is ArticleThemeId => Object.prototype.hasOwnProperty.call(ARTICLE_THEME_META, item));
        setRecentArticleThemes(valid.slice(-6));
      }
    } catch {
      setRecentArticleThemes([]);
    }
  }, []);

  async function searchPhotoCandidates(name: string, region: string, start = 1) {
    if (!name.trim()) return;
    setPhotoCandidatesLoading(true);
    setPhotoSearchMessage("단지 참고 사진을 찾는 중…");
    try {
      const params = new URLSearchParams({
        query: name.trim(),
        region: region.trim(),
        start: String(start),
      });
      const res = await fetch("/api/apartment/photo-search?" + params.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "사진 검색 실패");
      const items = (json.items || []) as PhotoCandidate[];
      setPhotoCandidates(items);
      setPhotoSearchStart(start);
      setPhotoSearchMessage(items.length ? "검색 사진 3장은 외관 확인 참고용입니다." : "검색 사진을 찾지 못했습니다.");
    } catch (e) {
      setPhotoCandidates([]);
      setPhotoSearchMessage(e instanceof Error ? e.message : "사진 자동 검색에 실패했습니다. 직접 업로드할 수 있습니다.");
    } finally {
      setPhotoCandidatesLoading(false);
    }
  }


  useEffect(() => {
    const complexId = new URLSearchParams(window.location.search).get("complexId");
    if (!complexId) return;
    setSelectedComplexLoading(true);
    fetch("/api/apartment/complexes/" + encodeURIComponent(complexId), { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "단지 데이터를 불러오지 못했습니다.");
        return json as ComplexDetailResponse;
      })
      .then(async (detail) => {
        const firstMedian = detail.snapshot?.first_median_price == null ? null : Number(detail.snapshot.first_median_price);
        const recent = detail.latestTrade?.price ?? (detail.snapshot?.latest_median_price == null ? null : Number(detail.snapshot.latest_median_price));
        const region = [detail.complex.sido, detail.complex.sigungu, detail.complex.legal_dong].filter(Boolean).join(" ");
        const nextData: ApartmentData = {
          ...SAMPLE,
          name: detail.complex.name || SAMPLE.name,
          region: region || SAMPLE.region,
          area: detail.representativeArea ? "전용 " + detail.representativeArea : SAMPLE.area,
          recentPrice: recent ? formatWon(recent) : SAMPLE.recentPrice,
          previousPrice: firstMedian ? "6개월 전 대표값 " + formatWon(firstMedian) : SAMPLE.previousPrice,
          households: detail.complex.households ? detail.complex.households.toLocaleString("ko-KR") + "세대" : SAMPLE.households,
          moveIn: detail.complex.use_date ? detail.complex.use_date.slice(0, 7).replace("-", "년 ") + "월" : SAMPLE.moveIn,
          station: "",
          locationLine: "",
          question: "",
          thumbnailTone: "auto",
        };
        setData(nextData);
        setMonthlyStats(detail.monthly || []);
        setSelectedComplexName(detail.complex.name || "");
        setRecommendedAngle(detail.snapshot?.recommended_angle || "");
        setArticleThemeMode("auto");
        setOutputs(null);

        setNearbyLoading(true);
        setNearbyMessage("가까운 주요 역을 자동으로 찾는 중…");
        void fetch("/api/apartment/nearby?complexId=" + encodeURIComponent(complexId), { cache: "no-store" })
          .then(async (nearbyRes) => {
            const nearbyJson = await nearbyRes.json();
            if (!nearbyRes.ok) throw new Error(nearbyJson.error || "가까운 역 검색 실패");
            setData((prev) => ({
              ...prev,
              station: nearbyJson.station || prev.station,
              locationLine: nearbyJson.locationLine || prev.locationLine,
            }));
            if (nearbyJson.station) {
              const distance = Number(nearbyJson.distanceMeters);
              const distanceText = Number.isFinite(distance) ? ` · 직선거리 약 ${distance.toLocaleString("ko-KR")}m` : "";
              setNearbyMessage(`✅ ${nearbyJson.station} 자동 입력 완료${distanceText}`);
            } else {
              setNearbyMessage("ℹ️ 가까운 역을 찾지 못해 입지 정보는 직접 확인해 주세요.");
            }
          })
          .catch((e) => {
            setNearbyMessage(e instanceof Error ? "ℹ️ " + e.message : "ℹ️ 가까운 역 자동 검색에 실패했습니다.");
          })
          .finally(() => setNearbyLoading(false));

        setAutoMapLoading(true);
        setAutoMapMessage("네이버 지도를 자동으로 만드는 중…");
        setAutoMapGenerated(false);
        try {
          const mapRes = await fetch("/api/apartment/map?complexId=" + encodeURIComponent(complexId), { cache: "no-store" });
          if (!mapRes.ok) {
            const errorJson = await mapRes.json().catch(() => ({}));
            throw new Error(errorJson.error || "지도 자동 생성 실패");
          }
          const mapBlob = await mapRes.blob();
          setMapDataUrl(await blobToDataUrl(mapBlob));
          setAptPoint(null);
          setStationPoint(null);
          setAutoMapGenerated(true);
          setAutoMapMessage("단지 위치가 표시된 네이버 지도를 자동으로 불러왔습니다.");
        } catch (e) {
          setAutoMapMessage(e instanceof Error ? e.message : "지도 자동 생성에 실패했습니다. 직접 업로드할 수 있습니다.");
        } finally {
          setAutoMapLoading(false);
        }
      })
      .catch(() => {})
      .finally(() => setSelectedComplexLoading(false));
  }, []);

  function update<K extends keyof ApartmentData>(key: K, value: ApartmentData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setOutputs(null);
  }

  function saveDailySlots(next: DailySlot[]) {
    setDailySlots(next);
    try {
      window.localStorage.setItem(PUBLISH_QUEUE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장이 막혀 있어도 화면에서는 계속 사용할 수 있습니다.
    }
  }

  function updateDailyType(id: number, type: DailyContentType) {
    const excluded = dailySlots.filter((slot) => slot.id !== id).map((slot) => slot.topic || "").filter(Boolean);
    const nextTopic = getDailyTopicSuggestion(
      type,
      dailyDateKey || new Date().toISOString().slice(0, 10),
      id,
      getStoredPublishedTopics(),
      excluded
    );
    saveDailySlots(dailySlots.map((slot) => slot.id === id ? { ...slot, type, topic: nextTopic } : slot));
    if (activeWorkSlot?.id === id) {
      setActiveWorkType(type);
      setWorkTopic(nextTopic);
    }
  }

  function recommendAnotherApartment(id: number) {
    const slot = dailySlots.find((item) => item.id === id);
    if (!slot || slot.type !== "bulk" || !dailyApartmentCandidates.length) return;
    const published = getStoredPublishedComplexes();
    const usedIds = new Set(dailySlots.filter((item) => item.id !== id).map((item) => item.complexId || "").filter(Boolean));
    const usedGroups = new Set(dailySlots.filter((item) => item.id !== id).map((item) => item.candidateRegionGroup || "").filter(Boolean));
    const available = dailyApartmentCandidates.filter((candidate) =>
      !isPublishedComplex(candidate, published) &&
      !usedIds.has(candidate.id) &&
      candidate.id !== slot.complexId
    );
    const pick = available.find((candidate) => !usedGroups.has(candidate.regionGroup)) || available[0];
    if (!pick) return;
    saveDailySlots(dailySlots.map((item) => item.id === id ? {
      ...item,
      complexId: pick.id,
      complexName: pick.name,
      candidateRegion: pick.regionLabel,
      candidateRegionGroup: pick.regionGroup,
      candidateArea: pick.representativeArea || "",
      candidateAngle: pick.recommendedAngle,
      topic: formatDailyApartmentTopic(pick),
    } : item));
  }

  function recommendAnotherTopic(id: number) {
    const slot = dailySlots.find((item) => item.id === id);
    if (!slot) return;
    const pool = DAILY_TOPIC_POOLS[slot.type] || [];
    if (!pool.length) return;
    const publishedTopics = getStoredPublishedTopics();
    const usedToday = dailySlots.filter((item) => item.id !== id).map((item) => item.topic || "").filter(Boolean);
    const available = pool.filter((topic) => !isPublishedTopic(topic, publishedTopics) && !usedToday.some((used) => normalizeTopicKey(used) === normalizeTopicKey(topic)));
    if (!available.length) return;
    const currentIndex = available.findIndex((topic) => normalizeTopicKey(topic) === normalizeTopicKey(slot.topic || ""));
    const fallback = dailyTopicSeed(dailyDateKey || "today", id) % available.length;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % available.length : fallback;
    const topic = available[nextIndex];
    saveDailySlots(dailySlots.map((item) => item.id === id ? { ...item, topic } : item));
    if (activeWorkSlot?.id === id) setWorkTopic(topic);
  }

  function toggleDailyDone(id: number) {
    const target = dailySlots.find((slot) => slot.id === id);
    if (!target) return;
    const nextDone = !target.done;
    if (target.topic && target.type !== "bulk") savePublishedTopic(target.topic, nextDone, target.type);
    if (target.type === "bulk" && target.complexId && target.complexName) {
      savePublishedComplex(target.complexId, target.complexName, nextDone);
    }
    saveDailySlots(dailySlots.map((slot) => slot.id === id ? { ...slot, done: nextDone } : slot));
    if (publishHistoryItems.length) {
      window.setTimeout(() => { void loadPublishHistory(); }, 250);
    }
  }

  function replaceCompletedSlot(id: number) {
    const slot = dailySlots.find((item) => item.id === id);
    if (!slot || !slot.done) return;

    const dateKey = dailyDateKey || new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    let replacement: Partial<DailySlot> | null = null;

    if (slot.type === "bulk") {
      const published = getStoredPublishedComplexes();
      const usedIds = new Set(dailySlots.filter((item) => item.id !== id).map((item) => item.complexId || "").filter(Boolean));
      const usedGroups = new Set(dailySlots.filter((item) => item.id !== id).map((item) => item.candidateRegionGroup || "").filter(Boolean));
      const available = dailyApartmentCandidates.filter((candidate) =>
        !isPublishedComplex(candidate, published) &&
        !usedIds.has(candidate.id)
      );
      const pick = available.find((candidate) => !usedGroups.has(candidate.regionGroup)) || available[0];
      if (!pick) return;
      replacement = {
        complexId: pick.id,
        complexName: pick.name,
        candidateRegion: pick.regionLabel,
        candidateRegionGroup: pick.regionGroup,
        candidateArea: pick.representativeArea || "",
        candidateAngle: pick.recommendedAngle,
        topic: formatDailyApartmentTopic(pick),
      };
    } else {
      const pool = DAILY_TOPIC_POOLS[slot.type] || [];
      const publishedTopics = getStoredPublishedTopics();
      const usedTopics = dailySlots
        .filter((item) => item.id !== id)
        .map((item) => item.topic || "")
        .filter(Boolean);
      const available = pool.filter((topic) =>
        !isPublishedTopic(topic, publishedTopics) &&
        !usedTopics.some((used) => normalizeTopicKey(used) === normalizeTopicKey(topic))
      );
      const topic = available.length ? available[dailyTopicSeed(dateKey, id) % available.length] : "";
      replacement = {
        topic,
        complexId: "",
        complexName: "",
        candidateRegion: "",
        candidateRegionGroup: "",
        candidateArea: "",
        candidateAngle: "",
      };
    }

    const oldWorkId = slot.workId;
    const nextWorkId = createWorkId(dateKey, id);
    const nextSlots = dailySlots.map((item) => item.id === id ? {
      ...item,
      ...replacement,
      done: false,
      workId: nextWorkId,
    } : item);
    saveDailySlots(nextSlots);

    const nextStarted = startedWorkIds.filter((workId) => workId !== oldWorkId);
    setStartedWorkIds(nextStarted);
    try {
      window.localStorage.setItem(PUBLISH_QUEUE_WORK_INDEX_KEY, JSON.stringify(nextStarted));
      if (window.localStorage.getItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY) === oldWorkId) {
        window.localStorage.removeItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY);
      }
    } catch {
      // 교체 후 작업 인덱스 정리 실패는 새 작업 생성을 막지 않습니다.
    }

    if (activeWorkId === oldWorkId) {
      setActiveWorkId("");
      setActiveWorkType(null);
      setWorkTopic("");
      setWorkMaterials("");
      setWorkBody("");
      setWorkImageNotes("");
      setWorkAttachments([]);
      setWorkProgress("not_started");
      setTop3Work(emptyTop3());
      setWorkSaveMessage("");
    }
  }

  function resetDailyBoard() {
    const next = makeDailySlots(dailyDateKey || new Date().toISOString().slice(0, 10), getStoredPublishedTopics());
    dailyApartmentLoadedDateRef.current = "";
    saveDailySlots(next);
    setActiveWorkId("");
    setActiveWorkType(null);
    setWorkTopic("");
    setWorkMaterials("");
    setWorkBody("");
    setWorkImageNotes("");
    setWorkAttachments([]);
    setWorkProgress("not_started");
    setTop3Work(emptyTop3());
    setStoryState(emptyApartmentStory());
    setStoryNotice("");
    setWorkSaveMessage("");
    setStartedWorkIds([]);
    try {
      window.localStorage.removeItem(PUBLISH_QUEUE_WORK_INDEX_KEY);
      window.localStorage.removeItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY);
    } catch {
      // 초기화는 화면 기준으로 계속 진행합니다.
    }
  }

  function markWorkStarted(workId: string) {
    if (!workId) return;
    const next = Array.from(new Set([...startedWorkIds, workId]));
    setStartedWorkIds(next);
    try {
      window.localStorage.setItem(PUBLISH_QUEUE_WORK_INDEX_KEY, JSON.stringify(next));
      window.localStorage.setItem(PUBLISH_QUEUE_ACTIVE_WORK_KEY, workId);
    } catch {
      // 인덱스 저장 실패는 본문 작업 저장을 막지 않습니다.
    }
  }

  function startDailySlot(slot: DailySlot) {
    if (slot.type === "bulk" && slot.complexId && !startedWorkIds.includes(slot.workId)) {
      markWorkStarted(slot.workId);
      window.location.assign("/apartment-bulk?complexId=" + encodeURIComponent(slot.complexId));
      return;
    }
    void openDailyWork(slot);
  }

  function buildActiveWorkSnapshot(): DailyWorkSnapshot | null {
    if (!activeWorkId || !activeWorkType) return null;
    const slot = dailySlots.find((item) => item.workId === activeWorkId);
    if (!slot) return null;
    const isBulk = activeWorkType === "bulk";
    return {
      workId: activeWorkId,
      dateKey: dailyDateKey,
      slotId: slot.id,
      contentType: activeWorkType,
      topic: workTopic,
      materials: workMaterials,
      body: isBulk ? finalBlogText : workBody,
      imageNotes: workImageNotes,
      attachments: workAttachments,
      progress: workProgress,
      top3: top3Work,
      updatedAt: new Date().toISOString(),
      bulk: isBulk ? {
        data,
        monthlyStats,
        mapDataUrl,
        aptPoint,
        stationPoint,
        outputs,
        selectedComplexName,
        recommendedAngle,
        articleThemeMode,
        autoMapGenerated,
        autoMapMessage,
        nearbyMessage,
        story: storyCurrent ? storyState : emptyApartmentStory(storyIdentity),
      } : undefined,
    };
  }

  async function persistActiveWork() {
    const snapshot = buildActiveWorkSnapshot();
    if (!snapshot || workHydratingRef.current) return;
    try {
      setWorkSaveMessage("저장 중…");
      await writeWorkSnapshot(snapshot);
      markWorkStarted(snapshot.workId);
      setWorkSaveMessage("자동 저장됨");
      return true;
    } catch (error) {
      setWorkSaveMessage(error instanceof Error ? "저장 실패 · " + error.message : "저장 실패");
      return false;
    }
  }

  function resetBulkWorkspace() {
    setData(SAMPLE);
    setMonthlyStats([]);
    setMapDataUrl("");
    setAptPoint(null);
    setStationPoint(null);
    setOutputs(null);
    setSelectedComplexName("");
    setRecommendedAngle("");
    setArticleThemeMode("auto");
    setAutoMapGenerated(false);
    setAutoMapMessage("");
    setNearbyMessage("");
    setFinalBlogText("");
    setStoryState(emptyApartmentStory());
    setStoryNotice("");
  }

  async function openDailyWork(slot: DailySlot, scroll = true) {
    if (!slot.workId || workOpeningRef.current) return;
    workOpeningRef.current = true;
    if (activeWorkId && activeWorkId !== slot.workId) {
      const saved = await persistActiveWork();
      if (!saved) { workOpeningRef.current = false; return; }
    }

    workHydratingRef.current = true;
    setWorkSaveMessage("작업 불러오는 중…");
    try {
      const saved = await readWorkSnapshot(slot.workId);
      setActiveWorkId(slot.workId);
      setActiveWorkType(slot.type);

      if (saved) {
        setWorkTopic(saved.topic || "");
        setWorkMaterials(saved.materials || "");
        setWorkBody(saved.body || "");
        if (slot.type !== "bulk" && slot.type !== "top3") {
          setFinalBlogText(saved.body || "");
        }
        setWorkImageNotes(saved.imageNotes || "");
        setWorkAttachments(Array.isArray(saved.attachments) ? saved.attachments : []);
        setWorkProgress(saved.progress || "preparing");
        setTop3Work(normalizeTop3(saved.top3));
        if (slot.type !== "bulk") setStoryState(emptyApartmentStory());

        if (slot.type === "bulk" && saved.bulk) {
          setData(saved.bulk.data || SAMPLE);
          setMonthlyStats(saved.bulk.monthlyStats || []);
          setMapDataUrl(saved.bulk.mapDataUrl || "");
          setAptPoint(saved.bulk.aptPoint || null);
          setStationPoint(saved.bulk.stationPoint || null);
          setOutputs(saved.bulk.outputs || null);
          setSelectedComplexName(saved.bulk.selectedComplexName || "");
          setRecommendedAngle(saved.bulk.recommendedAngle || "");
          setArticleThemeMode(saved.bulk.articleThemeMode || "auto");
          setAutoMapGenerated(Boolean(saved.bulk.autoMapGenerated));
          setAutoMapMessage(saved.bulk.autoMapMessage || "");
          setNearbyMessage(saved.bulk.nearbyMessage || "");
          setFinalBlogText(saved.body || "");
          const restoredIdentity = apartmentStoryIdentity(saved.bulk.data || SAMPLE);
          setStoryState(saved.bulk.story?.identity === restoredIdentity ? saved.bulk.story : emptyApartmentStory(restoredIdentity));
          setStoryNotice("");
        } else if (slot.type === "bulk") {
          resetBulkWorkspace();
        }
        markWorkStarted(slot.workId);
        setWorkSaveMessage("저장된 작업 복원됨");
      } else {
        setWorkTopic(slot.topic || "");
        setWorkMaterials("");
        setWorkBody("");
        if (slot.type !== "bulk" && slot.type !== "top3") {
          setFinalBlogText("");
        }
        setWorkImageNotes("");
        setWorkAttachments([]);
        setWorkProgress("preparing");
        setTop3Work(emptyTop3());
        setStoryState(emptyApartmentStory());
        if (slot.type === "bulk") {
          const queryComplexId = new URLSearchParams(window.location.search).get("complexId");
          if (!queryComplexId || queryComplexId !== slot.complexId) resetBulkWorkspace();
        }
        markWorkStarted(slot.workId);
        setWorkSaveMessage("새 작업 시작");
      }
    } catch (error) {
      setWorkSaveMessage(error instanceof Error ? "불러오기 실패 · " + error.message : "불러오기 실패");
    } finally {
      window.setTimeout(() => {
        workHydratingRef.current = false;
        workOpeningRef.current = false;
        if (scroll) document.getElementById("active-work")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

  async function addWorkAttachments(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (!files.length) return;
    const converted = await Promise.all(files.map(async (file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      dataUrl: await fileToDataUrl(file),
    })));
    setWorkAttachments((prev) => [...prev, ...converted].slice(0, 6));
    e.target.value = "";
  }

  function removeWorkAttachment(index: number) {
    setWorkAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function copyThumbnailPrompt() {
    try {
      await navigator.clipboard.writeText(thumbnailPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  }

  function openThumbnailPromptInChatGPT() {
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(thumbnailPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyPriceImagePrompt() {
    try {
      await navigator.clipboard.writeText(priceImagePrompt);
      setPricePromptCopied(true);
      window.setTimeout(() => setPricePromptCopied(false), 1800);
    } catch {
      setPricePromptCopied(false);
    }
  }

  function openPriceImagePromptInChatGPT() {
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(priceImagePrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLocationImagePrompt() {
    try {
      await navigator.clipboard.writeText(locationImagePrompt);
      setLocationPromptCopied(true);
      window.setTimeout(() => setLocationPromptCopied(false), 1800);
    } catch {
      setLocationPromptCopied(false);
    }
  }

  async function copyMapCaptureToClipboard() {
    if (!mapDataUrl) {
      setMapCopyMessage("지도 준비가 먼저 필요합니다.");
      return false;
    }
    try {
      const [header, encoded] = mapDataUrl.split(",", 2);
      const mime = header.match(/^data:([^;]+)/)?.[1] || "image/png";
      if (mime !== "image/png") throw new Error("PNG 지도만 바로 복사할 수 있습니다.");
      const binary = atob(encoded || "");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMapCopyMessage("✅ 지도 캡처가 복사됐습니다. ChatGPT에서 Ctrl+V로 붙여넣으세요.");
      return true;
    } catch (error) {
      setMapCopyMessage(error instanceof Error ? "ℹ️ " + error.message : "ℹ️ 지도 복사에 실패했습니다.");
      return false;
    }
  }

  function openLocationImagePromptInChatGPT() {
    const chatWindow = window.open("about:blank", "_blank");
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(locationImagePrompt);
    void copyMapCaptureToClipboard().finally(() => {
      if (chatWindow) chatWindow.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  async function copyStoryResearchPrompt() {
    try {
      await navigator.clipboard.writeText(storyResearchPrompt);
      setStoryNotice("동네 스토리 조사 요청서를 복사했습니다.");
    } catch {
      setStoryNotice("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  function openStoryResearchPrompt() {
    window.open("https://chatgpt.com/?q=" + encodeURIComponent(storyResearchPrompt), "_blank", "noopener,noreferrer");
  }

  function importStoryResearch() {
    try {
      const candidates = parseApartmentStoryResearch(storyCurrent ? storyState.raw : "");
      setStoryState(prev => ({
        ...prev,
        identity: storyIdentity,
        candidates,
        selectedId: "",
        sourceChecked: false,
      }));
      setStoryNotice(candidates.length
        ? "근거 URL이 있는 후보 " + candidates.length + "개를 가져왔습니다. 원문 확인 후 하나만 선택해 주세요."
        : "관련성 있는 후보가 없습니다. 스토리를 생략하고 기존 실거래 분석을 작성할 수 있습니다.");
    } catch (error) {
      setStoryNotice(error instanceof Error ? error.message : "조사 결과를 읽지 못했습니다.");
    }
  }

  async function copyBodyPrompt() {
    try {
      await navigator.clipboard.writeText(bodyPrompt);
      setBodyPromptCopied(true);
      window.setTimeout(() => setBodyPromptCopied(false), 1800);
    } catch {
      setBodyPromptCopied(false);
    }
  }

  async function copyWorkGptPrompt() {
    try {
      await navigator.clipboard.writeText(workGptPrompt);
      setWorkPromptCopied(true);
      window.setTimeout(() => setWorkPromptCopied(false), 1800);
    } catch {
      setWorkPromptCopied(false);
    }
  }

  function openWorkGptPromptInChatGPT() {
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(workGptPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyWorkImagePrompt(slot: WorkImageSlot) {
    if (!workBodyReadyForImages) return;
    try {
      await navigator.clipboard.writeText(workImagePrompts[slot]);
      setWorkImagePromptCopied(slot);
      window.setTimeout(() => setWorkImagePromptCopied(""), 1800);
    } catch {
      setWorkImagePromptCopied("");
    }
  }

  function openWorkImagePromptInChatGPT(slot: WorkImageSlot) {
    if (!workBodyReadyForImages) return;
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(workImagePrompts[slot]);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openBodyPromptInChatGPT() {
    const nextHistory = [...recentArticleThemes, selectedArticleTheme.id].slice(-6);
    setRecentArticleThemes(nextHistory);
    try {
      window.localStorage.setItem("apartment-bulk-theme-history-v1", JSON.stringify(nextHistory));
    } catch {
      // localStorage가 막혀 있어도 본문 생성은 계속 진행합니다.
    }
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(bodyPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyNaverRichText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("ChatGPT 완성글을 먼저 붙여넣어 주세요.");
      return;
    }

    const plain = naverPlainText(naverBlocks);
    const html = naverRichHtml(naverBlocks);

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        setNaverCopyMessage("✅ 서식 포함 전체복사 완료 · 네이버에 Ctrl+V 하세요.");
      } else {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("ℹ️ 브라우저 제한으로 한줄띄기 텍스트로 복사했습니다.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("ℹ️ 서식 복사가 제한되어 한줄띄기 텍스트로 복사했습니다.");
      } catch {
        setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
      }
    }
  }

  async function copyNaverSafeText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("ChatGPT 완성글을 먼저 붙여넣어 주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(naverPlainText(naverBlocks));
      setNaverCopyMessage("✅ 한줄띄기 안전복사 완료 · 폰트는 네이버 기본 설정을 사용합니다.");
    } catch {
      setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  async function handleMap(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMapDataUrl(await fileToDataUrl(file));
    setAptPoint(null);
    setStationPoint(null);
    setAutoMapGenerated(false);
    setAutoMapMessage("직접 올린 지도 이미지를 사용합니다.");
    setOutputs(null);
  }

  function markOnMap(e: MouseEvent<HTMLDivElement>) {
    if (!markMode || !mapPreviewRef.current) return;
    const imgRect = mapPreviewRef.current.getBoundingClientRect();
    if (e.clientX < imgRect.left || e.clientX > imgRect.right || e.clientY < imgRect.top || e.clientY > imgRect.bottom) return;
    const point = {
      x: (e.clientX - imgRect.left) / imgRect.width,
      y: (e.clientY - imgRect.top) / imgRect.height,
    };
    if (markMode === "apt") setAptPoint(point);
    else setStationPoint(point);
    setMarkMode(null);
    setOutputs(null);
  }

  async function generate() {
    if (!ready) return;
    setLoading(true);
    try {
      const price = makePriceCard(data, monthlyStats);
      const map = await makeMapCard(data, mapDataUrl, aptPoint, stationPoint);
      setOutputs({ price, map });
      requestAnimationFrame(() => document.getElementById("outputs")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!outputs) return;
    const zip = new JSZip();
    zip.file("01_price.png", dataUrlBase64(outputs.price), { base64: true });
    zip.file("02_location.png", dataUrlBase64(outputs.map), { base64: true });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.name || "apartment").replace(/\s+/g, "_")}_body_images.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <a href="/" className={styles.back}>← 콘텐츠 메이커</a>
        <span className={styles.modeBadge}>아파트 콘텐츠 작업실</span>
      </div>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>집값쓱 APARTMENT CONTENT STUDIO</p>
          <h1>오늘 만들 콘텐츠만 고르면<br />작업 화면이 깔끔하게 열립니다.</h1>
          <p>단지 대량발행 · 학군 아파트 · 수도권 초대형단지를 한 곳에서 작업합니다.</p>
        </div>
        <a href="/apartment-bulk/discover" className={styles.heroChip}>오늘 쓸 단지 찾기 →</a>
      </section>

      <nav className={styles.contentTabs} aria-label="아파트 콘텐츠 종류">
        <button type="button" className={contentMode === "bulk" ? styles.contentTabActive : styles.contentTab} onClick={() => setContentMode("bulk")}>
          <b>단지 대량발행</b><small>실거래·가격 흐름</small>
        </button>
        <button type="button" className={contentMode === "school" ? styles.contentTabActive : styles.contentTab} onClick={() => setContentMode("school")}>
          <b>학군 아파트</b><small>34평대·학원가 비교</small>
        </button>
        <button type="button" className={contentMode === "mega" ? styles.contentTabActive : styles.contentTab} onClick={() => setContentMode("mega")}>
          <b>수도권 초대형단지</b><small>세대수·34평대 분석</small>
        </button>
      </nav>

      {contentMode === "bulk" && (
      <section className={styles.dailyBoard}>
        <div className={styles.dailyBoardHead}>
          <div>
            <p className={styles.eyebrow}>PUBLISH QUEUE · 7 POSTS</p>
            <h2>발행 큐 7개 <strong>{dailyDoneCount}/7 완료</strong></h2>
            <span>날짜가 바뀌어도 유지 · 완료한 카드만 갈아끼우기</span>
          </div>
          <div className={styles.dailyBoardActions}>
            <div className={styles.dailyProgressText}>{dailyDoneCount === 7 ? "7개 완료 · 갈아끼우기 준비" : nextDailySlot ? `다음 · ${nextDailySlot.id}번 ${DAILY_TYPE_META[nextDailySlot.type].short}` : "발행 큐 완료"}</div>
          </div>
        </div>

        <div className={styles.dailyProgressTrack} aria-label={`오늘 발행 진행률 ${dailyDoneCount}/7`}>
          <span style={{ width: `${(dailyDoneCount / 7) * 100}%` }} />
        </div>

        <div className={styles.dailySlots}>
          {dailySlots.map((slot) => {
            const title = slot.type === "bulk"
              ? (slot.topic || "오늘의 단지 후보를 불러오는 중…")
              : slot.topic || "주제 직접 입력";
            const description =
              slot.type === "bulk" ? (slot.complexId ? "실거래 후보 데이터로 자동 선정" : "후보 데이터 확인 중") :
              slot.type === "top3" ? "지역 검색 유입을 노리는 순위형 글" :
              slot.type === "tip" ? "오래 검색되는 부동산·재테크 정보" :
              slot.type === "power" ? "당일 시장 흐름을 깊게 설명" :
              DAILY_TYPE_META[slot.type].label;

            return (
              <article key={slot.id} className={slot.done ? styles.dailySlotDone : styles.dailySlot}>
                <div className={styles.dailySlotTop}>
                  <div className={styles.dailySlotNumber}>{slot.done ? "✓" : String(slot.id).padStart(2, "0")}</div>
                  <span className={styles.dailyTypeChip}>{DAILY_TYPE_META[slot.type].short}</span>
                  {slot.done && <span className={styles.dailyDoneLabel}>발행 완료</span>}
                </div>
                <div className={styles.dailySlotMain}>
                  <b className={styles.dailySlotTitle}>{title}</b>
                  <small>{description}</small>
                </div>
                <div className={styles.dailySlotActions}>
                  {slot.done ? (
                    <>
                      <button
                        type="button"
                        className={styles.dailyReplace}
                        onClick={() => replaceCompletedSlot(slot.id)}
                      >
                        갈아끼우기
                      </button>
                      <button
                        type="button"
                        className={styles.dailyUndo}
                        onClick={() => toggleDailyDone(slot.id)}
                      >
                        완료 취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={slot.workId && activeWorkId === slot.workId ? styles.dailyActiveWork : styles.dailyStart}
                        onClick={() => startDailySlot(slot)}
                      >
                        {slot.workId && activeWorkId === slot.workId ? "작업 중" : slot.workId && startedWorkIds.includes(slot.workId) ? "이어하기" : "작업 시작"}
                      </button>
                      <button
                        type="button"
                        className={styles.dailyComplete}
                        onClick={() => toggleDailyDone(slot.id)}
                      >
                        완료
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <details className={styles.dailySettings}>
          <summary>구성 직접 바꾸기</summary>
          <div className={styles.dailySettingsGrid}>
            {dailySlots.map((slot) => (
              <label key={slot.id}>
                <span>{slot.id}번</span>
                <select
                  aria-label={`${slot.id}번 발행 유형`}
                  value={slot.type}
                  onChange={(e) => updateDailyType(slot.id, e.target.value as DailyContentType)}
                >
                  {(Object.keys(DAILY_TYPE_META) as DailyContentType[]).map((type) => (
                    <option key={type} value={type}>{DAILY_TYPE_META[type].label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button type="button" className={styles.dailyResetAll} onClick={resetDailyBoard}>발행 큐 전체 새로 구성</button>
        </details>

        <details
          className={styles.publishHistory}
          onToggle={(e) => {
            if (e.currentTarget.open && !publishHistoryLoading) void loadPublishHistory();
          }}
        >
          <summary>
            <span>발행 이력</span>
            <small>{publishHistoryItems.length ? `${publishHistoryItems.length}개 저장됨` : "Supabase에서 보기"}</small>
          </summary>

          <div className={styles.publishHistoryBody}>
            <div className={styles.publishHistoryToolbar}>
              <input
                value={publishHistorySearch}
                onChange={(e) => setPublishHistorySearch(e.target.value)}
                placeholder="제목·단지명 검색"
                aria-label="발행 이력 검색"
              />
              <button type="button" onClick={() => void loadPublishHistory()} disabled={publishHistoryLoading}>
                {publishHistoryLoading ? "불러오는 중…" : "새로고침"}
              </button>
            </div>

            <div className={styles.publishHistoryFilters}>
              {([
                ["all", "전체"],
                ["bulk", "단지"],
                ["top3", "TOP3"],
                ["tip", "검색형"],
                ["power", "파워글"],
              ] as Array<[PublishHistoryFilter, string]>).map(([value, label]) => {
                const count = value === "all"
                  ? publishHistoryItems.length
                  : publishHistoryItems.filter((item) => item.content_type === value).length;
                return (
                  <button
                    key={value}
                    type="button"
                    className={publishHistoryFilter === value ? styles.publishHistoryFilterActive : ""}
                    onClick={() => setPublishHistoryFilter(value)}
                  >
                    {label} <span>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.publishHistoryMeta}>
              <span>검색 결과 {filteredPublishHistory.length}개</span>
              <small>완료 처리한 글은 자동으로 여기에 쌓입니다.</small>
            </div>

            {publishHistoryMessage && <p className={styles.publishHistoryMessage}>{publishHistoryMessage}</p>}

            <div className={styles.publishHistoryList}>
              {filteredPublishHistory.slice(0, 120).map((item) => {
                const label = item.content_type === "bulk" ? "단지"
                  : item.content_type === "top3" ? "TOP3"
                  : item.content_type === "tip" ? "검색형"
                  : item.content_type === "power" ? "파워글"
                  : "기타";
                return (
                  <div className={styles.publishHistoryRow} key={item.item_type + ":" + item.normalized_key}>
                    <span className={styles.publishHistoryType}>{label}</span>
                    <b>{item.title}</b>
                    <time>{item.published_on}</time>
                  </div>
                );
              })}
            </div>

            {filteredPublishHistory.length > 120 && (
              <p className={styles.publishHistoryMessage}>최근 120개까지만 표시합니다. 검색하면 이전 항목도 찾을 수 있습니다.</p>
            )}
          </div>
        </details>
      </section>
      )}

      {contentMode === "school" && <SchoolDistrictWorkspace />}
      {contentMode === "mega" && <MegaComplexWorkspace />}

      {contentMode === "bulk" && activeWorkId && activeWorkSlot && (
        <section id="active-work" className={styles.activeWorkPanel}>
          <div className={styles.activeWorkHead}>
            <div>
              <p className={styles.eyebrow}>ACTIVE WORK</p>
              <h2>{activeWorkSlot.id}번 · {DAILY_TYPE_META[activeWorkType || activeWorkSlot.type].label}</h2>
              <code>{activeWorkId}</code>
            </div>
            <div className={styles.activeWorkMeta}>
              <select value={workProgress} onChange={(e) => setWorkProgress(e.target.value as WorkProgress)}>
                <option value="not_started">미시작</option>
                <option value="preparing">자료 준비</option>
                <option value="drafting">본문 작성</option>
                <option value="images">이미지 작업</option>
                <option value="review">검수</option>
              </select>
              <button type="button" onClick={() => void persistActiveWork()}>지금 저장</button>
              <span>{workSaveMessage || "변경 내용 자동 저장"}</span>
            </div>
          </div>

          <div className={styles.workPrepGrid}>
            <label className={styles.workField}>
              <span>작업 주제</span>
              <input
                data-testid="work-topic"
                value={workTopic}
                onChange={(e) => setWorkTopic(e.target.value)}
                placeholder={activeWorkType === "bulk" ? "예: 산본 퇴계아파트 · 거래량 변화" : "오늘 만들 구체적인 주제를 적어두세요."}
              />
            </label>
            <label className={styles.workField}>
              <span>자료·근거 메모</span>
              <textarea
                data-testid="work-materials"
                value={workMaterials}
                onChange={(e) => setWorkMaterials(e.target.value)}
                placeholder="확인할 자료, 출처, 수치, 비교 기준 등을 저장합니다."
              />
            </label>
          </div>

          {activeWorkType === "bulk" ? (
            <div className={styles.bulkWorkBridge}>
              <div>
                <b>기존 단지 제작 화면과 연결됨</b>
                <p>아래 단지 데이터·본문·지도·생성 이미지가 이 작업 ID에 독립적으로 자동 저장됩니다.</p>
              </div>
              <div className={styles.bulkSaveState}>
                <span>본문 {finalBlogText.trim() ? "저장됨" : "미작성"}</span>
                <span>지도 {mapDataUrl ? "저장됨" : "없음"}</span>
                <span>본문 이미지 {outputs ? "저장됨" : "없음"}</span>
              </div>
              <label className={styles.workField}>
                <span>이미지·검수 메모</span>
                <textarea value={workImageNotes} onChange={(e) => setWorkImageNotes(e.target.value)} placeholder="외부에서 만든 썸네일이나 수정할 이미지 메모를 적어두세요." />
              </label>
            </div>
          ) : activeWorkType === "top3" ? (
            <>
              <Top3Workspace key={activeWorkId} workId={activeWorkId} topic={workTopic} materials={workMaterials}
                body={workBody} onBodyChange={setWorkBody} onTopicChange={setWorkTopic} data={top3Work} onChange={setTop3Work} />
              {(workImageNotes || workAttachments.length > 0) && <details>
                <summary>기존 이미지 메모·참고 첨부 (보존됨)</summary>
                <p>{workImageNotes}</p>
                <div className={styles.workAttachmentGrid}>{workAttachments.map((item, index) => (
                  <div className={styles.workAttachmentCard} key={index}><img src={item.dataUrl} alt={item.name} /><span>{item.name}</span></div>
                ))}</div>
              </details>}
            </>
          ) : (
            <div className={styles.prepOnlyPanel}>
              <div className={styles.prepOnlyNotice}>
                <b>{DAILY_TYPE_META[activeWorkType || activeWorkSlot.type].label} 준비 화면</b>
                <span>주제와 자료 메모를 반영한 GPT 요청서를 바로 복사하거나 ChatGPT에서 열 수 있습니다.</span>
              </div>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>🤖 GPT 요청서</b>
                    <span>현재 주제 · 작성일 · 자료 메모가 자동으로 반영됩니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={workGptPrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={openWorkGptPromptInChatGPT}>ChatGPT에서 열기</button>
                  <button type="button" onClick={() => void copyWorkGptPrompt()}>
                    {workPromptCopied ? "✓ 복사 완료" : "GPT 요청서 복사"}
                  </button>
                </div>
              </section>

              <label className={styles.workField}>
                <span>완성 글 붙여넣기</span>
                <textarea
                  data-testid="work-body"
                  value={workBody}
                  onChange={(e) => {
                    const nextBody = e.target.value;
                    setWorkBody(nextBody);
                    setFinalBlogText(nextBody);
                    setNaverCopyMessage("");
                  }}
                  placeholder="ChatGPT에서 만든 최종 글 전체를 여기에 한 번만 붙여넣으세요. 이미지 요청서와 네이버 최종편집에 동시에 반영됩니다."
                />
              </label>

              {workTableCount > 0 && (
                <div className={styles.tableImageNotice}>
                  <div>
                    <b>{workTimeSeriesTable ? "📈 시계열 표 감지됨" : `📊 표 ${workTableCount}개 감지됨`}</b>
                    <span>
                      {workTimeSeriesTable
                        ? `${workTimeSeriesTable.heading || "시계열 데이터"} · ${workTimeSeriesTable.rows.length}개 시점 · 01 이미지 요청서가 증권앱형 라인차트로 자동 변경됩니다.`
                        : `첫 번째 표 · ${workPrimaryTable?.rows.length || 0}행 × ${workPrimaryTable?.headers.length || 0}열 · 01 이미지 요청서가 표 전용으로 자동 변경됩니다.`}
                    </span>
                  </div>
                  <button type="button" disabled={!workBodyReadyForImages} onClick={() => openWorkImagePromptInChatGPT("01")}>
                    {workTimeSeriesTable ? "시세 그래프 GPT 제작" : "표 이미지 GPT 제작"}
                  </button>
                </div>
              )}

              <section className={styles.actionPanel}>
                <div className={styles.actionHead}>
                  <p className={styles.eyebrow}>IMAGE REQUESTS</p>
                  <h2>완성 글을 바탕으로 이미지 3장을 GPT에서 제작합니다.</h2>
                  <span>{workBodyReadyForImages ? "본문 내용이 이미지 요청서에 자동 반영됐습니다." : "완성 글을 먼저 붙여넣으면 이미지 제작 버튼이 활성화됩니다."}</span>
                </div>
                <div className={styles.actionGrid}>
                  <button type="button" className={styles.actionButton} disabled={!workBodyReadyForImages} onClick={() => openWorkImagePromptInChatGPT("00")}>
                    <span className={styles.actionIcon}>🖼️</span>
                    <b>00 · 썸네일 GPT 제작</b>
                    <small>1254×1254 · 글 전체를 읽고 대표 장면과 짧은 후킹 문구 구성</small>
                  </button>
                  <button type="button" className={styles.actionButton} disabled={!workBodyReadyForImages} onClick={() => openWorkImagePromptInChatGPT("01")}>
                    <span className={styles.actionIcon}>📊</span>
                    <b>{workTimeSeriesTable ? "01 · 시세 그래프 GPT 제작" : workTableCount ? "01 · 표 이미지 GPT 제작" : "01 · 핵심 정보 GPT 제작"}</b>
                    <small>
                      {workTimeSeriesTable
                        ? `시계열 표 ${workTimeSeriesTable.rows.length}개 시점 감지 · 1600×900 증권앱형 라인차트로 자동 반영`
                        : workTableCount
                          ? `표 ${workTableCount}개 감지 · 첫 번째 표 ${workPrimaryTable?.rows.length || 0}행을 1600×900 이미지로 자동 반영`
                          : "1600×900 · 일정·가격·환율 등 본문의 핵심 정보를 한눈에 정리"}
                    </small>
                  </button>
                  <button type="button" className={styles.actionButton} disabled={!workBodyReadyForImages} onClick={() => openWorkImagePromptInChatGPT("02")}>
                    <span className={styles.actionIcon}>🔗</span>
                    <b>02 · 원인·흐름 GPT 제작</b>
                    <small>1600×900 · 원인→과정→결과 또는 주요 변수 관계를 시각화</small>
                  </button>
                </div>
              </section>

              <details className={styles.advancedDetails}>
                <summary>이미지 제작 요청서 확인 · 복사</summary>
                <div className={styles.advancedBody}>
                  {(["00", "01", "02"] as WorkImageSlot[]).map((slot) => (
                    <section className={styles.promptSection} key={slot}>
                      <div className={styles.promptHead}>
                        <div>
                          <b>{slot} · {slot === "01" && workTimeSeriesTable ? "시세 그래프" : slot === "01" && workTableCount ? "표 이미지" : WORK_IMAGE_META[slot].label} 요청서</b>
                          <span>
                            {slot === "01" && workTimeSeriesTable
                              ? `1600×900 · 시계열 ${workTimeSeriesTable.rows.length}개 시점 라인차트 자동 반영`
                              : slot === "01" && workTableCount
                                ? `1600×900 · 첫 번째 표 ${workPrimaryTable?.rows.length || 0}행 데이터 자동 반영`
                                : `${WORK_IMAGE_META[slot].width}×${WORK_IMAGE_META[slot].height} · 완성 글 내용 자동 반영`}
                          </span>
                        </div>
                      </div>
                      <textarea className={styles.promptBoxCompact} value={workImagePrompts[slot]} readOnly />
                      <div className={styles.promptActionsCompact}>
                        <button type="button" disabled={!workBodyReadyForImages} onClick={() => openWorkImagePromptInChatGPT(slot)}>ChatGPT에서 열기</button>
                        <button type="button" disabled={!workBodyReadyForImages} onClick={() => void copyWorkImagePrompt(slot)}>
                          {workImagePromptCopied === slot ? "✓ 복사 완료" : "요청서 복사"}
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              </details>

              <label className={styles.workField}>
                <span>이미지 메모</span>
                <textarea
                  data-testid="work-image-notes"
                  value={workImageNotes}
                  onChange={(e) => setWorkImageNotes(e.target.value)}
                  placeholder="필요한 이미지 구성이나 제작 메모를 적어두세요."
                />
              </label>
              <div className={styles.workAttachmentBox}>
                <label>
                  참고 이미지 저장
                  <input type="file" accept="image/*" multiple onChange={(e) => void addWorkAttachments(e)} />
                </label>
                <span>작업별로 최대 6장까지 브라우저 저장소에 보관합니다.</span>
              </div>
              {workAttachments.length > 0 && (
                <div className={styles.workAttachmentGrid}>
                  {workAttachments.map((item, index) => (
                    <div key={item.name + index} className={styles.workAttachmentCard}>
                      <img src={item.dataUrl} alt={item.name} />
                      <span>{item.name}</span>
                      <button type="button" onClick={() => removeWorkAttachment(index)}>삭제</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {contentMode === "bulk" && (!activeWorkId || activeWorkType === "bulk") && (
      <section className={styles.layout}>
        <div className={styles.formCard}>
          <div className={styles.cardHead}>
            <div><b>단지 데이터</b><span>샘플: 산본 퇴계아파트</span></div>
            <button type="button" onClick={() => { setData(SAMPLE); setOutputs(null); }}>샘플값 복원</button>
          </div>

          {selectedComplexLoading && <div className={styles.autoLoad}>후보 단지 데이터를 불러오는 중…</div>}
          {selectedComplexName && !selectedComplexLoading && (
            <div className={styles.autoLoad}><b>{selectedComplexName}</b> 실거래 데이터가 자동으로 입력됐습니다.</div>
          )}

          <div className={styles.grid2}>
            <Field label="단지명" value={data.name} onChange={(v) => update("name", v)} />
            <Field label="지역" value={data.region} onChange={(v) => update("region", v)} />
            <Field label="대표 전용면적" value={data.area} onChange={(v) => update("area", v)} />
            <Field label="최근 실거래가" value={data.recentPrice} onChange={(v) => update("recentPrice", v)} />
            <Field label="이전 실거래가 / 비교값" value={data.previousPrice} onChange={(v) => update("previousPrice", v)} />
            <Field label="세대수" value={data.households} onChange={(v) => update("households", v)} />
            <Field label="입주년도" value={data.moveIn} onChange={(v) => update("moveIn", v)} />
            <Field label="가까운 주요 역" value={data.station} onChange={(v) => update("station", v)} />
          </div>
          <SelectField
            label="본문 주제"
            value={articleThemeMode}
            onChange={setArticleThemeMode}
            options={[
              { value: "auto", label: "자동 다양화 · 데이터 + 최근 주제 중복 회피" },
              { value: "price", label: "가격 변화 · 상승/하락폭 중심" },
              { value: "band", label: "가격대 전환 · 4억대→5억대 같은 장면" },
              { value: "trade", label: "거래량 변화 · 몰린 달/줄어든 달" },
              { value: "mixed", label: "가격·거래 엇갈림" },
              { value: "rebound", label: "저점·고점·반등" },
              { value: "volatility", label: "가격 변동성 · 월별 출렁임" },
              { value: "highlow", label: "6개월 고점·저점 위치" },
              { value: "stable", label: "보합·관망" },
            ]}
          />
          <div className={styles.autoLoad}>
            이번 글 추천 주제: <b>{selectedArticleTheme.label}</b> · {selectedArticleTheme.angle}
          </div>
          <SelectField
            label="썸네일 문구 톤"
            value={data.thumbnailTone}
            onChange={(v) => update("thumbnailTone", v)}
            options={[
              { value: "auto", label: "자동 추천 · 정석/후킹/유머 중 1픽" },
              { value: "standard", label: "정석형 · 깔끔하고 신뢰감 있게" },
              { value: "hook", label: "후킹형 · 놀람/의문/반전" },
              { value: "humor", label: "유머형 · 재치 한 스푼" },
            ]}
          />
          <Field label="썸네일 메인 문구 (비워두면 선택 톤으로 GPT 추천)" value={data.question} onChange={(v) => update("question", v)} />
          <Field label="한 줄 입지 설명" value={data.locationLine} onChange={(v) => update("locationLine", v)} />

          {(nearbyMessage || autoMapMessage) && (
            <div className={styles.statusStack}>
              {nearbyMessage && (
                <div className={styles.statusChip}>
                  {nearbyLoading ? "🚉 검색 중" : nearbyMessage}
                </div>
              )}
              {autoMapMessage && (
                <div className={styles.statusChip}>
                  {autoMapLoading ? "🗺️ 지도 생성 중" : autoMapGenerated ? "✅ 지도 준비 완료" : autoMapMessage}
                </div>
              )}
            </div>
          )}

          <section className={styles.actionPanel}>
            <div className={styles.actionHead}>
              <p className={styles.eyebrow}>PUBLISH ACTIONS</p>
              <h2>이미지 3장과 본문을 ChatGPT에서 만듭니다.</h2>
              <span>입지 이미지는 자동 준비된 네이버 지도 캡처를 클립보드에 복사한 뒤 새 채팅에서 Ctrl+V만 하면 됩니다.</span>
            </div>

            <div className={styles.actionGrid}>
              <button type="button" className={styles.actionButton} onClick={openThumbnailPromptInChatGPT}>
                <span className={styles.actionIcon}>🖼️</span>
                <b>1. 썸네일 만들기</b>
                <small>1254×1254 · ChatGPT 요청서 자동 입력</small>
              </button>

              <button
                type="button"
                className={styles.actionButton}
                disabled={!monthlyStats.length}
                onClick={openPriceImagePromptInChatGPT}
              >
                <span className={styles.actionIcon}>📈</span>
                <b>2. 시세 그래프 만들기</b>
                <small>6개월 월별 가격 + 거래건수 자동 입력</small>
              </button>

              <button
                type="button"
                className={styles.actionButton}
                disabled={!mapDataUrl}
                onClick={openLocationImagePromptInChatGPT}
              >
                <span className={styles.actionIcon}>🗺️</span>
                <b>3. 입지 이미지 만들기</b>
                <small>{mapDataUrl ? "지도 캡처 자동 복사 → 새 채팅에서 Ctrl+V" : "지도 준비 중"}</small>
              </button>

              <button type="button" className={styles.actionButton} onClick={openBodyPromptInChatGPT}>
                <span className={styles.actionIcon}>📝</span>
                <b>4. 본문 작성하기</b>
                <small>최신 웹 확인 + 제목 + 본문 + 태그</small>
              </button>
            </div>

            {mapCopyMessage && <div className={styles.mapCopyNotice}>{mapCopyMessage}</div>}
          </section>



          <details className={styles.advancedDetails}>
            <summary>이미지 · 본문 요청서 확인 · 복사</summary>
            <div className={styles.advancedBody}>
              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>🖼️ 썸네일 요청서</b>
                    <span>1254×1254 정사각형 썸네일용</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={thumbnailPrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyThumbnailPrompt()}>
                    {promptCopied ? "✓ 복사 완료" : "썸네일 요청서 복사"}
                  </button>
                </div>
              </section>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>📈 시세 그래프 요청서</b>
                    <span>최근 6개월 월별 대표가격과 거래건수가 자동으로 들어갑니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={priceImagePrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyPriceImagePrompt()}>
                    {pricePromptCopied ? "✓ 복사 완료" : "시세 그래프 요청서 복사"}
                  </button>
                </div>
              </section>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>🗺️ 입지 이미지 요청서</b>
                    <span>네이버 지도는 위치 관계 참고용으로만 사용하도록 요청합니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={locationImagePrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyLocationImagePrompt()}>
                    {locationPromptCopied ? "✓ 복사 완료" : "입지 요청서 복사"}
                  </button>
                  <button type="button" disabled={!mapDataUrl} onClick={() => void copyMapCaptureToClipboard()}>
                    지도 캡처 복사
                  </button>
                </div>
              </section>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>📝 본문 요청서</b>
                    <span>최종 제목 + 본문(이미지 위치·문단 여백 포함) + 태그 7개만 나오도록 구성합니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={bodyPrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyBodyPrompt()}>
                    {bodyPromptCopied ? "✓ 복사 완료" : "본문 요청서 복사"}
                  </button>
                </div>
              </section>
            </div>
          </details>

          <details className={styles.advancedDetails}>
            <summary>지도 참고 캡처 · 사진 참고</summary>
            <div className={styles.advancedBody}>
              <section className={styles.photoSection}>
                <div className={styles.photoHead}>
                  <div>
                    <b>검색 사진 참고</b>
                    <span>{photoSearchMessage || "필요할 때만 단지 외관 참고 사진을 검색합니다."}</span>
                  </div>
                  <button
                    type="button"
                    disabled={photoCandidatesLoading || !data.name.trim()}
                    onClick={() => {
                      const nextStart = photoCandidates.length ? (photoSearchStart >= 981 ? 1 : photoSearchStart + 10) : 1;
                      void searchPhotoCandidates(data.name, data.region, nextStart);
                    }}
                  >
                    {photoCandidatesLoading ? "검색 중…" : photoCandidates.length ? "다시 검색" : "참고 사진 찾기"}
                  </button>
                </div>
                {photoCandidates.length > 0 && (
                  <div className={styles.photoGrid}>
                    {photoCandidates.map((candidate, index) => (
                      <div key={candidate.imageUrl + index} className={styles.photoCard}>
                        <img
                          src={candidate.thumbnailUrl}
                          alt={candidate.title || `단지 참고 사진 ${index + 1}`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <span>{`참고 ${index + 1}`}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className={styles.photoNotice}>검색 이미지는 참고용이며 생성 이미지에 직접 복제하지 않습니다.</p>
              </section>

              <div className={styles.uploadGrid}>
                <label className={styles.uploadBox}>
                  <input type="file" accept="image/*" onChange={handleMap} />
                  <span className={styles.uploadIcon}>🗺️</span>
                  <b>{autoMapGenerated ? "네이버 지도 자동 준비 완료" : mapDataUrl ? "지도 이미지 교체" : "지도 이미지 업로드"}</b>
                  <small>{autoMapGenerated ? "입지 이미지 버튼을 누르면 이 지도가 클립보드에 복사됩니다." : "자동 지도가 실패했을 때만 직접 올리면 됩니다."}</small>
                </label>
              </div>

              {mapDataUrl && (
                <div className={styles.mapReferencePanel}>
                  <div className={styles.mapReferenceHead}>
                    <div>
                      <b>입지 참고용 지도</b>
                      <span>ChatGPT에서 그대로 쓰는 게 아니라 위치 관계 참고용으로만 붙여넣습니다.</span>
                    </div>
                    <button type="button" onClick={() => void copyMapCaptureToClipboard()}>지도 캡처 복사</button>
                  </div>
                  <div className={styles.mapPreview}>
                    <img src={mapDataUrl} alt="입지 참고용 네이버 지도" />
                  </div>
                  <p>{mapCopyMessage || "복사 후 ChatGPT 새 채팅에서 Ctrl+V로 붙여넣으면 됩니다."}</p>
                </div>
              )}
            </div>
          </details>

          {!mapDataUrl && <p className={styles.helper}>{autoMapLoading ? "지도 자동 생성 중입니다." : "후보 단지를 선택하면 지도를 자동으로 준비합니다."}</p>}
        </div>

        <aside className={styles.guideCard}>
          <p className={styles.eyebrow}>PUBLISH FLOW</p>
          <h2>이미지 3장 모두 ChatGPT에서 제작.</h2>
          <div className={styles.templateItem}><span>01</span><div><b>썸네일</b><small>1254×1254 요청서 자동 생성</small></div></div>
          <div className={styles.templateItem}><span>02</span><div><b>시세 그래프</b><small>6개월 월별 가격·거래건수 요청서 자동 생성</small></div></div>
          <div className={styles.templateItem}><span>03</span><div><b>입지 이미지</b><small>네이버 지도 자동 복사 → Ctrl+V → 새 인포그래픽 제작</small></div></div>
          <div className={styles.note}><b>최종 흐름</b><p>사이트는 데이터와 지도 참고자료를 준비하고, 실제 이미지는 ChatGPT에서 고품질로 제작합니다.</p></div>
        </aside>
      </section>
      )}

      <details className={styles.sharedEditor}>
        <summary>
          <span><b>네이버 최종편집</b><small>단지 · 학군 · 초대형단지 공통</small></span>
          <strong>완성글 붙여넣기</strong>
        </summary>
        <div className={styles.sharedEditorBody}>
          <section className={styles.naverEditor}>
            <div className={styles.naverEditorHead}>
              <div>
                <p className={styles.eyebrow}>NAVER FINAL COPY</p>
                <h2>5. 네이버 최종 편집 · 전체복사</h2>
                <span>완성글을 작업 화면에 한 번 붙여넣으면 여기에도 자동 반영됩니다. 시계열 표는 최근 시세 그래프 자리로, 일반 표는 선택한 방식에 맞춰 자동 정리합니다.</span>
              </div>
            </div>

            <div className={styles.naverEditorGrid}>
              <div className={styles.naverInputPane}>
                <b>① ChatGPT 완성글 붙여넣기</b>
                <textarea
                  className={styles.naverInput}
                  value={finalBlogText}
                  onChange={(e) => {
                    setFinalBlogText(e.target.value);
                    setNaverCopyMessage("");
                  }}
                  placeholder="ChatGPT에서 생성된 제목 + 본문 + 태그 전체를 여기에 붙여넣으세요. 마크다운 표도 그대로 붙여넣어도 됩니다."
                />
                <div className={styles.naverTableModeBox}>
                  <div className={styles.naverTableModeHead}>
                    <b>표 처리 방식</b>
                    <small>
                      {naverTimeSeriesTable
                        ? `표 ${markdownTableCount}개 · 시계열 표 자동 감지: ${naverTimeSeriesTable.heading || "최근 시세"}`
                        : markdownTableCount
                          ? `마크다운 표 ${markdownTableCount}개 감지됨`
                          : "표가 감지되면 아래 방식으로 처리합니다."}
                    </small>
                  </div>
                  <div className={styles.naverTableModes}>
                    <label className={tableHandlingMode === "image" ? styles.naverTableModeActive : styles.naverTableMode}>
                      <input
                        type="radio"
                        name="table-handling-mode"
                        value="image"
                        checked={tableHandlingMode === "image"}
                        onChange={() => {
                          setTableHandlingMode("image");
                          setNaverCopyMessage("");
                        }}
                      />
                      <span>
                        <b>이미지로 대체</b>
                        <small>
                          {naverTimeSeriesTable
                            ? "추천 · 시계열 표는 [이미지 01 · 최근 시세 그래프]로, 나머지 표는 모바일 카드형으로 자동 정리"
                            : "추천 · 표 행은 빼고 [이미지 01 · 표 제목]만 남김"}
                        </small>
                      </span>
                    </label>
                    <label className={tableHandlingMode === "card" ? styles.naverTableModeActive : styles.naverTableMode}>
                      <input
                        type="radio"
                        name="table-handling-mode"
                        value="card"
                        checked={tableHandlingMode === "card"}
                        onChange={() => {
                          setTableHandlingMode("card");
                          setNaverCopyMessage("");
                        }}
                      />
                      <span><b>모바일 카드형</b><small>짧은 표를 네이버용 카드 문장으로 변환</small></span>
                    </label>
                    <label className={tableHandlingMode === "original" ? styles.naverTableModeActive : styles.naverTableMode}>
                      <input
                        type="radio"
                        name="table-handling-mode"
                        value="original"
                        checked={tableHandlingMode === "original"}
                        onChange={() => {
                          setTableHandlingMode("original");
                          setNaverCopyMessage("");
                        }}
                      />
                      <span><b>원문 유지</b><small>마크다운 표 문자를 그대로 유지</small></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.naverPreviewPane}>
                <div className={styles.naverPreviewHead}>
                  <b>② 네이버 붙여넣기 미리보기</b>
                  <span>{naverBlocks.length ? `${naverBlocks.length}개 블록 자동 인식` : "완성글을 붙여넣으면 미리보기가 나타납니다."}</span>
                </div>
                <div className={styles.naverPreview}>
                  {naverBlocks.length ? naverBlocks.map((block, index) => (
                    <div key={index}>
                      <div
                        className={
                          block.type === "title" ? styles.naverTitle :
                          block.type === "subheading" ? styles.naverSubheading :
                          block.type === "tags" ? styles.naverTags :
                          block.type === "image" ? styles.naverImageLine :
                          block.type === "card" ? styles.naverCard :
                          styles.naverBody
                        }
                      >
                        {block.text}
                      </div>
                      {index < naverBlocks.length - 1 && !(block.type === "card" && naverBlocks[index + 1]?.type === "card") && (
                        <div className={styles.naverSpacer} aria-hidden="true">&nbsp;</div>
                      )}
                    </div>
                  )) : (
                    <div className={styles.naverPreviewEmpty}>제목 · 소제목 · 본문 · 태그의 실제 크기와 한 줄 띄기를 여기서 확인할 수 있습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.naverCopyActions}>
              <button type="button" className={styles.naverPrimaryCopy} onClick={() => void copyNaverRichText()}>
                ③ 서식 포함 전체복사
              </button>
              <button type="button" onClick={() => void copyNaverSafeText()}>
                한줄띄기 안전복사
              </button>
              <span>기본은 서식 포함 전체복사 → 네이버 Ctrl+V</span>
            </div>

            {naverCopyMessage && <div className={styles.naverCopyNotice}>{naverCopyMessage}</div>}
          </section>
        </div>
      </details>

      {contentMode === "bulk" && (!activeWorkId || activeWorkType === "bulk") && outputs && (
        <section id="outputs" className={styles.outputs}>
          <div className={styles.outputHead}>
            <div><p className={styles.eyebrow}>OUTPUT</p><h2>본문 이미지 2장 완성</h2><span>썸네일은 위 ChatGPT 요청서로 만들고, 아래 2장은 블로그 본문에 사용하세요.</span></div>
            <button onClick={downloadZip}>본문 이미지 2장 ZIP 다운로드</button>
          </div>
          <OutputCard title="01 · 시세 그래프 카드" size="1600×900" src={outputs.price} filename="01_price_graph.png" />
          <OutputCard title="02 · 입지 지도 카드" size="1600×900" src={outputs.map} filename="02_location.png" />
        </section>
      )}
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className={styles.field}><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function OutputCard({ title, size, src, filename }: { title: string; size: string; src: string; filename: string }) {
  return (
    <article className={styles.outputCard}>
      <div className={styles.outputMeta}><div><b>{title}</b><span>{size}</span></div><button onClick={() => downloadDataUrl(src, filename)}>PNG 다운로드</button></div>
      <img src={src} alt={title} />
    </article>
  );
}
