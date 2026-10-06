import { NextRequest, NextResponse } from "next/server";
import { makePresaleDiscoveryPrompt } from "../../../../lib/apartment-presale-candidates.mjs";

type CandidateStage = "planned" | "later" | "watch" | "notice" | "followup";
type CandidateArea = "서울" | "경기" | "인천";

type RawCandidate = {
  name: string;
  region: string;
  area: CandidateArea;
  stage: CandidateStage;
  status: string;
  schedule: string;
  supply: string;
  supplyNote: string;
  interest: string;
  kick: string;
  topic: string;
  sourceUrl: string;
  sourceLabel: string;
  officialUrl: string;
  officialLabel: string;
  caution: string;
  eventKey: string;
};

const STAGES = new Set<CandidateStage>(["planned", "later", "watch", "notice", "followup"]);
const AREAS = new Set<CandidateArea>(["서울", "경기", "인천"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;

type GlobalWithPresaleRate = typeof globalThis & {
  __presaleDiscoveryRate?: Map<string, number[]>;
};

function sameSiteRequest(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  const secFetchSite = req.headers.get("sec-fetch-site") || "";
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) return false;
  if (!origin) return process.env.VERCEL_ENV !== "production";
  try {
    const url = new URL(origin);
    if (url.hostname === "content-maker-chi.vercel.app") return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    return /^content-maker-[a-z0-9-]+-skrwl24-4137\.vercel\.app$/i.test(url.hostname)
      || /^content-maker-git-[a-z0-9-]+-skrwl24-4137\.vercel\.app$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function rateAllowed(req: NextRequest) {
  const g = globalThis as GlobalWithPresaleRate;
  const store = g.__presaleDiscoveryRate || new Map<string, number[]>();
  g.__presaleDiscoveryRate = store;
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (store.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  store.set(ip, recent);
  return true;
}

function safeText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function httpsUrl(value: unknown) {
  const text = safeText(value, 1200);
  try {
    const parsed = new URL(text);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeCandidate(raw: RawCandidate, existingIds: Set<string>) {
  const stage = STAGES.has(raw.stage) ? raw.stage : "watch";
  const area = AREAS.has(raw.area) ? raw.area : null;
  const name = safeText(raw.name, 120);
  const region = safeText(raw.region, 120);
  const eventKey = safeText(raw.eventKey, 180).toLowerCase().replace(/\s+/g, "-");
  const sourceUrl = httpsUrl(raw.sourceUrl);
  const officialUrl = httpsUrl(raw.officialUrl);
  if (!area || !name || !region || !eventKey || !sourceUrl || !officialUrl) return null;
  const id = "live-" + stableHash([name, region, eventKey].join("|"));
  if (existingIds.has(id)) return null;
  return {
    id,
    name,
    region,
    area,
    stage,
    status: safeText(raw.status, 180),
    schedule: safeText(raw.schedule, 240),
    supply: safeText(raw.supply, 300),
    supplyNote: safeText(raw.supplyNote, 320),
    interest: safeText(raw.interest, 420),
    kick: safeText(raw.kick, 520),
    topic: safeText(raw.topic, 220),
    sourceUrl,
    sourceLabel: safeText(raw.sourceLabel, 180),
    officialUrl,
    officialLabel: safeText(raw.officialLabel, 180),
    caution: safeText(raw.caution, 520),
  };
}

function outputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type !== "message") continue;
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

const CANDIDATE_SCHEMA = {
  type: "object",
  properties: {
    checkedAt: { type: "string", description: "YYYY-MM-DD 조사 기준일" },
    summary: { type: "string", description: "이번 조사에서 새로 잡힌 핵심 변화 요약" },
    questions: {
      type: "array",
      items: { type: "string" },
      description: "공식 공고가 아직 없어 다음에 재확인해야 할 상위 질문",
    },
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          region: { type: "string" },
          area: { type: "string", enum: ["서울", "경기", "인천"] },
          stage: { type: "string", enum: ["planned", "later", "watch", "notice", "followup"] },
          status: { type: "string" },
          schedule: { type: "string" },
          supply: { type: "string" },
          supplyNote: { type: "string" },
          interest: { type: "string" },
          kick: { type: "string" },
          topic: { type: "string" },
          sourceUrl: { type: "string" },
          sourceLabel: { type: "string" },
          officialUrl: { type: "string" },
          officialLabel: { type: "string" },
          caution: { type: "string" },
          eventKey: {
            type: "string",
            description: "같은 단지의 사건을 구분하는 안정적 키. 예: notice-2026-10-07, resupply-2026-10-12, schedule-change-2026-10-08",
          },
        },
        required: [
          "name", "region", "area", "stage", "status", "schedule", "supply", "supplyNote",
          "interest", "kick", "topic", "sourceUrl", "sourceLabel", "officialUrl", "officialLabel",
          "caution", "eventKey",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["checkedAt", "summary", "questions", "candidates"],
  additionalProperties: false,
};

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!sameSiteRequest(req)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  if (!rateAllowed(req)) {
    return NextResponse.json({ error: "자동 조사는 10분에 최대 3회까지 실행할 수 있습니다." }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const dateKey = safeText(body?.dateKey, 20) || new Date().toISOString().slice(0, 10);
    const existingIds = new Set<string>(
      Array.isArray(body?.existingIds)
        ? body.existingIds.filter((value: unknown): value is string => typeof value === "string").slice(0, 300)
        : [],
    );
    const published = Array.isArray(body?.publishedCandidates) ? body.publishedCandidates.slice(0, 120) : [];
    const existing = Array.isArray(body?.existingCandidates) ? body.existingCandidates.slice(0, 160) : [];

    const prompt = [
      makePresaleDiscoveryPrompt(dateKey, published),
      "",
      "[현재 Discover에 이미 있는 소재 · 같은 사건이면 중복 추가 금지]",
      ...existing.map((item: any) => "- " + [safeText(item?.name, 120), safeText(item?.region, 100), safeText(item?.status, 140), safeText(item?.topic, 200)].filter(Boolean).join(" · ")),
      "",
      "[자동 등록 규칙]",
      "- 웹 검색을 실제로 수행해 2026년 현재 유효한 자료인지 확인한다.",
      "- 공식 모집공고가 있으면 SH·서울주거포털·LH청약플러스·청약홈·GH·사업주체 공식자료를 sourceUrl 또는 officialUrl 중 하나에 반드시 넣는다.",
      "- 공식 공고가 없으면 상태를 watch/planned/later로 두고, 확정 조건·가격·접수일을 만들어내지 않는다.",
      "- 같은 단지라도 이전 글과 다른 새 사건일 때만 반환한다. eventKey는 단지명이 아니라 사건 종류와 핵심 날짜를 반영한다.",
      "- sourceUrl과 officialUrl은 실제로 확인한 https URL만 반환한다. 존재하지 않는 URL을 추측하지 않는다.",
      "- 전체 세대수와 금회 물량, 아파트와 오피스텔, 사전예약과 본청약을 문장 안에서도 명확히 구분한다.",
      "- 후보가 충분하지 않으면 억지로 8개를 채우지 말고 검증된 새 후보만 반환한다.",
      "- topic은 네이버 블로그에 바로 쓸 수 있는 후킹형 제목으로 만든다.",
    ].join("\n");

    const model = process.env.PRESALE_DISCOVERY_MODEL || "gpt-5.6";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search", search_context_size: "medium" }],
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "presale_discovery",
            strict: true,
            schema: CANDIDATE_SCHEMA,
          },
        },
        max_output_tokens: 12000,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = safeText(payload?.error?.message, 500) || "OpenAI 웹 조사 호출에 실패했습니다.";
      return NextResponse.json({ error: message }, { status: response.status >= 500 ? 502 : 400 });
    }

    const text = outputText(payload);
    if (!text) return NextResponse.json({ error: "웹 조사 결과가 비어 있습니다." }, { status: 502 });

    const parsed = JSON.parse(text);
    const candidates = (Array.isArray(parsed?.candidates) ? parsed.candidates : [])
      .map((item: RawCandidate) => normalizeCandidate(item, existingIds))
      .filter(Boolean)
      .slice(0, 12);

    return NextResponse.json({
      checkedAt: safeText(parsed?.checkedAt, 20) || dateKey,
      summary: safeText(parsed?.summary, 1200),
      questions: (Array.isArray(parsed?.questions) ? parsed.questions : []).map((item: unknown) => safeText(item, 400)).filter(Boolean).slice(0, 12),
      candidates,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동 조사 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }
  const synthetic = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({
      dateKey: "2026-10-07",
      existingIds: [],
      publishedCandidates: [
        { name: "고덕강일3단지", region: "서울 강동구", status: "기존 글 발행 완료", topic: "고덕강일3단지 기존 발행 소재" }
      ],
      existingCandidates: [
        { name: "고덕강일3단지", region: "서울 강동구", status: "기존 글 발행 완료", topic: "고덕강일3단지 기존 발행 소재" }
      ]
    }),
  });
  return POST(synthetic);
}
