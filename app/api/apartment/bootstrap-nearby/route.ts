import { NextResponse } from "next/server";
import { createApartmentAdminClient, syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TARGETS = ["41171", "41173", "41430"];

export async function GET() {
  const client = createApartmentAdminClient();
  if (!client) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다." }, { status: 503 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const regionCode of TARGETS) {
    const { count, error: countError } = await client
      .from("apt_trades")
      .select("id", { count: "exact", head: true })
      .eq("region_code", regionCode);

    if (countError) {
      results.push({ regionCode, success: false, error: countError.message });
      continue;
    }

    if ((count || 0) > 0) {
      results.push({ regionCode, success: true, skipped: true, tradeCount: count });
      continue;
    }

    try {
      results.push(await syncApartmentRegion(regionCode));
    } catch (error) {
      results.push({
        regionCode,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    success: results.every((r) => r.success !== false),
    results,
  });
}
