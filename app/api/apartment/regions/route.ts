import { NextResponse } from "next/server";
import { apartmentSetupState, createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createApartmentReadClient();
    const { data, error } = await supabase
      .from("apt_tracked_regions")
      .select("region_code,sido_code,sido_name,region_name,enabled,last_synced_at")
      .eq("enabled", true)
      .order("sido_name")
      .order("region_name");
    if (error) throw error;
    return NextResponse.json({
      regions: data || [],
      syncConfigured: Object.values(apartmentSetupState()).every(Boolean),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "지역 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
