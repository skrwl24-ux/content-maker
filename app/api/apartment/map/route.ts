import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

const GEOCODE_URL = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";
const STATIC_MAP_URL = "https://maps.apigw.ntruss.com/map-static/v2/raster";

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

    const mapUrl = new URL(STATIC_MAP_URL);
    mapUrl.searchParams.set("crs", "EPSG:4326");
    mapUrl.searchParams.set("w", "800");
    mapUrl.searchParams.set("h", "450");
    mapUrl.searchParams.set("scale", "2");
    mapUrl.searchParams.set("format", "png");
    mapUrl.searchParams.set("maptype", "basic");
    mapUrl.searchParams.set("lang", "ko");
    mapUrl.searchParams.set("center", `${point.x},${point.y}`);
    mapUrl.searchParams.set("level", "16");
    mapUrl.searchParams.set("markers", `type:d|size:mid|color:red|pos:${point.x} ${point.y}`);

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
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "지도 자동 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
