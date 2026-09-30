import { NextRequest, NextResponse } from "next/server";
import { createApartmentAdminClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

type HistoryInput = {
  title?: unknown;
  category?: unknown;
  thumbnailHook?: unknown;
  publishedOn?: unknown;
  source?: unknown;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\d{4}년|\d{1,2}월|\d{1,2}일/g, "")
    .replace(/[\s·｜|?？!！,.'\"“”‘’()\[\]{}:;~_-]/g, "");
}

function sameSiteMutation(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site") return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.nextUrl.host) return false;
    } catch {
      return false;
    }
  }
  return Boolean(site || origin);
}

function adminClient() {
  const client = createApartmentAdminClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다.");
  return client;
}

function normalizeInput(raw: HistoryInput) {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const category = typeof raw.category === "string" ? raw.category.trim() : "";
  if (!title || !category) return null;

  const thumbnailHook = typeof raw.thumbnailHook === "string" ? raw.thumbnailHook.trim() || null : null;
  const publishedOn = typeof raw.publishedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.publishedOn)
    ? raw.publishedOn
    : null;
  const source = typeof raw.source === "string" ? raw.source.trim().slice(0, 40) || "paramma-bulk" : "paramma-bulk";

  return {
    normalized_key: normalizeKey(title),
    title,
    category,
    thumbnail_hook: thumbnailHook,
    source,
    ...(publishedOn ? { published_on: publishedOn } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("paramma_publish_history")
      .select("normalized_key,title,category,thumbnail_hook,published_on")
      .order("published_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Paramma 발행 이력을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!sameSiteMutation(req)) {
    return NextResponse.json({ error: "Same-site request required." }, { status: 403 });
  }

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const bodyRecord = body && typeof body === "object" ? body as { items?: unknown } : {};
    const sourceItems: unknown[] = Array.isArray(bodyRecord.items) ? bodyRecord.items : [body];
    const rows = sourceItems
      .map((item: unknown) => normalizeInput((item && typeof item === "object" ? item : {}) as HistoryInput))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (!rows.length) return NextResponse.json({ ok: true, count: 0 });

    const supabase = adminClient();
    const { error } = await supabase
      .from("paramma_publish_history")
      .upsert(rows, { onConflict: "normalized_key" });
    if (error) throw error;

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Paramma 발행 이력을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameSiteMutation(req)) {
    return NextResponse.json({ error: "Same-site request required." }, { status: 403 });
  }

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const input = body && typeof body === "object" ? body as HistoryInput : {};
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return NextResponse.json({ error: "삭제할 발행 이력이 없습니다." }, { status: 400 });

    const supabase = adminClient();
    const { error } = await supabase
      .from("paramma_publish_history")
      .delete()
      .eq("normalized_key", normalizeKey(title));
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Paramma 발행 이력을 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}
