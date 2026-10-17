import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function validateQuery(query: string) {
  return query.length >= 2 && query.length <= 100 && !/[<>\r\n]/.test(query);
}

export async function GET(req: NextRequest) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return NextResponse.json({ error: "Pexels 사진 검색 API 키가 아직 설정되지 않았습니다." }, { status: 503 });
  const query = (req.nextUrl.searchParams.get("query") || "").trim();
  if (!validateQuery(query)) return NextResponse.json({ error: "2~100자 검색어를 입력해주세요." }, { status: 400 });
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "9");
    url.searchParams.set("orientation", "landscape");
    const response = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Pexels 사진 검색에 실패했습니다. API 연결과 사용량을 확인해주세요." }, { status: response.status === 429 ? 429 : 502 });
    const data = await response.json() as { photos?: Array<{id?: number;alt?: string;url?: string;photographer?: string;photographer_url?: string;width?: number;height?: number;src?: {medium?: string;large?: string}} > };
    const photos = (data.photos || []).filter((p) => Number.isSafeInteger(p.id) && p.src?.medium).map((p) => ({
      id: p.id,
      alt: (p.alt || "").slice(0, 150),
      sourceUrl: p.url || "",
      photographer: (p.photographer || "").slice(0, 100),
      photographerUrl: p.photographer_url || "",
      thumbnailUrl: p.src?.medium || "",
      width: p.width || 0,
      height: p.height || 0,
    }));
    return NextResponse.json({ photos, provider: "Pexels", query }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "사진 검색 연결에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }
}
