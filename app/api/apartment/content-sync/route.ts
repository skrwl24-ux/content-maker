import { NextRequest, NextResponse } from "next/server";
import {
  createApartmentAdminClient,
  createApartmentReadClient,
  syncApartmentRegion,
} from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearer) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const authClient = createApartmentReadClient();
  const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "로그인 세션을 확인할 수 없습니다." }, { status: 401 });
  }

  const admin = createApartmentAdminClient();
  if (!admin) return NextResponse.json({ error: "관리자 DB 설정이 필요합니다." }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const complexId = String(body.complexId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(complexId)) {
      return NextResponse.json({ error: "단지 ID가 올바르지 않습니다." }, { status: 400 });
    }

    const { data: complex, error: complexError } = await admin
      .from("apt_complexes")
      .select("id,region_code,name")
      .eq("id", complexId)
      .maybeSingle();
    if (complexError) throw complexError;
    if (!complex?.region_code) {
      return NextResponse.json({ error: "단지 지역코드를 확인할 수 없습니다." }, { status: 404 });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: running, error: runningError } = await admin
      .from("apt_sync_runs")
      .select("id,started_at")
      .eq("region_code", complex.region_code)
      .eq("status", "running")
      .gte("started_at", tenMinutesAgo)
      .order("started_at", { ascending: false })
      .limit(1);
    if (runningError) throw runningError;
    if (running?.length) {
      return NextResponse.json(
        { error: "이 지역의 국토부 자료를 이미 새로고침 중입니다." },
        { status: 409 }
      );
    }

    const result = await syncApartmentRegion(complex.region_code);
    return NextResponse.json({
      success: true,
      complexId,
      complexName: complex.name,
      regionCode: complex.region_code,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "국토부 자료 새로고침에 실패했습니다." },
      { status: 500 }
    );
  }
}
