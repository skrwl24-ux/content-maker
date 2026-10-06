import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { createApartmentAdminClient } from "@/lib/apartment-server";
import {
  PRESALE_CANDIDATES,
  makePresaleDiscoveryPrompt,
} from "../../../../lib/apartment-presale-candidates.mjs";

type CandidateStage = "planned" | "later" | "watch" | "notice" | "followup";
type CandidateArea = "서울" | "경기" | "인천";
type PublicationStatus = "queue" | "published";

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

type StoredCandidate = RawCandidate & {
  id: string;
  publicationStatus: PublicationStatus;
  origin: "baseline" | "ai" | "manual";
  checkedAt: string;
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
    eventKey,
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

function baselineCandidate(id: string) {
  return PRESALE_CANDIDATES.find((item) => item.id === id) || null;
}

function rowToCandidate(row: any): StoredCandidate | null {
  const base = row?.origin === "baseline" ? baselineCandidate(String(row.id || "")) : null;
  const value = base || (row?.candidate_json && typeof row.candidate_json === "object" ? row.candidate_json : null);
  if (!value) return null;

  return {
    ...value,
    id: String(row.id || value.id || ""),
    eventKey: safeText(row.event_key || value.eventKey || "", 180),
    publicationStatus: row.publication_status === "queue" ? "queue" : "published",
    origin: row.origin === "baseline" || row.origin === "manual" ? row.origin : "ai",
    checkedAt: safeText(row.checked_at, 20),
  } as StoredCandidate;
}

function fallbackCandidates(): StoredCandidate[] {
  return PRESALE_CANDIDATES.map((item) => ({
    ...item,
    eventKey: "baseline-2026-10-04",
    publicationStatus: "published" as const,
    origin: "baseline" as const,
    checkedAt: "2026-10-04",
  }));
}

async function loadStoredCandidates(client: ReturnType<typeof createApartmentAdminClient>) {
  if (!client) return fallbackCandidates();
  const { data, error } = await client
    .from("presale_discovery_candidates")
    .select("id,event_key,candidate_json,publication_status,origin,checked_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToCandidate).filter((item): item is StoredCandidate => Boolean(item));
}

type NormalizedCandidate = NonNullable<ReturnType<typeof normalizeCandidate>>;

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

async function resolveAiAuth() {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return { apiKey: openAiKey, useGateway: false, provider: "openai-direct" as const };
  }

  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey) {
    return { apiKey: gatewayKey, useGateway: true, provider: "vercel-ai-gateway-key" as const };
  }

  try {
    const oidcToken = await getVercelOidcToken();
    if (oidcToken) {
      return { apiKey: oidcToken, useGateway: true, provider: "vercel-ai-gateway-oidc" as const };
    }
  } catch {
    // Older/local environments may not have an OIDC request context.
  }

  return { apiKey: "", useGateway: false, provider: null };
}

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameSiteRequest(req)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  if (!rateAllowed(req)) {
    return NextResponse.json({ error: "자동 조사는 10분에 최대 3회까지 실행할 수 있습니다." }, { status: 429 });
  }

  const client = createApartmentAdminClient();
  if (!client) {
    return NextResponse.json({ error: "후보 저장소를 사용할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 설정을 확인해 주세요." }, { status: 503 });
  }

  const auth = await resolveAiAuth();
  if (!auth.apiKey) {
    return NextResponse.json({ error: "자동 조사용 AI 인증을 사용할 수 없습니다. Vercel AI Gateway OIDC 또는 OpenAI API 설정을 확인해 주세요." }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dateKey = safeText(body?.dateKey, 20) || new Date().toISOString().slice(0, 10);
    const existing = await loadStoredCandidates(client);
    const existingIds = new Set(existing.map((item) => item.id));
    const published = existing.filter((item) => item.publicationStatus === "published");

    const prompt = [
      makePresaleDiscoveryPrompt(dateKey, published),
      "",
      "[현재 Discover에 이미 있는 소재 · 같은 사건이면 중복 추가 금지]",
      ...existing.map((item) => "- " + [item.name, item.region, item.status, item.topic, item.eventKey].filter(Boolean).join(" · ")),
      "",
      "[자동 등록 규칙]",
      "- 웹 검색을 실제로 수행해 기준일 현재 유효한 자료인지 확인한다.",
      "- 공식 모집공고가 있으면 SH·서울주거포털·LH청약플러스·청약홈·GH·사업주체 공식자료를 sourceUrl 또는 officialUrl 중 하나에 반드시 넣는다.",
      "- 공식 공고가 없으면 상태를 watch/planned/later로 두고, 확정 조건·가격·접수일을 만들어내지 않는다.",
      "- 같은 단지라도 이전 글과 다른 새 사건일 때만 반환한다. eventKey는 단지명이 아니라 사건 종류와 핵심 날짜를 반영한다.",
      "- sourceUrl과 officialUrl은 실제로 확인한 https URL만 반환한다. 존재하지 않는 URL을 추측하지 않는다.",
      "- 전체 세대수와 금회 물량, 아파트와 오피스텔, 사전예약과 본청약을 문장 안에서도 명확히 구분한다.",
      "- 후보가 충분하지 않으면 억지로 8개를 채우지 말고 검증된 새 후보만 반환한다.",
      "- topic은 네이버 블로그에 바로 쓸 수 있는 후킹형 제목으로 만든다.",
    ].join("\n");

    const model = auth.useGateway
      ? (process.env.PRESALE_DISCOVERY_GATEWAY_MODEL || "openai/gpt-5.6-sol")
      : (process.env.PRESALE_DISCOVERY_MODEL || "gpt-5.6");
    const endpoint = auth.useGateway
      ? "https://ai-gateway.vercel.sh/v1/responses"
      : "https://api.openai.com/v1/responses";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + auth.apiKey,
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
      const message = safeText(payload?.error?.message, 500) || "웹 조사 호출에 실패했습니다.";
      return NextResponse.json({ error: message }, { status: response.status >= 500 ? 502 : 400 });
    }

    const text = outputText(payload);
    if (!text) return NextResponse.json({ error: "웹 조사 결과가 비어 있습니다." }, { status: 502 });

    const parsed = JSON.parse(text);
    const checkedAt = /^\d{4}-\d{2}-\d{2}$/.test(safeText(parsed?.checkedAt, 20))
      ? safeText(parsed?.checkedAt, 20)
      : dateKey;
    const summary = safeText(parsed?.summary, 1200);
    const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
      .map((item: unknown) => safeText(item, 400))
      .filter(Boolean)
      .slice(0, 12);
    const candidates: NormalizedCandidate[] = (Array.isArray(parsed?.candidates) ? parsed.candidates : [])
      .map((item: RawCandidate) => normalizeCandidate(item, existingIds))
      .filter((item: NormalizedCandidate | null): item is NormalizedCandidate => item !== null)
      .slice(0, 12);

    const provider = auth.provider || "openai-direct";
    const { data: run, error: runError } = await client
      .from("presale_discovery_runs")
      .insert({
        checked_at: checkedAt,
        summary,
        questions,
        provider,
        model,
        candidate_count: candidates.length,
      })
      .select("id")
      .single();
    if (runError) throw runError;

    if (candidates.length) {
      const now = new Date().toISOString();
      const rows = candidates.map((candidate: NormalizedCandidate) => ({
        id: candidate.id,
        event_key: candidate.eventKey,
        candidate_json: candidate,
        publication_status: "queue",
        origin: "ai",
        discovery_run_id: run.id,
        checked_at: checkedAt,
        published_at: null,
        updated_at: now,
      }));
      const { error: saveError } = await client
        .from("presale_discovery_candidates")
        .upsert(rows, { onConflict: "id" });
      if (saveError) throw saveError;
    }

    return NextResponse.json({
      ok: true,
      stored: true,
      checkedAt,
      summary,
      questions,
      candidates,
      model,
      provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동 조사 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!sameSiteRequest(req)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  const client = createApartmentAdminClient();
  if (!client) return NextResponse.json({ error: "후보 저장소를 사용할 수 없습니다." }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = safeText(body?.id, 160);
    const publicationStatus: PublicationStatus | null =
      body?.publicationStatus === "queue" || body?.publicationStatus === "published"
        ? body.publicationStatus
        : null;
    if (!id || !publicationStatus) {
      return NextResponse.json({ error: "후보 ID와 발행 상태가 필요합니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from("presale_discovery_candidates")
      .update({
        publication_status: publicationStatus,
        published_at: publicationStatus === "published" ? now : null,
        updated_at: now,
      })
      .eq("id", id)
      .select("id,event_key,candidate_json,publication_status,origin,checked_at,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "해당 후보를 찾지 못했습니다." }, { status: 404 });

    return NextResponse.json({ ok: true, candidate: rowToCandidate(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "발행 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await resolveAiAuth();
  const client = createApartmentAdminClient();

  try {
    const candidates = await loadStoredCandidates(client);
    const requestedId = safeText(req.nextUrl.searchParams.get("id"), 160);
    if (requestedId) {
      const candidate = candidates.find((item) => item.id === requestedId) || null;
      return NextResponse.json({ candidate, storageAvailable: Boolean(client) }, { status: candidate ? 200 : 404 });
    }

    let latestRun = null;
    if (client) {
      const { data, error } = await client
        .from("presale_discovery_runs")
        .select("id,checked_at,summary,questions,provider,model,candidate_count,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      latestRun = data || null;
    }

    return NextResponse.json({
      available: Boolean(auth.apiKey),
      provider: auth.provider,
      storageAvailable: Boolean(client),
      candidates,
      latestRun,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "분양 후보를 불러오지 못했습니다.",
        available: Boolean(auth.apiKey),
        storageAvailable: Boolean(client),
        candidates: fallbackCandidates(),
      },
      { status: 500 },
    );
  }
}
