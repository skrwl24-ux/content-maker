"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";

type Category = "신기한 동물이야기" | "신비로운 자연" | "생활 속 궁금증";
type Status = "waiting" | "working" | "done";
type SlotStatus = "waiting" | "working" | "registered";
type SlotId = "00" | "01" | "02" | "03";

type SlotMeta = {
  status: SlotStatus;
  prompt: string;
  width?: number;
  height?: number;
  warning?: string;
  updatedAt?: string;
};

type TopicWork = {
  articlePrompt: string;
  body: string;
  bodyConfirmed: boolean;
  optional03: boolean;
  slots: Record<SlotId, SlotMeta>;
};

type ImageRecord = { blob: Blob; width: number; height: number; updatedAt: string };
type LoadedImage = ImageRecord & { url: string };
type NaverBlock = {
  type: "title" | "subheading" | "body" | "image" | "tags";
  text: string;
};

type Topic = {
  id: number;
  category: Category;
  title: string;
  brief: string;
};

const TOPICS: Topic[] = [
  { id: 1, category: "생활 속 궁금증", title: "9월인데 모기가 왜 이렇게 많지? 가을 모기가 사라지지 않는 이유", brief: "지금 계절과 맞는 생활 검색형 주제. 기온·습도·모기 활동 시기를 중심으로 설명합니다." },
  { id: 2, category: "신기한 동물이야기", title: "고양이는 왜 박스를 좋아할까?", brief: "생활 속에서 자주 보는 행동을 안정감·체온·본능과 연결하는 검색형 동물 주제입니다." },
  { id: 3, category: "신비로운 자연", title: "가을 하늘은 왜 유난히 높고 파랗게 보일까?", brief: "계절성 높은 자연 궁금증. 대기 상태와 빛의 산란을 쉽게 풀어냅니다." },
  { id: 4, category: "생활 속 궁금증", title: "집에 초파리가 계속 생기는 이유｜잡아도 다시 나타나는 곳은?", brief: "검색 의도가 선명한 생활형 주제. 발생 장소와 번식 조건을 사실 중심으로 정리합니다." },
  { id: 5, category: "신기한 동물이야기", title: "피스톨새우는 어떻게 총소리를 낼까?", brief: "블로그 색깔을 살리는 희귀·신기 소재. 집게와 공동현상 원리를 쉽게 설명합니다." },
  { id: 6, category: "신비로운 자연", title: "나뭇잎은 왜 가을이 되면 빨강·노랑으로 변할까?", brief: "가을 대표 검색형 자연 주제. 엽록소와 색소 변화를 이해하기 쉽게 정리합니다." },
  { id: 7, category: "생활 속 궁금증", title: "밤에 창문을 열면 벌레가 불빛으로 몰려드는 이유", brief: "누구나 경험하는 생활 질문. 곤충의 방향 감각과 인공조명의 영향을 설명합니다." },
  { id: 8, category: "신기한 동물이야기", title: "새들은 길을 어떻게 잃지 않을까?", brief: "태양·별·지구 자기장 등 동물의 놀라운 길찾기 능력을 다루는 검색형 주제입니다." },
  { id: 9, category: "신비로운 자연", title: "밤바다는 왜 파랗게 빛날까? 생물발광의 비밀", brief: "시각적으로 강한 희귀 자연 소재. 생물발광 플랑크톤과 조건을 검증해 설명합니다." },
  { id: 10, category: "생활 속 궁금증", title: "은행나무 열매는 왜 그렇게 냄새가 심할까?", brief: "가을철 생활 검색과 자연 과학을 연결하는 주제. 냄새 성분과 열매 구조를 설명합니다." },
];

const STORAGE_KEY = "paramma-publish-queue-v1";
const DB_NAME = "paramma-blogger-images-v1";
const DB_STORE = "images";
const SLOT_IDS: SlotId[] = ["00", "01", "02", "03"];
const SLOT_INFO: Record<SlotId, { label: string; role: string; width: number; height: number; filename: string; copy: string }> = {
  "00": { label: "썸네일", role: "대표 썸네일", width: 1254, height: 1254, filename: "00_thumbnail.png", copy: "주제를 한눈에 이해시키는 질문형 썸네일" },
  "01": { label: "본문 이미지 01", role: "핵심 원리", width: 1600, height: 900, filename: "01_body.png", copy: "핵심 원리를 한눈에 이해시키는 장면" },
  "02": { label: "본문 이미지 02", role: "과정·비교", width: 1600, height: 900, filename: "02_body.png", copy: "원인과 과정 또는 비교를 쉽게 보여주는 장면" },
  "03": { label: "선택 이미지 03", role: "추가 설명", width: 1600, height: 900, filename: "03_body.png", copy: "추가로 알아두면 좋은 점을 보여주는 보조 장면" },
};

function categoryEmoji(category: Category) {
  if (category === "신기한 동물이야기") return "🐾";
  if (category === "신비로운 자연") return "🌌";
  return "💡";
}

function categoryClass(category: Category) {
  if (category === "신기한 동물이야기") return styles.animal;
  if (category === "신비로운 자연") return styles.nature;
  return styles.life;
}

