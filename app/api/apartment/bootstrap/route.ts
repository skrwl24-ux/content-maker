import { NextResponse } from "next/server";
import { createApartmentAdminClient, syncApartmentRegion } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const client = createApartmentAdminClient();
  if (!client) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다." },
      { status: 503 }
    );
  }

  const regionCode = "41410";

  const { data: region, error: regionError } = await client
    .from("apt_tracked_regions")
    .select("region_code,region_name,last_synced_at")
    .eq("region_code", regionCode)
    .eq("enabled", true)
    .maybeSingle();

  if (regionError) {
    return NextResponse.json({ error: regionError.message }, { status: 500 });
  }
  if (!region) {
    return NextResponse.json({ error: "등록된 초기화 지역이 없습니다." }, { status: 404 });
  }

  if (region.last_synced_at) {
    return NextResponse.json({
      success: true,
      alreadyInitialized: true,
      regionCode,
      regionName: region.region_name,
      lastSyncedAt: region.last_synced_at,
    });
  }

  const { data: existingRun, error: runError } = await client
    .from("apt_sync_runs")
    .select("id,status,started_at,finished_at")
    .eq("region_code", regionCode)
    .in("status", ["running", "success"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  if (existingRun?.status === "running") {
    return NextResponse.json(
      {
        success: false,
        alreadyRunning: true,
        regionCode,
        run: existingRun,
      },
      { status: 409 }
    );
  }

  if (existingRun?.status === "success") {
    return NextResponse.json({
      success: true,
      alreadyInitialized: true,
      regionCode,
      regionName: region.region_name,
      run: existingRun,
    });
  }

  try {
    const result = await syncApartmentRegion(regionCode);
    return NextResponse.json({ ...result, bootstrap: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "초기 동기화에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
