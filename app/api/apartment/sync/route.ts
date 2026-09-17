import { NextRequest, NextResponse } from "next/server";
import { syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const manual = process.env.APARTMENT_SYNC_SECRET;
  const cron = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const header = req.headers.get("x-apartment-sync-secret") || "";
  return Boolean((manual && header === manual) || (cron && bearer === cron));
}

export async function POST(req: NextRequest) {
  if (!process.env.APARTMENT_SYNC_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "동기화 비밀키 설정이 필요합니다.", setupRequired: true }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const regionCode = String(body.regionCode || "41410");
    const result = await syncApartmentRegion(regionCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "지역 동기화에 실패했습니다." },
      { status: 500 }
    );
  }
}
