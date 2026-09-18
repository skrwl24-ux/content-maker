import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function validToken(url: string, token: string, secret: string) {
  const expected = createHmac("sha256", secret).update(url).digest("hex");
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.NAVER_API_HUB_CLIENT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "NAVER API HUB 인증 정보가 없습니다." }, { status: 503 });
    }

    const rawUrl = req.nextUrl.searchParams.get("url")?.trim() || "";
    const token = req.nextUrl.searchParams.get("token")?.trim() || "";
    if (!rawUrl || !token || !validToken(rawUrl, token, secret)) {
      return NextResponse.json({ error: "유효하지 않은 이미지 요청입니다." }, { status: 403 });
    }

    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return NextResponse.json({ error: "지원하지 않는 이미지 주소입니다." }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: `이미지를 불러오지 못했습니다. HTTP ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "이미지 형식이 아닌 응답입니다." }, { status: 415 });
    }

    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지 파일이 너무 큽니다." }, { status: 413 });
    }

    const body = await res.arrayBuffer();
    if (body.byteLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지 파일이 너무 큽니다." }, { status: 413 });
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
