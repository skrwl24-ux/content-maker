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
    .select("region_code,region_name")
    .eq("enabled", true)
    .order("region_code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const region of regions || []) {
    try {
      results.push(await syncApartmentRegion(region.region_code));
    } catch (error) {
      results.push({
        success: false,
        regionCode: region.region_code,
        regionName: region.region_name,
        error: error instanceof Error ? error.message : "동기화 실패",
      });
    }
  }

  return NextResponse.json({ success: results.every((r) => r.success !== false), results });
}
