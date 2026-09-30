import { NextRequest, NextResponse } from "next/server";
import { createApartmentAdminClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

type HistoryItemInput = {
  itemType?: unknown;
  title?: unknown;
  contentType?: unknown;
  complexId?: unknown;
  complexName?: unknown;
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

function normalizeInput(raw: HistoryItemInput) {
  const itemType = raw.itemType === "topic" || raw.itemType === "complex" ? raw.itemType : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!itemType || !title) return null;

  const contentType = typeof raw.contentType === "string" ? raw.contentType.trim() || null : null;
  const complexId = typeof raw.complexId === "string" ? raw.complexId.trim() || null : null;
  const complexName = typeof raw.complexName === "string" ? raw.complexName.trim() || null : null;
  const publishedOn = typeof raw.publishedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.publishedOn)
    ? raw.publishedOn
    : null;
  const source = typeof raw.source === "string" ? raw.source.trim().slice(0, 40) || "content-maker" : "content-maker";

  return {
    item_type: itemType,
    normalized_key: normalizeKey(itemType === "complex" ? (complexName || title) : title),
    title,
    content_type: contentType,
    complex_id: complexId,
    complex_name: itemType === "complex" ? (complexName || title) : null,
    source,
    ...(publishedOn ? { published_on: publishedOn } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from("blog_publish_history")
      .select("item_type,normalized_key,title,content_type,complex_id,complex_name,published_on")
      .order("published_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    return NextResponse.json({
      items: data || [],
      topics: (data || []).filter((item) => item.item_type === "topic").map((item) => item.title),
      complexes: (data || [])
        .filter((item) => item.item_type === "complex")
        .map((item) => ({ id: item.complex_id || "", name: item.complex_name || item.title })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "발행 이력을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!sameSiteMutation(req)) {
    return NextResponse.json({ error: "Same-site request required." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceItems = Array.isArray(body.items) ? body.items : [body];
    const rows = sourceItems
      .map((item) => normalizeInput((item || {}) as HistoryItemInput))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!rows.length) return NextResponse.json({ ok: true, count: 0 });

    const supabase = adminClient();
    const { error } = await supabase
      .from("blog_publish_history")
      .upsert(rows, { onConflict: "item_type,normalized_key" });
    if (error) throw error;

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "발행 이력을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameSiteMutation(req)) {
    return NextResponse.json({ error: "Same-site request required." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const itemType = body.itemType === "topic" || body.itemType === "complex" ? body.itemType : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const complexName = typeof body.complexName === "string" ? body.complexName.trim() : "";
    if (!itemType || !title) return NextResponse.json({ error: "삭제할 발행 이력이 없습니다." }, { status: 400 });

    const normalizedKey = normalizeKey(itemType === "complex" ? (complexName || title) : title);
    const supabase = adminClient();
    const { error } = await supabase
      .from("blog_publish_history")
      .delete()
      .eq("item_type", itemType)
      .eq("normalized_key", normalizedKey);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "발행 이력을 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}
