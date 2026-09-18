import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NAVER_IMAGE_SEARCH_URL = "https://naverapihub.apigw.ntruss.com/search/v1/image";

type NaverImageItem = {
  title?: string;
  link?: string;
  thumbnail?: string;
  sizeheight?: string;
  sizewidth?: string;
};

function cleanTitle(value: string | undefined) {
  return (value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function toCandidate(item: NaverImageItem) {
  const width = Number(item.sizewidth || 0);
  const height = Number(item.sizeheight || 0);
  return {
    title: cleanTitle(item.title),
    imageUrl: item.link || "",
    thumbnailUrl: item.thumbnail || item.link || "",
    width,
    height,
  };
}

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.NAVER_API_HUB_CLIENT_ID;
    const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "NAVER API HUB 인증 정보가 설정되지 않았습니다." },
        { status: 503 }
      );
    }

    const name = req.nextUrl.searchParams.get("query")?.trim();
    const region = req.nextUrl.searchParams.get("region")?.trim() || "";
    const startRaw = Number(req.nextUrl.searchParams.get("start") || "1");
    const start = Number.isFinite(startRaw) ? Math.min(991, Math.max(1, Math.floor(startRaw))) : 1;

    if (!name) {
      return NextResponse.json({ error: "단지명이 필요합니다." }, { status: 400 });
    }

    const query = [region, name, "아파트"].filter(Boolean).join(" ");
    const url = new URL(NAVER_IMAGE_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("display", "10");
    url.searchParams.set("start", String(start));
    url.searchParams.set("sort", "sim");
    url.searchParams.set("filter", "large");
    url.searchParams.set("format", "json");

    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 220);
      throw new Error(`NAVER 이미지 검색 HTTP ${res.status}${detail ? ": " + detail : ""}`);
    }

    const json = await res.json() as { items?: NaverImageItem[] };
    const all = (json.items || [])
      .map(toCandidate)
      .filter((item) => item.imageUrl && item.thumbnailUrl);

    const unique: typeof all = [];
    const seen = new Set<string>();
    for (const item of all) {
      if (seen.has(item.imageUrl)) continue;
      seen.add(item.imageUrl);
      unique.push(item);
    }

    const preferred = unique.filter((item) => {
      if (!item.width || !item.height) return false;
      const ratio = item.width / item.height;
      return item.width >= 500 && item.height >= 300 && ratio >= 0.72 && ratio <= 2.2;
    });

    const candidates = [...preferred];
    for (const item of unique) {
      if (candidates.length >= 3) break;
      if (!candidates.some((candidate) => candidate.imageUrl === item.imageUrl)) {
        candidates.push(item);
      }
    }

    const signedItems = candidates.slice(0, 3).map((item) => ({
      ...item,
      imageToken: createHmac("sha256", clientSecret).update(item.imageUrl).digest("hex"),
      thumbnailToken: createHmac("sha256", clientSecret).update(item.thumbnailUrl).digest("hex"),
    }));

    return NextResponse.json({
      query,
      start,
      items: signedItems,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "단지 사진 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
