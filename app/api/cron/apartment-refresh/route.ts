import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient, syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 설정이 필요합니다." }, { status: 503 });
  if (req.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createApartmentReadClient();
  const { data: regions, error } = await supabase
    .from("apt_tracked_regions")
    .select("region_code,region_name,last_synced_at")
    .eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ordered = [...(regions || [])].sort((a, b) => {
    if (!a.last_synced_at && b.last_synced_at) return -1;
    if (a.last_synced_at && !b.last_synced_at) return 1;
    if (!a.last_synced_at && !b.last_synced_at) return a.region_code.localeCompare(b.region_code);
    return new Date(a.last_synced_at).getTime() - new Date(b.last_synced_at).getTime();
  });

  const target = ordered[0];
  if (!target) return NextResponse.json({ success: true, skipped: true, reason: "활성 지역 없음" });

  if (target.last_synced_at) {
    const ageMs = Date.now() - new Date(target.last_synced_at).getTime();
    const minAgeMs = 20 * 60 * 60 * 1000;
    if (ageMs < minAgeMs) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "모든 지역이 최근 20시간 안에 갱신됨",
        nextRegion: target.region_name,
      });
    }
  }

  try {
    const result = await syncApartmentRegion(target.region_code);
    return NextResponse.json({
      success: true,
      regionCode: target.region_code,
      regionName: target.region_name,
      result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      regionCode: target.region_code,
      regionName: target.region_name,
      error: error instanceof Error ? error.message : "동기화 실패",
    }, { status: 500 });
  }
}
