import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return NextResponse.json({ error: "Pexels API 키가 설정되지 않았습니다." }, { status: 503 });
  const photoId = req.nextUrl.searchParams.get("id") || "";
  if (!/^\d{1,12}$/.test(photoId)) return NextResponse.json({ error: "사진 ID가 올바르지 않습니다." }, { status: 400 });
  try {
    // Resolve a trusted ID on Pexels' own API, never proxy caller-supplied URLs.
    const detail = await fetch(`https://api.pexels.com/v1/photos/${photoId}`, {
      headers: { Authorization: key }, cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    if (!detail.ok) return NextResponse.json({ error: "사진의 이용 정보를 확인하지 못했습니다." }, { status: 502 });
    const photo = await detail.json() as { src?: { large2x?: string; large?: string } };
    const imageUrl = photo.src?.large2x || photo.src?.large;
    if (!imageUrl) return NextResponse.json({ error: "등록할 이미지 원본을 찾지 못했습니다." }, { status: 404 });
    const resolved = new URL(imageUrl);
    if (resolved.protocol !== "https:" || resolved.hostname !== "images.pexels.com") {
      return NextResponse.json({ error: "허용되지 않은 사진 주소입니다." }, { status: 400 });
    }
    const imageResponse = await fetch(resolved.toString(), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    const size = Number(imageResponse.headers.get("content-length") || 0);
    const mime = imageResponse.headers.get("content-type") || "";
    if (!imageResponse.ok || !/^image\/(jpeg|png|webp)/i.test(mime) || size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "지원하지 않거나 너무 큰 이미지입니다." }, { status: 422 });
    }
    const bytes = await imageResponse.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: "이미지가 너무 큽니다." }, { status: 413 });
    return new NextResponse(bytes, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "이미지 다운로드·등록 준비에 실패했습니다." }, { status: 502 });
  }
}