function formatToday() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function categoryGuide(category: Category) {
  if (category === "신기한 동물이야기") {
    return "동물의 행동이나 능력을 사람처럼 과도하게 의인화하지 말고, 관찰 연구와 생물학적 원인을 중심으로 설명한다. 독자가 놀랄 만한 포인트는 살리되 검증되지 않은 능력은 사실처럼 쓰지 않는다.";
  }
  if (category === "신비로운 자연") {
    return "현상이 왜 생기는지 원인→과정→결과 순서로 쉽게 설명한다. 사진이나 영상에서 강하게 보이는 현상일수록 과장·도시전설·잘못된 설명을 구분해 검증한다.";
  }
  return "독자가 검색한 질문에 초반 3~4문장 안에 핵심 답을 먼저 준다. 생활에서 실제로 체감하는 이유와 과학적 원리를 연결하고, 건강·안전 관련 내용은 공공기관 자료를 우선 확인한다.";
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

function isNonPublishNaverHeading(line: string) {
  const normalized = cleanNaverLine(line)
    .replace(/^\[|\]$/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  return /^(이미지.*기획\s*메모|검수\s*메모)(?:\s*[:：-].*)?$/i.test(normalized);
}

function parseNaverBlog(raw: string): NaverBlock[] {
  const allLines = raw.replace(/\r\n?/g, "\n").split("\n");
  const cutoff = allLines.findIndex((line) => isNonPublishNaverHeading(line));
  const publishLines = cutoff >= 0 ? allLines.slice(0, cutoff) : allLines;

  const lines = publishLines
    .map((line) => line.trim())
    .filter((line) => line && !/^:::writing\b/i.test(line) && line !== ":::" && !/^---option\b/i.test(line));

  if (!lines.length) return [];

  const blocks: NaverBlock[] = [];
  let firstContent = true;

  for (const original of lines) {
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
    const emojiHeading = /^[🐾🌌💡✅📌🔎]/u.test(line) && line.length <= 40 && !/[.!?]$/.test(line);

    if (markdownHeading || wholeBold || emojiHeading) {
      blocks.push({ type: "subheading", text: line });
      continue;
    }

    blocks.push({ type: "body", text: line });
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
  return blocks.map((block) => block.text).join("\r\n \r\n");
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
    return `<div style="font-family:${font};font-size:15pt;line-height:1.7;font-weight:400;margin:0;">${safe}</div>`;
  });

  const spacer = `<div style="font-family:${font};font-size:15pt;line-height:1.7;margin:0;"><br></div>`;
  return `<div>${blockHtml.join(spacer)}</div>`;
}

function buildArticlePrompt(topic: Topic) {
  return `Paramma 블로거 네이버 글을 최종 발행본으로 만들어줘.

[작성 기준일]
${formatToday()}

[발행 정보]
이번 묶음: 1차 발행 10개
발행 순서: ${topic.id}/10
카테고리: ${topic.category}
주제: ${topic.title}
기획 의도: ${topic.brief}

[가장 중요한 작업 방식]
- 먼저 웹 검색으로 사실을 확인한 뒤 글을 작성할 것.
- 현재·계절성 내용은 작성 기준일과 맞는 최신 자료를 우선 확인할 것.
- 정부기관, 대학, 학술논문, 박물관·과학기관, 공신력 있는 전문기관을 우선 활용할 것.
- 블로그나 커뮤니티의 주장을 그대로 사실처럼 사용하지 말 것.
- 서로 다른 설명이 있는 내용은 무엇이 확실하고 무엇이 가설인지 구분할 것.
- 숫자·기간·온도·생태 특징 등 구체적인 사실은 임의로 만들지 말 것.
- 검색 결과를 그대로 베끼지 말고 이해하기 쉬운 한국어로 재구성할 것.

[카테고리 작성 규칙]
${categoryGuide(topic.category)}

[네이버 검색형 제목]
- 제목 후보 5개를 먼저 내부적으로 비교할 것.
- 최종 제목은 검색어가 자연스럽게 들어가면서도 “왜/어떻게/정말?” 같은 궁금증을 살릴 것.
- 낚시성 과장, 사실과 다른 단정, 지나치게 긴 제목은 피할 것.
- 본문 최종 출력에서는 최종 선택 제목 1개만 맨 위에 표시할 것.

[본문 구성]
- 모바일에서 읽기 편하게 짧은 문단으로 작성.
- 도입부에서 독자의 실제 궁금증을 바로 꺼낼 것.
- 핵심 답을 너무 늦게 숨기지 말 것.
- 소제목 4~6개 정도.
- 핵심 원리와 과정을 쉬운 말로 설명.
- 사람들이 자주 오해하는 부분이 있으면 별도 문단으로 바로잡기.
- 같은 말을 반복해 분량만 늘리지 말 것.
- AI가 쓴 티가 나는 상투적인 결론은 피할 것.
- 정보글이지만 딱딱한 논문체보다는 자연스러운 개인 블로그 문체.
- 필요하면 마지막에 ‘한눈에 정리’ 3줄 정도 사용.
- 네이버 블로그용 태그 8~12개를 마지막에 한 줄로 제공.

[이미지 기획 메모]
최종 본문 안에 이미지 위치를 정확히 표시해줘.
- 이미지 00: 썸네일
- 이미지 01: 핵심 원리 또는 가장 이해가 필요한 장면
- 이미지 02: 과정·비교·구조를 보여주는 장면
- 이미지 03은 내용상 꼭 필요할 때만 제안
- 각 이미지가 무엇을 보여주면 좋은지 한 줄씩 기획 메모만 작성
- 실제 이미지 생성 요청서는 콘텐츠메이커의 이미지 슬롯에서 별도로 만들므로 여기서는 긴 이미지 프롬프트를 반복하지 말 것

[최종 출력 순서]
1. 최종 제목
2. 네이버 발행용 본문
3. 태그
4. 이미지 00~02(필요 시 03) 기획 메모
5. 마지막에 ‘검수 메모’로 사용한 주요 출처와 핵심 사실을 짧게 정리

중요: 검색하지 않고 일반 상식만으로 작성하지 말고, 반드시 최신 웹 검색과 사실 검증을 거쳐 완성해줘.`;
}


function buildLegacyImagePrompt(topic: Topic, slotId: SlotId) {
  const info = SLOT_INFO[slotId];
  const ratio = info.width === info.height ? "1:1 정사각형" : "16:9 가로형";
  const textLine = slotId === "00" ? topic.title : info.copy;
  return `Paramma 블로거용 이미지를 1장 만들어줘.

[글 정보]
카테고리: ${topic.category}
글 주제: ${topic.title}
기획 의도: ${topic.brief}

[이미지 역할]
슬롯: ${slotId} · ${info.label}
역할: ${info.role}
이 이미지가 전달할 내용: ${info.copy}

[제작 목표]
목표 크기: ${info.width}×${info.height}px
목표 비율: ${ratio}
네이버 블로그용 단일 이미지 1장

[공통 스타일]
- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게
- 과도한 AI 느낌, 네온, 유리질감, 과한 3D 효과, 불필요한 장식 금지
- 실제 생물·자연의 형태와 색을 과장하거나 왜곡하지 말 것
- 설명형이면 교육용 인포그래픽처럼 구조가 한눈에 보이게
- 사진형이 적합하면 자연 다큐멘터리 사진처럼 사실적으로
- 모바일에서도 핵심 피사체가 잘 보이도록 단순한 구도와 여백 사용

[이미지에 넣을 문구]
${textLine}
- 위 문구 외에 긴 설명문을 추가하지 말 것
- 한글 문구는 짧고 크게, 오탈자 없이 표시할 것

[제외할 요소]
- 워터마크, 타사 로고
- 출처 불명 숫자·통계
- 본문에서 확인되지 않은 사실
- 여러 장을 한 장에 합친 콜라주
- 작은 글자를 빽빽하게 채운 구성

중요: 다른 채팅에 이 요청서만 단독으로 붙여넣어도 바로 제작할 수 있게 필요한 정보를 모두 포함했다.`;
}

function buildPreLabelImagePrompt(topic: Topic, slotId: SlotId) {
  const info = SLOT_INFO[slotId];
  const isThumbnail = slotId === "00";
  const ratio = info.width === info.height ? "1:1 정사각형" : "16:9 가로형";

  const compositionRules = isThumbnail
    ? `[썸네일 구성 원칙]
- 주제를 한눈에 이해시키는 대표 썸네일로 구성
- 핵심 피사체와 질문형 문구가 모바일 목록에서도 바로 보이게
- 문구는 1~2줄 중심으로 크게 배치
- 정보 과밀 없이 강한 대표 장면 1개를 중심으로 구성

[이미지에 넣을 문구]
${topic.title}
- 위 문구 외에 긴 설명문을 추가하지 말 것
- 한글 문구는 크고 선명하게, 오탈자 없이 표시할 것`
    : `[본문 이미지 구성 원칙]
- 이 이미지는 썸네일이 아니라 글 중간에 삽입되는 본문용 이미지
- 이미지 상단이나 중앙에 주제 전체를 반복하는 큰 제목·질문형 메인 카피만 넣지 말 것
- 화면의 중심은 실제 장면·생물·자연 현상·과정 자체가 되게 할 것
- 사진형이 적합하면 자연 다큐멘터리 사진처럼 사실적인 한 장면으로 구성
- 설명형이면 원인·과정·비교를 쉽게 이해하도록 짧은 라벨, 원형 설명 요소, 화살표를 자연스럽게 사용할 수 있음
- 여러 설명 요소를 사용해도 전체가 광고 썸네일이 아니라 본문 설명 이미지처럼 보이게 할 것
- 여백은 자연스럽게 두고 블로그 본문에 넣었을 때 설명 이미지/삽화처럼 보이게 할 것

[이미지 내 텍스트]
- 주제 전체를 반복하는 큰 헤드라인은 넣지 말 것
- 원인·과정·비교를 설명하는 짧은 라벨은 1~4개 정도 허용
- 필요한 경우 화살표와 단계 문구를 함께 사용 가능
- 설명 라벨은 읽기 쉽게 표시하되 메인 제목처럼 크게 만들지 말 것`;

  return `Paramma 블로거용 이미지를 1장 만들어줘.

[글 정보]
카테고리: ${topic.category}
글 주제: ${topic.title}
기획 의도: ${topic.brief}

[이미지 역할]
슬롯: ${slotId} · ${info.label}
역할: ${info.role}
이 이미지가 전달할 내용: ${info.copy}

[제작 목표]
목표 크기: ${info.width}×${info.height}px
목표 비율: ${ratio}
네이버 블로그용 단일 이미지 1장

[공통 스타일]
- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게
- 과도한 AI 느낌, 네온, 유리질감, 과한 3D 효과, 불필요한 장식 금지
- 실제 생물·자연의 형태와 색을 과장하거나 왜곡하지 말 것
- 모바일에서도 핵심 피사체가 잘 보이도록 단순한 구도와 여백 사용

${compositionRules}

[제외할 요소]
- 워터마크, 타사 로고
- 출처 불명 숫자·통계
- 본문에서 확인되지 않은 사실
- 여러 장을 한 장에 합친 콜라주
- 작은 글자를 빽빽하게 채운 구성
${isThumbnail ? "" : "- 썸네일처럼 큰 제목이 전면을 차지하는 구성\n- 주제 전체를 반복하는 대형 헤드라인·질문형 카피"}

중요: 다른 채팅에 이 요청서만 단독으로 붙여넣어도 바로 제작할 수 있게 필요한 정보를 모두 포함했다.`;
}


function buildImagePrompt(topic: Topic, slotId: SlotId) {
  const info = SLOT_INFO[slotId];
  const isThumbnail = slotId === "00";
  const ratio = info.width === info.height ? "1:1 정사각형" : "16:9 가로형";

  const compositionRules = isThumbnail
    ? `[썸네일 구성 원칙]
- 주제를 한눈에 이해시키는 대표 썸네일로 구성
- 핵심 피사체와 질문형 문구가 모바일 목록에서도 바로 보이게
- 문구는 1~2줄 중심으로 크게 배치
- 정보 과밀 없이 강한 대표 장면 1개를 중심으로 구성

[이미지에 넣을 문구]
${topic.title}
- 위 문구 외에 긴 설명문을 추가하지 말 것
- 한글 문구는 크고 선명하게, 오탈자 없이 표시할 것`
    : `[본문 이미지 구성 원칙]
- 이 이미지는 썸네일이 아니라 글 중간에 삽입되는 본문용 이미지
- 이미지 상단이나 중앙에 주제 전체를 반복하는 큰 제목·질문형 메인 카피만 넣지 말 것
- 화면의 중심은 실제 장면·생물·자연 현상·과정 자체가 되게 할 것
- 사진형이 적합하면 자연 다큐멘터리 사진처럼 사실적인 한 장면으로 구성
- 설명형이면 원인·과정·비교를 쉽게 이해하도록 짧은 라벨, 원형 설명 요소, 화살표를 자연스럽게 사용할 수 있음
- 여러 설명 요소를 사용해도 전체가 광고 썸네일이 아니라 본문 설명 이미지처럼 보이게 할 것
- 여백은 자연스럽게 두고 블로그 본문에 넣었을 때 설명 이미지/삽화처럼 보이게 할 것

[이미지 내 텍스트]
- 주제 전체를 반복하는 큰 헤드라인은 넣지 말 것
- 원인·과정·비교를 설명하는 짧은 라벨은 1~4개 정도 허용
- 필요한 경우 화살표와 단계 문구를 함께 사용 가능
- 설명 라벨은 읽기 쉽게 표시하되 메인 제목처럼 크게 만들지 말 것`;

  return `작업 이미지: ${slotId} · ${info.label}
※ 위 번호와 슬롯명은 채팅 작업 구분용이며 실제 이미지 안에는 넣지 말 것.

Paramma 블로거용 이미지를 1장 만들어줘.

[글 정보]
카테고리: ${topic.category}
글 주제: ${topic.title}
기획 의도: ${topic.brief}

[이미지 역할]
슬롯: ${slotId} · ${info.label}
역할: ${info.role}
이 이미지가 전달할 내용: ${info.copy}

[제작 목표]
목표 크기: ${info.width}×${info.height}px
목표 비율: ${ratio}
네이버 블로그용 단일 이미지 1장

[공통 스타일]
- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게
- 과도한 AI 느낌, 네온, 유리질감, 과한 3D 효과, 불필요한 장식 금지
- 실제 생물·자연의 형태와 색을 과장하거나 왜곡하지 말 것
- 모바일에서도 핵심 피사체가 잘 보이도록 단순한 구도와 여백 사용

${compositionRules}

[제외할 요소]
- 작업 구분용 번호(00/01/02/03), 슬롯 번호, "작업 이미지" 문구
- 워터마크, 타사 로고
- 출처 불명 숫자·통계
- 본문에서 확인되지 않은 사실
- 여러 장을 한 장에 합친 콜라주
- 작은 글자를 빽빽하게 채운 구성
${isThumbnail ? "" : "- 썸네일처럼 큰 제목이 전면을 차지하는 구성\n- 주제 전체를 반복하는 대형 헤드라인·질문형 카피"}

중요: 다른 채팅에 이 요청서만 단독으로 붙여넣어도 바로 제작할 수 있게 필요한 정보를 모두 포함했다.`;
}

function isPreviousStrictBodyPrompt(prompt: string, topic: Topic, slotId: SlotId) {
  if (slotId === "00") return false;
  const info = SLOT_INFO[slotId];
  return prompt.includes(`슬롯: ${slotId} · ${info.label}`) &&
    prompt.includes(`글 주제: ${topic.title}`) &&
    prompt.includes("- 큰 제목, 질문형 카피, 제목 박스, 리본, 배지, 카드형 설명 문구를 넣지 말 것") &&
    prompt.includes("- 원형 배지·화살표·강조 카피를 여러 개 배치한 광고형 인포그래픽") &&
    prompt.includes("- 과학적 이해에 꼭 필요한 경우에만 짧은 라벨 1~3개 정도 허용");
}

function refreshLegacyImagePrompts(works: Record<number, TopicWork>) {
  let changed = false;
  const next = { ...works };

  for (const topic of TOPICS) {
    const current = works[topic.id];
    if (!current?.slots) continue;

    let topicChanged = false;
    const slots = { ...current.slots };

    for (const slotId of SLOT_IDS) {
      const slot = slots[slotId];
      if (!slot) continue;
      if (
        slot.prompt === buildPreLabelImagePrompt(topic, slotId) ||
        slot.prompt === buildLegacyImagePrompt(topic, slotId) ||
        isPreviousStrictBodyPrompt(slot.prompt, topic, slotId)
      ) {
        slots[slotId] = { ...slot, prompt: buildImagePrompt(topic, slotId) };
        topicChanged = true;
        changed = true;
      }
    }

    if (topicChanged) next[topic.id] = { ...current, slots };
  }

  return changed ? next : works;
}

function defaultWork(topic: Topic): TopicWork {
  return {
    articlePrompt: buildArticlePrompt(topic),
    body: "",
    bodyConfirmed: false,
    optional03: false,
    slots: {
      "00": { status: "waiting", prompt: buildImagePrompt(topic, "00") },
      "01": { status: "waiting", prompt: buildImagePrompt(topic, "01") },
      "02": { status: "waiting", prompt: buildImagePrompt(topic, "02") },
      "03": { status: "waiting", prompt: buildImagePrompt(topic, "03") },
    },
  };
}

function cleanFolderName(topic: Topic) {
  const short = topic.title.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 40);
  return `${String(topic.id).padStart(2, "0")}_${short || "paramma"}`;
}

