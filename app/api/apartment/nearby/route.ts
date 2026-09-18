import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

const GEOCODE_URL = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";
const LOCAL_SEARCH_URL = "https://naverapihub.apigw.ntruss.com/search/v1/local";

function mapsHeaders() {
  const clientId = process.env.NAVER_MAPS_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    "x-ncp-apigw-api-key-id": clientId,
    "x-ncp-apigw-api-key": clientSecret,
    Accept: "application/json",
  };
}

function searchHeaders() {
  const clientId = process.env.NAVER_API_HUB_CLIENT_ID;
  const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    "X-NCP-APIGW-API-KEY-ID": clientId,
    "X-NCP-APIGW-API-KEY": clientSecret,
    Accept: "application/json",
  };
}

async function geocode(query: string, headers: Record<string, string>) {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("count", "1");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json() as {
    addresses?: Array<{ x?: string; y?: string }>;
  };
  const item = json.addresses?.[0];
  if (!item?.x || !item?.y) return null;
  const lng = Number(item.x);
  const lat = Number(item.y);
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
}

function stripHtml(text: string) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeCoord(value: unknown, axis: "x" | "y") {
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  const limit = axis === "x" ? 180 : 90;
  if (Math.abs(n) > limit) n /= 10_000_000;
  return Math.abs(n) <= limit ? n : null;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type LocalItem = {
  title?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string | number;
  mapy?: string | number;
};

async function localSearch(query: string, headers: Record<string, string>) {
  const url = new URL(LOCAL_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "random");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`네이버 지역 검색 HTTP ${res.status}${detail ? ": " + detail : ""}`);
  }
  const json = await res.json() as { items?: LocalItem[] };
  return json.items || [];
}

export async function GET(req: NextRequest) {
  try {
    const mapHeaders = mapsHeaders();
    const localHeaders = searchHeaders();
    if (!mapHeaders || !localHeaders) {
      return NextResponse.json(
        { error: "네이버 지도/검색 API 환경변수 설정이 필요합니다." },
        { status: 503 }
      );
    }

    const complexId = req.nextUrl.searchParams.get("complexId")?.trim();
    if (!complexId) return NextResponse.json({ error: "complexId가 필요합니다." }, { status: 400 });

    const supabase = createApartmentReadClient();
    const { data: complex, error: complexError } = await supabase
      .from("apt_complexes")
      .select("id,name,sido,sigungu,legal_dong,address,road_address")
      .eq("id", complexId)
      .single();

    if (complexError || !complex) {
      return NextResponse.json({ error: "단지 정보를 찾지 못했습니다." }, { status: 404 });
    }

    const { data: latestTrade } = await supabase
      .from("apt_trades")
      .select("jibun,legal_dong")
      .eq("complex_id", complexId)
      .eq("cancelled", false)
      .order("contract_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dong = latestTrade?.legal_dong || complex.legal_dong || "";
    const lotAddress = [complex.sido, complex.sigungu, dong, latestTrade?.jibun].filter(Boolean).join(" ");
    const addressQueries = [...new Set([
      complex.road_address,
      complex.address,
      lotAddress,
    ].filter((v): v is string => Boolean(v && String(v).trim())))];

    let point: { lng: number; lat: number } | null = null;
    for (const query of addressQueries) {
      point = await geocode(query, mapHeaders);
      if (point) break;
    }

    if (!point) {
      return NextResponse.json({ error: "단지 위치 좌표를 찾지 못했습니다." }, { status: 404 });
    }

    const searchQueries = [...new Set([
      dong ? `${dong} 지하철역` : "",
      complex.sigungu && dong ? `${complex.sigungu} ${dong} 역` : "",
      complex.sigungu ? `${complex.sigungu} 지하철역` : "",
    ].filter(Boolean))];

    const all: Array<{ name: string; category: string; address: string; lat: number; lng: number; distance: number }> = [];
    for (const query of searchQueries) {
      const items = await localSearch(query, localHeaders);
      for (const item of items) {
        const rawName = stripHtml(item.title || "");
        const category = stripHtml(item.category || "");
        const lng = normalizeCoord(item.mapx, "x");
        const lat = normalizeCoord(item.mapy, "y");
        if (!rawName || lng == null || lat == null) continue;
        if (!/(지하철|전철|철도)/.test(category) && !/역(?:\s|$)/.test(rawName)) continue;
        const stationMatch = rawName.match(/^(.+?역)(?:\s|$)/);
        const name = stationMatch?.[1] || rawName;
        const distance = distanceMeters(point, { lat, lng });
        if (distance > 6000) continue;
        all.push({
          name,
          category,
          address: item.roadAddress || item.address || "",
          lat,
          lng,
          distance,
        });
      }
    }

    const deduped = [...new Map(
      all
        .sort((a, b) => a.distance - b.distance)
        .map((item) => [item.name.replace(/\s+/g, ""), item])
    ).values()];

    const nearest = deduped[0] || null;
    if (!nearest) {
      return NextResponse.json({
        station: "",
        locationLine: dong ? `${dong} 생활권` : "",
        distanceMeters: null,
        source: "NAVER Local Search",
      });
    }

    const livingArea = dong ? `${dong} 생활권` : complex.sigungu ? `${complex.sigungu} 생활권` : "인근 생활권";
    let locationLine = "";
    if (nearest.distance <= 800) {
      locationLine = `${nearest.name}을 가까이 이용할 수 있는 ${livingArea}`;
    } else if (nearest.distance <= 1600) {
      locationLine = `${nearest.name} 접근이 가능한 ${livingArea}`;
    } else {
      locationLine = `${livingArea} · 가까운 주요 역 ${nearest.name}`;
    }

    return NextResponse.json({
      station: nearest.name,
      locationLine,
      distanceMeters: Math.round(nearest.distance),
      stationAddress: nearest.address,
      source: "NAVER Local Search",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "가까운 역 자동 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
