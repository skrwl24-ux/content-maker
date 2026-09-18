import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient, syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest, context: { params: Promise<{ regionCode: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 설정이 필요합니다." }, { status: 503 });
  if (req.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { regionCode } = await context.params;
  const supabase = createApartmentReadClient();
  const { data: region, error } = await supabase
    .from("apt_tracked_regions")
    .select("region_code,region_name,enabled")
    .eq("region_code", regionCode)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!region || !region.enabled) {
    return NextResponse.json({ error: "활성화된 분석 지역이 아닙니다." }, { status: 404 });
  }

  try {
    const result = await syncApartmentRegion(region.region_code);
    return NextResponse.json({
      success: true,
      regionCode: region.region_code,
      regionName: region.region_name,
      result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      regionCode: region.region_code,
      regionName: region.region_name,
      error: error instanceof Error ? error.message : "동기화 실패",
    }, { status: 500 });
  }
}