function imageKey(topicId: number, slotId: SlotId) {
  return `topic-${topicId}/slot-${slotId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("이미지 저장소를 열 수 없습니다."));
  });
}

async function idbGet(topicId: number, slotId: SlotId): Promise<ImageRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(imageKey(topicId, slotId));
    req.onsuccess = () => resolve((req.result as ImageRecord | undefined) || null);
    req.onerror = () => reject(req.error || new Error("이미지를 불러오지 못했습니다."));
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(topicId: number, slotId: SlotId, record: ImageRecord) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(record, imageKey(topicId, slotId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("이미지를 저장하지 못했습니다.")); };
  });
}

async function idbDelete(topicId: number, slotId: SlotId) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(imageKey(topicId, slotId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("이미지를 삭제하지 못했습니다.")); };
  });
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 파일을 읽을 수 없습니다."));
    img.src = src;
  });
}

async function convertToPng(file: File, targetWidth: number, targetHeight: number) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 등록할 수 있습니다.");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PNG 변환 기능을 사용할 수 없습니다.");
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((out) => out ? resolve(out) : reject(new Error("PNG 변환에 실패했습니다.")), "image/png");
    });
    const actualRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = targetWidth / targetHeight;
    const gap = Math.abs(actualRatio - targetRatio) / targetRatio;
    const warning = gap > 0.04
      ? `목표 비율과 다릅니다. 원본 ${img.naturalWidth}×${img.naturalHeight}px 그대로 보존하며 자르거나 늘리지 않았습니다.`
      : "";
    return { blob, width: img.naturalWidth, height: img.naturalHeight, warning };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function hasPngSignature(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  return png.every((value, index) => bytes[index] === value);
}

function buildNextTenPrompt() {
  const previous = TOPICS.map((t) => `${t.id}. [${t.category}] ${t.title}`).join("\n");
  return `Paramma 블로거의 다음 발행 순서 10개를 새로 추천해줘.

현재 날짜 기준으로 계절성·검색성·생활 궁금증·블로그 색깔을 함께 고려해줘.

[운영 카테고리]
- 신기한 동물이야기
- 신비로운 자연
- 생활 속 궁금증

[운영 방식]
- 탭별로 따로 추천하지 말고 세 카테고리를 한 개의 발행 큐에 섞을 것.
- 1번부터 10번까지 실제로 올릴 순서를 정해줄 것.
- 검색형·생활형 소재를 중심으로 하되 희귀하고 신기한 소재도 일부 섞을 것.
- 대략 검색형 70%, 희귀·신기형 30% 느낌으로 구성.
- 같은 종류의 소재가 연속해서 몰리지 않게 할 것.
- 계절에 맞지 않는 주제는 우선순위를 낮출 것.
- 아래 이전 10개와 동일하거나 지나치게 비슷한 주제는 제외할 것.
- 각 항목에 카테고리와 한 줄 기획 의도를 함께 표시할 것.

[이전 10개]
${previous}

최종 출력은 1~10번 표로 깔끔하게 정리해줘.`;
}

export default function ParammaBulkPage() {
  const [selectedId, setSelectedId] = useState(1);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [works, setWorks] = useState<Record<number, TopicWork>>({});
  const [images, setImages] = useState<Partial<Record<SlotId, LoadedImage>>>({});
  const [notice, setNotice] = useState("");
  const [naverCopyMessage, setNaverCopyMessage] = useState("");
  const [imageBusy, setImageBusy] = useState<SlotId | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const previewUrls = useRef<string[]>([]);

  const selected = TOPICS.find((t) => t.id === selectedId) || TOPICS[0];
  const work = works[selected.id] || defaultWork(selected);
  const articleChatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(work.articlePrompt);
  const naverBlocks = useMemo(() => parseNaverBlog(work.body), [work.body]);
  const doneCount = useMemo(() => TOPICS.filter((t) => statuses[t.id] === "done").length, [statuses]);
  const progress = Math.round((doneCount / TOPICS.length) * 100);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.statuses) setStatuses(parsed.statuses);
        if (parsed?.selectedId && TOPICS.some((t) => t.id === parsed.selectedId)) setSelectedId(parsed.selectedId);
        if (parsed?.works) setWorks(refreshLegacyImagePrompts(parsed.works));
      }
    } catch {
      setNotice("이전 작업 정보 일부를 불러오지 못했습니다.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ statuses, selectedId, works }));
    } catch {
      setNotice("작업 상태 저장에 실패했습니다. 브라우저 저장공간을 확인해주세요.");
    }
  }, [hydrated, statuses, selectedId, works]);

  useEffect(() => {
    let cancelled = false;
    async function restoreImages() {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      const next: Partial<Record<SlotId, LoadedImage>> = {};
      for (const slotId of SLOT_IDS) {
        try {
          const record = await idbGet(selected.id, slotId);
          if (record) {
            const url = URL.createObjectURL(record.blob);
            previewUrls.current.push(url);
            next[slotId] = { ...record, url };
          }
        } catch {}
      }
      if (cancelled) {
        Object.values(next).forEach((item) => item && URL.revokeObjectURL(item.url));
        return;
      }
      setImages(next);
      setWorks((prev) => {
        const base = prev[selected.id] || defaultWork(selected);
        let changed = false;
        const slots = { ...base.slots };
        for (const slotId of SLOT_IDS) {
          const registered = !!next[slotId];
          if (registered && slots[slotId].status !== "registered") {
            slots[slotId] = { ...slots[slotId], status: "registered", width: next[slotId]?.width, height: next[slotId]?.height };
            changed = true;
          } else if (!registered && slots[slotId].status === "registered") {
            slots[slotId] = { ...slots[slotId], status: "waiting", width: undefined, height: undefined, warning: undefined };
            changed = true;
          }
        }
        return changed ? { ...prev, [selected.id]: { ...base, slots } } : prev;
      });
    }
    void restoreImages();
    return () => { cancelled = true; };
  }, [selected.id]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function ensureWork(topicId = selected.id) {
    const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0];
    return works[topicId] || defaultWork(topic);
  }

  function patchWork(patch: Partial<TopicWork>, topicId = selected.id) {
    setWorks((prev) => {
      const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0];
      const base = prev[topicId] || defaultWork(topic);
      return { ...prev, [topicId]: { ...base, ...patch } };
    });
  }

  function patchSlot(slotId: SlotId, patch: Partial<SlotMeta>, topicId = selected.id) {
    setWorks((prev) => {
      const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0];
      const base = prev[topicId] || defaultWork(topic);
      return {
        ...prev,
        [topicId]: {
          ...base,
          slots: { ...base.slots, [slotId]: { ...base.slots[slotId], ...patch } },
        },
      };
    });
  }

  function statusOf(id: number): Status {
    return statuses[id] || "waiting";
  }

  function selectTopic(id: number) {
    setSelectedId(id);
    setNotice("");
  }

  function startTopic(id: number) {
    setSelectedId(id);
    setStatuses((prev) => ({ ...prev, [id]: prev[id] === "done" ? "done" : "working" }));
    if (!works[id]) {
      const topic = TOPICS.find((t) => t.id === id) || TOPICS[0];
      setWorks((prev) => ({ ...prev, [id]: defaultWork(topic) }));
    }
  }

  function completeTopic(id: number) {
    setStatuses((prev) => ({ ...prev, [id]: "done" }));
    const next = TOPICS.find((t) => t.id > id && statusOf(t.id) !== "done");
    if (next) setSelectedId(next.id);
    setNotice(next ? `${id}번 완료. 다음 ${next.id}번으로 이동했습니다.` : "이번 10개가 모두 끝났습니다. 다음 10개를 요청할 차례예요.");
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
      return true;
    } catch {
      setNotice("클립보드 복사에 실패했습니다. 요청서 내용을 직접 선택해 복사해주세요.");
      return false;
    }
  }

  async function copyArticlePrompt() {
    startTopic(selected.id);
    const current = ensureWork();
    await copyText(current.articlePrompt, `${selected.id}번 본문·이미지 기획 요청서를 복사했습니다.`);
  }

  async function copyImagePrompt(slotId: SlotId) {
    const current = ensureWork();
    const meta = current.slots[slotId];
    const copied = await copyText(
      meta.prompt,
      `${slotId} ${SLOT_INFO[slotId].label} 요청서를 복사했습니다. ChatGPT 새 채팅에서 Ctrl+V로 붙여넣으세요.`
    );
    if (!copied) return;
    startTopic(selected.id);
    if (meta.status !== "registered") patchSlot(slotId, { status: "working" });
  }

  async function copyNaverRichText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("완성 본문을 먼저 입력해 주세요.");
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
        setNaverCopyMessage("✅ 네이버 서식 포함 전체복사 완료 · 네이버에서 Ctrl+V 하세요.");
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
      setNaverCopyMessage("완성 본문을 먼저 입력해 주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(naverPlainText(naverBlocks));
      setNaverCopyMessage("✅ 한줄띄기 안전복사 완료 · 폰트는 네이버 기본 설정을 사용합니다.");
    } catch {
      setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  async function handleUpload(slotId: SlotId, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const info = SLOT_INFO[slotId];
    const oldImage = images[slotId];
    setImageBusy(slotId);
    setNotice("");
    try {
      const converted = await convertToPng(file, info.width, info.height);
      const record: ImageRecord = { blob: converted.blob, width: converted.width, height: converted.height, updatedAt: new Date().toISOString() };
      await idbPut(selected.id, slotId, record);
      const url = URL.createObjectURL(record.blob);
      previewUrls.current.push(url);
      setImages((prev) => {
        if (prev[slotId]?.url) URL.revokeObjectURL(prev[slotId]!.url);
        return { ...prev, [slotId]: { ...record, url } };
      });
      patchSlot(slotId, { status: "registered", width: record.width, height: record.height, warning: converted.warning, updatedAt: record.updatedAt });
      setNotice(`${slotId} 이미지를 실제 PNG로 변환해 등록했습니다.${converted.warning ? " 비율 경고를 확인해주세요." : ""}`);
    } catch (error: any) {
      setNotice(oldImage
        ? `이미지 교체에 실패했습니다. 기존 ${slotId} 이미지는 그대로 보존했습니다. ${error?.message || ""}`
        : `이미지 등록에 실패했습니다. ${error?.message || ""}`);
    } finally {
      setImageBusy(null);
    }
  }

  async function deleteImage(slotId: SlotId) {
    if (!images[slotId]) return;
    if (!window.confirm(`${slotId} 등록 이미지를 실제로 삭제할까요?`)) return;
    try {
      await idbDelete(selected.id, slotId);
      const oldUrl = images[slotId]?.url;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      setImages((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      patchSlot(slotId, { status: "waiting", width: undefined, height: undefined, warning: undefined, updatedAt: undefined });
      setNotice(`${slotId} 이미지를 삭제했습니다.`);
    } catch (error: any) {
      setNotice(`이미지 삭제에 실패했습니다. ${error?.message || ""}`);
    }
  }

  function toggleOptional03() {
    const next = !work.optional03;
    patchWork({ optional03: next });
    setNotice(!next && images["03"]
      ? "선택 이미지 03을 사용 안 함으로 바꿨습니다. 등록된 이미지는 삭제하지 않고 보관하며 ZIP에서만 제외합니다."
      : next
        ? "선택 이미지 03을 활성화했습니다. ZIP 전에 이미지를 등록하거나 다시 선택 해제해야 합니다."
        : "선택 이미지 03을 사용하지 않습니다.");
  }

  const requiredSlots: SlotId[] = ["00", "01", "02"];
  const missingRequired = requiredSlots.filter((slotId) => !images[slotId]);
  const optionalMissing = work.optional03 && !images["03"];
  const bodyReady = work.body.trim().length > 0 && work.bodyConfirmed;
  const canZip = bodyReady && missingRequired.length === 0 && !optionalMissing;

  async function downloadZip() {
    if (!canZip) {
      setNotice("최종 검수 조건을 먼저 충족해주세요.");
      return;
    }
    setZipBusy(true);
    setNotice("");
    try {
      const current = ensureWork();
      const zip = new JSZip();
      const folder = zip.folder(cleanFolderName(selected));
      if (!folder) throw new Error("ZIP 폴더를 만들 수 없습니다.");
      const includeSlots: SlotId[] = current.optional03 ? ["00", "01", "02", "03"] : ["00", "01", "02"];
      for (const slotId of includeSlots) {
        const record = await idbGet(selected.id, slotId);
        if (!record) throw new Error(`${slotId} 이미지가 없습니다.`);
        if (!(await hasPngSignature(record.blob))) throw new Error(`${slotId} 파일의 실제 형식이 PNG가 아닙니다.`);
        folder.file(SLOT_INFO[slotId].filename, record.blob);
      }
      folder.file("final_post.txt", current.body);
      folder.file("article_request.txt", current.articlePrompt);
      folder.file("image_prompts.txt", includeSlots.map((slotId) => `[${slotId} ${SLOT_INFO[slotId].label}]\n${current.slots[slotId].prompt}`).join("\n\n====================\n\n"));
      folder.file("project.json", JSON.stringify({ topic: selected, bodyConfirmed: current.bodyConfirmed, optional03: current.optional03, slots: current.slots, exportedAt: new Date().toISOString() }, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanFolderName(selected)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("최종 검수 통과. 글별 폴더 구조의 ZIP을 만들었습니다.");
    } catch (error: any) {
      setNotice(`ZIP 생성에 실패했습니다. ${error?.message || ""}`);
    } finally {
      setZipBusy(false);
    }
  }

  async function requestNextTen() {
    await copyText(buildNextTenPrompt(), "다음 10개 추천 요청서를 복사했습니다. ChatGPT에 붙여넣으세요.");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  function resetProgress() {
    if (!window.confirm("이번 10개의 진행 상태와 본문·요청서 설정을 초기화할까요? 등록 이미지는 별도 삭제하지 않습니다.")) return;
    setStatuses({});
    setWorks({});
    setSelectedId(1);
    setNotice("진행 상태와 글 설정을 초기화했습니다. 등록 이미지 파일은 보존했습니다.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a href="/" className={styles.homeLink}>← 콘텐츠 메이커</a>
        <div className={styles.brand}>🌿 Paramma 블로거</div>
        <button type="button" className={styles.resetButton} onClick={resetProgress}>진행 초기화</button>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PARAMMA PUBLISH QUEUE</p>
          <h1>이번 발행 10개</h1>
          <p>본문·이미지 기획 확정 → 여러 ChatGPT 창에 이미지 요청서 전달 → 본문 검수 → 이미지 등록 → 최종 검수·ZIP 순서로 진행합니다.</p>
        </div>
        <div className={styles.progressCard}>
          <div><b>{doneCount}</b><span>/ 10 완료</span></div>
          <div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div>
          <small>{progress}% 진행</small>
        </div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.layout}>
        <div className={styles.queuePanel}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>PUBLISH ORDER</p>
              <h2>1번부터 순서대로</h2>
            </div>
            <span>카테고리는 배지로만 표시</span>
          </div>

          <div className={styles.queue}>
            {TOPICS.map((topic) => {
              const status = statusOf(topic.id);
              const selectedNow = selected.id === topic.id;
              return (
                <button
                  type="button"
                  key={topic.id}
                  className={`${styles.topicCard} ${selectedNow ? styles.selected : ""} ${status === "done" ? styles.done : ""}`}
                  onClick={() => selectTopic(topic.id)}
                >
                  <span className={styles.number}>{String(topic.id).padStart(2, "0")}</span>
                  <div className={styles.topicMain}>
                    <span className={`${styles.category} ${categoryClass(topic.category)}`}>
                      {categoryEmoji(topic.category)} {topic.category}
                    </span>
                    <b>{topic.title}</b>
                    <small>{topic.brief}</small>
                  </div>
                  <span className={`${styles.status} ${styles[status]}`}>
                    {status === "done" ? "완료" : status === "working" ? "진행 중" : "대기"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.nextBatch}>
            <div>
              <b>10개가 끝났나요?</b>
              <span>현재 10개와 겹치지 않도록 다음 발행 10개를 ChatGPT에 요청합니다.</span>
            </div>
            <button type="button" onClick={() => void requestNextTen()}>다음 10개 요청하기</button>
          </div>
        </div>

        <div className={styles.workColumn}>
          <section className={styles.workPanel}>
            <p className={styles.eyebrow}>01 · BODY & PLAN</p>
            <div className={styles.currentNo}>{String(selected.id).padStart(2, "0")}</div>
            <span className={`${styles.category} ${categoryClass(selected.category)}`}>
              {categoryEmoji(selected.category)} {selected.category}
            </span>
            <h2>{selected.title}</h2>
            <p className={styles.brief}>{selected.brief}</p>

            <div className={styles.primaryActions}>
              <a
                className={styles.primary}
                href={articleChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  startTopic(selected.id);
                  void copyText(work.articlePrompt, `${selected.id}번 본문·이미지 기획 요청서를 복사했습니다.`);
                }}
              >
                📝 본문·이미지 기획 요청서 복사 + 열기
              </a>
              <button type="button" className={styles.secondary} onClick={() => void copyArticlePrompt()}>
                요청서만 복사
              </button>
            </div>

            <details className={styles.promptDetails}>
              <summary>본문 요청서 확인·수정</summary>
              <textarea value={work.articlePrompt} onChange={(e) => patchWork({ articlePrompt: e.target.value })} />
            </details>

            <label className={styles.bodyLabel}>
              <span>ChatGPT 완성 본문 붙여넣기</span>
              <textarea
                className={styles.bodyEditor}
                value={work.body}
                onChange={(e) => patchWork({ body: e.target.value, bodyConfirmed: false })}
                placeholder="최종 제목 + 본문 + 태그를 붙여넣으세요."
              />
            </label>
            <button
              type="button"
              className={`${styles.confirmButton} ${work.bodyConfirmed ? styles.confirmed : ""}`}
              disabled={!work.body.trim()}
              onClick={() => patchWork({ bodyConfirmed: !work.bodyConfirmed })}
            >
              {work.bodyConfirmed ? "✓ 본문 검수 완료" : "본문 검수 완료로 표시"}
            </button>
          </section>

          <section className={styles.imageSection}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.eyebrow}>02 · PARALLEL IMAGE WORK</p>
                <h2>이미지 요청서를 여러 창에 나눠 작업</h2>
              </div>
              <span>복사 → 작업 중 → 파일 등록</span>
            </div>

            <div className={styles.imageGrid}>
              {SLOT_IDS.map((slotId) => {
                const info = SLOT_INFO[slotId];
                const meta = work.slots[slotId];
                const image = images[slotId];
                const optionalInactive = slotId === "03" && !work.optional03;
                const chatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(meta.prompt);
                return (
                  <article key={slotId} className={`${styles.imageCard} ${optionalInactive ? styles.inactiveCard : ""}`}>
                    <div className={styles.imageCardHead}>
                      <div>
                        <span className={styles.slotNo}>{slotId}</span>
                        <b>{info.label}</b>
                        <small>{info.width}×{info.height}px 제작 목표</small>
                      </div>
                      <span className={`${styles.slotStatus} ${styles[meta.status]}`}>
                        {meta.status === "registered" ? "등록 완료" : meta.status === "working" ? "작업 중" : "대기"}
                      </span>
                    </div>

                    {slotId === "03" && (
                      <button type="button" className={styles.optionalToggle} onClick={toggleOptional03}>
                        {work.optional03 ? "✓ 선택 이미지 03 사용 중 · 선택 해제" : "+ 선택 이미지 03 사용"}
                      </button>
                    )}

                    {optionalInactive && image && (
                      <div className={styles.retained}>등록 이미지 보관 중 · 현재 ZIP에서는 제외</div>
                    )}

                    <div className={styles.preview}>
                      {image ? (
                        <img src={image.url} alt={`${slotId} 미리보기`} />
                      ) : (
                        <div><b>이미지 미등록</b><span>다른 ChatGPT 창에서 만든 이미지를 여기에 등록</span></div>
                      )}
                    </div>

                    {image && <div className={styles.imageMeta}>{image.width}×{image.height}px · 실제 PNG 저장</div>}
                    {meta.warning && <div className={styles.ratioWarning}>⚠ {meta.warning}</div>}

                    <div className={styles.imageActions}>
                      <button type="button" onClick={() => void copyImagePrompt(slotId)} disabled={optionalInactive}>
                        요청서 복사
                      </button>
                      {optionalInactive ? (
                        <span className={styles.chatLinkDisabled} aria-disabled="true">ChatGPT 열기</span>
                      ) : (
                        <a
                          href={chatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            startTopic(selected.id);
                            if (meta.status !== "registered") patchSlot(slotId, { status: "working" });
                          }}
                        >
                          ChatGPT 열기
                        </a>
                      )}
                    </div>

                    <details className={styles.slotPrompt}>
                      <summary>요청서 확인·수정</summary>
                      <textarea
                        value={meta.prompt}
                        onChange={(e) => patchSlot(slotId, { prompt: e.target.value })}
                        disabled={optionalInactive}
                      />
                    </details>

                    <div className={styles.uploadRow}>
                      <label className={`${styles.uploadButton} ${imageBusy === slotId ? styles.busy : ""}`}>
                        {imageBusy === slotId ? "PNG 변환 중…" : image ? "이미지 교체" : "이미지 등록"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => void handleUpload(slotId, e)}
                          disabled={imageBusy !== null || optionalInactive}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => void deleteImage(slotId)}
                        disabled={!image || imageBusy !== null}
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.naverEditor}>
            <div className={styles.naverEditorHead}>
              <div>
                <p className={styles.eyebrow}>03 · NAVER FINAL COPY</p>
                <h2>네이버 최종 편집 · 전체복사</h2>
                <span>현재 저장된 완성 본문에 제목 20pt · 소제목 18pt · 본문 15pt · 태그 13~14pt와 한 줄 띄기를 적용합니다.</span>
              </div>
            </div>

            <div className={styles.naverPreviewPane}>
              <div className={styles.naverPreviewHead}>
                <b>네이버 붙여넣기 미리보기</b>
                <span>{naverBlocks.length ? `${naverBlocks.length}개 블록 자동 인식` : "완성 본문을 입력하면 미리보기가 나타납니다."}</span>
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
                        styles.naverBody
                      }
                    >
                      {block.text}
                    </div>
                    {index < naverBlocks.length - 1 && <div className={styles.naverSpacer} aria-hidden="true">&nbsp;</div>}
                  </div>
                )) : (
                  <div className={styles.naverPreviewEmpty}>제목 · 소제목 · 본문 · 태그의 실제 크기와 한 줄 띄기를 여기서 확인할 수 있습니다.</div>
                )}
              </div>
            </div>

            <div className={styles.naverCopyActions}>
              <button type="button" className={styles.naverPrimaryCopy} onClick={() => void copyNaverRichText()}>
                네이버 서식 포함 전체복사
              </button>
              <button type="button" onClick={() => void copyNaverSafeText()}>
                한줄띄기 안전복사
              </button>
              <span>기본은 서식 포함 전체복사 → 네이버 Ctrl+V</span>
            </div>

            {naverCopyMessage && <div className={styles.naverCopyNotice}>{naverCopyMessage}</div>}
          </section>

          <section className={styles.reviewPanel}>
            <div className={styles.sectionHead}>
              <div><p className={styles.eyebrow}>04 · FINAL REVIEW & ZIP</p><h2>최종 검수</h2></div>
              <span>{canZip ? "ZIP 준비 완료" : "필수 항목 확인 필요"}</span>
            </div>

            <div className={styles.checkList}>
              <div className={bodyReady ? styles.pass : styles.fail}>
                <span>{bodyReady ? "✓" : "!"}</span>
                <p><b>본문</b><small>{work.body.trim() ? (work.bodyConfirmed ? "본문 입력·검수 완료" : "본문은 입력됐지만 검수 완료 표시가 필요합니다.") : "본문을 붙여넣어야 합니다."}</small></p>
              </div>
              {requiredSlots.map((slotId) => (
                <div key={slotId} className={images[slotId] ? styles.pass : styles.fail}>
                  <span>{images[slotId] ? "✓" : "!"}</span>
                  <p><b>{slotId} {SLOT_INFO[slotId].label}</b><small>{images[slotId] ? `${images[slotId]!.width}×${images[slotId]!.height}px · 실제 PNG` : "필수 이미지가 없습니다."}</small></p>
                </div>
              ))}
              <div className={!work.optional03 || images["03"] ? styles.pass : styles.fail}>
                <span>{!work.optional03 || images["03"] ? "✓" : "!"}</span>
                <p>
                  <b>03 선택 이미지</b>
                  <small>
                    {work.optional03
                      ? (images["03"] ? "사용함 · 이미지 등록 완료" : "사용 중이므로 이미지를 등록하거나 선택 해제해야 합니다.")
                      : images["03"] ? "사용 안 함 · 등록 이미지는 보관 중, ZIP 제외" : "사용 안 함"}
                  </small>
                </p>
              </div>
            </div>

            {missingRequired.length > 0 && <div className={styles.blocker}>필수 이미지 누락: {missingRequired.join(", ")}</div>}
            {optionalMissing && <div className={styles.blocker}>선택 이미지 03을 활성화했습니다. 이미지를 등록하거나 선택 해제해주세요.</div>}

            <div className={styles.zipInfo}>
              <b>ZIP 내부 글별 폴더</b>
              <code>{cleanFolderName(selected)}/</code>
              <span>00_thumbnail.png · 01_body.png · 02_body.png{work.optional03 ? " · 03_body.png" : ""} · final_post.txt · 요청서 파일</span>
            </div>

            <div className={styles.finalActions}>
              <button type="button" className={styles.zipButton} disabled={!canZip || zipBusy} onClick={() => void downloadZip()}>
                {zipBusy ? "PNG 확인·ZIP 생성 중…" : "최종 검수 통과 · ZIP 다운로드"}
              </button>
              <button type="button" className={styles.completeButton} onClick={() => completeTopic(selected.id)}>
                ✓ 이 글 발행 완료
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
