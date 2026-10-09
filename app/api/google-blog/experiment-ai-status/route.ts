import { NextResponse } from "next/server";
import { getExperimentAiAuth } from "@/lib/experiment-ai-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  const auth=await getExperimentAiAuth();
  return NextResponse.json({
    connected:Boolean(auth),
    provider:auth?.provider||"not_configured",
    message:auth?"AI 인증 경로가 준비되어 있습니다. 실제 글 생성은 실행 시 별도 확인됩니다.":
      "AI 인증을 사용할 수 없습니다. Vercel AI Gateway OIDC 또는 OPENAI_API_KEY 설정이 필요합니다."
  },{headers:{"Cache-Control":"no-store"}});
}
