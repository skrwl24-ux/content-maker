import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  name?: string;
  region?: string;
  households?: string;
  moveIn?: string;
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 503 }
      );
    }

    const body = (await req.json()) as Body;
    const name = body.name?.trim();
    const region = body.region?.trim() || "";
    const households = body.households?.trim() || "";
    const moveIn = body.moveIn?.trim() || "";

    if (!name) {
      return NextResponse.json({ error: "단지명이 필요합니다." }, { status: 400 });
    }

    const context = [
      `Apartment topic: ${name}`,
      region ? `Location context: ${region}` : "",
      households ? `Scale hint: ${households}` : "",
      moveIn ? `Era hint: ${moveIn}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `
Create a NEW, ORIGINAL architectural aerial-sketch illustration for a Korean real-estate blog thumbnail.

${context}

Important:
- Do NOT copy, trace, reconstruct, or imitate any specific photograph, map screenshot, advertisement, floor plan, rendering, or copyrighted composition.
- Do NOT use any image reference.
- This should be a plausible editorial illustration inspired only by the text facts above, not a factual reconstruction of the real complex.
- Show a Korean apartment complex from a high oblique aerial viewpoint, with multiple residential towers, landscaped courtyards, surrounding roads, trees, and a believable urban neighborhood.
- Style: premium architectural sketch, precise ink/pencil linework with restrained watercolor shading, clean contemporary Korean real-estate editorial aesthetic.
- No text, no readable signage, no logos, no brand marks, no watermark.
- Keep the central/lower area visually calm enough for a large Korean headline overlay.
- Square composition, strong depth, polished but clearly illustrated rather than photographic.
`.trim();

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      }),
      cache: "no-store",
    });

    const json = await response.json();
    if (!response.ok) {
      const message = json?.error?.message || `OpenAI 이미지 생성 HTTP ${response.status}`;
      throw new Error(message);
    }

    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("생성된 이미지 데이터가 없습니다.");

    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${b64}`,
      note: "AI 조감도풍 일러스트는 실제 단지 구조를 정확히 재현한 자료가 아닙니다.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 조감도풍 이미지 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
