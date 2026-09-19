import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient, syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED = new Set([
  "41131","41133","41135","41290","41210",
  "41450","41591","41593","41595","41597","41390","41220","41271","41273",
]);

export async function GET(req: NextRequest) {
  const regionCode = req.nextUrl.searchParams.get("regionCode") || "";
  if (!ALLOWED.has(regionCode)) {
    return NextResponse.json({ error: "허용되지 않은 초기 동기화 지역입니다." }, { status: 400 });
  }

  const supabase = createApartmentReadClient();
  const { data: region, error } = await supabase
    .from("apt_tracked_regions")
    .select("region_code,region_name,enabled,last_synced_at")
    .eq("region_code", regionCode)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!region || !region.enabled) {
    return NextResponse.json({ error: "활성화된 분석 지역이 아닙니다." }, { status: 404 });
  }
  if (region.last_synced_at) {
    return NextResponse.json({
      success: true,
      skipped: true,
      regionCode,
      regionName: region.region_name,
      reason: "이미 첫 동기화가 완료된 지역입니다.",
      lastSyncedAt: region.last_synced_at,
    });
  }

  try {
    const result = await syncApartmentRegion(regionCode);
    return NextResponse.json({
      success: true,
      regionCode,
      regionName: region.region_name,
      result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      regionCode,
      regionName: region.region_name,
      error: error instanceof Error ? error.message : "초기 동기화 실패",
    }, { status: 500 });
  }
}
