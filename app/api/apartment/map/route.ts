import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

const GEOCODE_URL = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";
const STATIC_MAP_URL = "https://maps.apigw.ntruss.com/map-static/v2/raster";
const LOCAL_SEARCH_URL = "https://naverapihub.apigw.ntruss.com/search/v1/local";

function naverHeaders() {
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
  if (!res.ok) return [];
  const json = await res.json() as { items?: LocalItem[] };
  return json.items || [];
}

function mapLevelForDistance(distance: number | null) {
  if (distance == null) return 13;
  if (distance <= 1200) return 13;
  if (distance <= 2600) return 12;
  if (distance <= 4500) return 11;
  return 10;
}

async function geocode(query: string, headers: Record<string, string>) {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("count", "1");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`네이버 Geocoding HTTP ${res.status}${detail ? ": " + detail : ""}`);
  }
  const json = await res.json() as {
    addresses?: Array<{ x?: string; y?: string; roadAddress?: string; jibunAddress?: string }>;
  };
  const item = json.addresses?.[0];
  if (!item?.x || !item?.y) return null;
  return { x: item.x, y: item.y, roadAddress: item.roadAddress || "", jibunAddress: item.jibunAddress || "" };
}

export async function GET(req: NextRequest) {
  try {
    const headers = naverHeaders();
    if (!headers) {
      return NextResponse.json(
        { error: "NAVER_MAPS_CLIENT_ID / NAVER_MAPS_CLIENT_SECRET 설정이 필요합니다." },
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

    const lotAddress = [
      complex.sido,
      complex.sigungu,
      latestTrade?.legal_dong || complex.legal_dong,
      latestTrade?.jibun,
    ].filter(Boolean).join(" ");

    const queries = [...new Set([
      complex.road_address,
      complex.address,
      lotAddress,
    ].filter((v): v is string => Boolean(v && String(v).trim())))];

    let point: Awaited<ReturnType<typeof geocode>> = null;
    let usedQuery = "";
    for (const query of queries) {
      point = await geocode(query, headers);
      if (point) {
        usedQuery = query;
        break;
      }
    }

    if (!point) {
      return NextResponse.json(
        { error: "단지 주소를 좌표로 변환하지 못했습니다. 지도 캡처를 직접 올려주세요." },
        { status: 404 }
      );
    }

    const apartmentPoint = { lng: Number(point.x), lat: Number(point.y) };
    const localHeaders = searchHeaders();
    let station: { name: string; lng: number; lat: number; distance: number } | null = null;

    if (localHeaders) {
      const dong = latestTrade?.legal_dong || complex.legal_dong || "";
      const stationQueries = [...new Set([
        dong ? `${dong} 지하철역` : "",
        complex.sigungu && dong ? `${complex.sigungu} ${dong} 역` : "",
        complex.sigungu ? `${complex.sigungu} 지하철역` : "",
      ].filter(Boolean))];

      const candidates: Array<{ name: string; lng: number; lat: number; distance: number }> = [];
      for (const query of stationQueries) {
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
          const distance = distanceMeters(apartmentPoint, { lat, lng });
          if (distance > 6000) continue;
          candidates.push({ name, lng, lat, distance });
        }
      }

      const deduped = [...new Map(
        candidates
          .sort((a, b) => a.distance - b.distance)
          .map((item) => [item.name.replace(/\s+/g, ""), item])
      ).values()];
      station = deduped[0] || null;
    }

    const centerLng = station ? (apartmentPoint.lng + station.lng) / 2 : apartmentPoint.lng;
    const centerLat = station ? (apartmentPoint.lat + station.lat) / 2 : apartmentPoint.lat;
    const level = mapLevelForDistance(station?.distance ?? null);

    const mapUrl = new URL(STATIC_MAP_URL);
    mapUrl.searchParams.set("crs", "EPSG:4326");
    mapUrl.searchParams.set("w", "800");
    mapUrl.searchParams.set("h", "450");
    mapUrl.searchParams.set("scale", "2");
    mapUrl.searchParams.set("format", "png");
    mapUrl.searchParams.set("maptype", "basic");
    mapUrl.searchParams.set("lang", "ko");
    mapUrl.searchParams.set("center", `${centerLng},${centerLat}`);
    mapUrl.searchParams.set("level", String(level));
    mapUrl.searchParams.append("markers", `type:d|size:mid|color:red|pos:${point.x} ${point.y}`);
    if (station) {
      mapUrl.searchParams.append("markers", `type:d|size:mid|color:blue|pos:${station.lng} ${station.lat}`);
    }

    const mapHeaders = {
      "x-ncp-apigw-api-key-id": headers["x-ncp-apigw-api-key-id"],
      "x-ncp-apigw-api-key": headers["x-ncp-apigw-api-key"],
    };
    const mapRes = await fetch(mapUrl, { headers: mapHeaders, cache: "no-store" });
    if (!mapRes.ok) {
      const detail = (await mapRes.text()).replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`네이버 Static Map HTTP ${mapRes.status}${detail ? ": " + detail : ""}`);
    }

    const body = await mapRes.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": mapRes.headers.get("content-type") || "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Map-Source": "NAVER Cloud Static Map",
        "X-Map-Query": encodeURIComponent(usedQuery),
        "X-Map-Level": String(level),
        "X-Map-Station": encodeURIComponent(station?.name || ""),
        "X-Map-Station-Distance": station ? String(Math.round(station.distance)) : "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "지도 자동 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
