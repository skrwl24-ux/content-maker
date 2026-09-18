import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function decodeServiceKey(raw: string) {
  if (!raw.includes("%")) return raw;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export async function GET() {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 503 });

  const url = new URL("https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade");
  url.searchParams.set("serviceKey", decodeServiceKey(key));
  url.searchParams.set("LAWD_CD", "41410");
  url.searchParams.set("DEAL_YMD", "202608");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");

  const res = await fetch(url, { cache: "no-store" });
  const raw = await res.text();
  return NextResponse.json({
    status: res.status,
    contentType: res.headers.get("content-type"),
    length: raw.length,
    prefix: raw.slice(0, 5000),
  });
}
