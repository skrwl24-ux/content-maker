import { NextResponse } from "next/server";
import { createApartmentReadClient, syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const regionCode = "11170";
  const supabase = createApartmentReadClient();
  const { data: region, error } = await supabase
    .from("apt_tracked_regions")
    .select("region_code,region_name,enabled,last_synced_at")
    .eq("region_code", regionCode)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!region || !region.enabled) {
    return NextResponse.json({ error: "용산구가 활성 분석 지역이 아닙니다." }, { status: 404 });
  }
  if (region.last_synced_at) {
    return NextResponse.json({ success: true, skipped: true, reason: "용산구 초기 동기화가 이미 완료됐습니다.", lastSyncedAt: region.last_synced_at });
  }

  try {
    const result = await syncApartmentRegion(regionCode);
    return NextResponse.json({ success: true, regionCode, regionName: region.region_name, result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "동기화 실패" }, { status: 500 });
  }
}
