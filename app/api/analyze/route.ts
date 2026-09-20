import { NextRequest, NextResponse } from "next/server";

function localAnalyze(contentType: string, projectTitle: string, rawContent: string) {
  const title = (projectTitle || rawContent.split(/\n+/).find(x => x.trim().length > 8) || "새 콘텐츠").trim();
  const tokens = rawContent.match(/[가-힣A-Za-z0-9㎡%.-]{2,}/g) || [];
  const stop = new Set("그리고 그러나 하지만 또는 대한 관련 통해 있는 없는 하는 합니다 있습니다 됩니다 입니다 최근 현재 오늘 이번 해당 가장 다시 내용".split(" "));
  const counts: Record<string, number> = {};
  for (const t of tokens) if (!stop.has(t) && !/^\d+$/.test(t)) counts[t] = (counts[t] || 0) + 1;
  const keywords = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k])=>k);

  const patterns = [
    /(?:₩\s*)?\d+(?:[.,]\d+)?\s*(?:억|만원|원|달러|USD|KRW)/gi,
    /\d+(?:\.\d+)?\s*%/g,
    /\d+(?:\.\d+)?\s*㎡/g,
    /\d{4}년(?:\s*\d{1,2}월)?/g,
    /\d+(?:\.\d+)?\s*(?:건|개|명|km)/g
  ];
  const values: string[] = [];
  for (const p of patterns) for (const v of rawContent.match(p) || []) if (!values.includes(v.trim())) values.push(v.trim());
  const facts = values.slice(0,12).map((value,i)=>({label:`핵심 ${i+1}`,value,sourceText:value}));

  const sections = contentType === "집값쓱 쇼츠"
    ? ["강한 훅","핵심 숫자","비교/계산","두 번째 핵심","주의점","한 줄 요약","브랜드 엔딩"]
    : contentType === "아파트 블로그"
    ? ["썸네일","최근 흐름","대표 단지 비교","실거래 핵심","가격 차이 이유","앞으로 체크"]
    : contentType === "AI Price Atlas"
    ? ["Thumbnail","Official Price","Web vs App","Payment Methods","Tax / Notes","Summary"]
    : contentType === "신기한 동물이야기" || contentType === "동물·자연"
    ? ["썸네일","왜 그럴까?","핵심 특징","놀라운 능력","의외의 사실","한눈에 요약"]
    : contentType === "신비로운 자연"
    ? ["썸네일","이 현상은 뭘까?","핵심 원리","어떻게 생길까?","신기한 포인트","한눈에 요약"]
    : contentType === "생활 속 궁금증"
    ? ["썸네일","왜 그럴까?","핵심 원리","생활 속 원인","알아두면 좋은 점","한눈에 요약"]
    : ["썸네일","준비/핵심","방법 1","방법 2","주의점","최종 체크"];

  const images = sections.map((section,idx)=>({
    order: idx,
    title: section,
    keyMessage: idx === 0 ? title : (facts[idx-1]?.value || keywords[idx] || section),
    sourceText: idx === 0 ? title : (facts[idx-1]?.sourceText || ""),
    imagePrompt: `${section} 내용을 한 장의 카드 이미지로 정리. 원문에 없는 숫자나 사실은 추가하지 않는다.`
  }));

  const isParamma = ["신기한 동물이야기","신비로운 자연","생활 속 궁금증","동물·자연"].includes(contentType);
  const titleCandidates = isParamma
    ? [title, `${title}｜이유를 쉽게 알아보자`, `${title} 정말 그럴까?`, `${title} 알고 보면 더 신기한 이유`, `${title} 핵심만 쉽게 정리`]
    : [`${title}, 핵심 흐름 한눈에 정리`,`${title}, 왜 차이가 날까?`,`${title}, 숫자로 보는 현재 상황`,`${title}, 핵심만 비교`,`${title}, 앞으로 체크할 포인트`];

  return {
    recommendedTitle: titleCandidates[0],
    titleCandidates,
    keywords: keywords.length >= 3 ? keywords : ["핵심","비교","정리"],
    facts,
    images
  };
}

export async function POST(req: NextRequest) {
  try {
    const { contentType, projectTitle, rawContent } = await req.json();
    if (!rawContent || String(rawContent).trim().length < 30) return NextResponse.json({error:"본문을 30자 이상 입력하세요."},{status:400});
    return NextResponse.json(localAnalyze(contentType, projectTitle, String(rawContent)));
  } catch {
    return NextResponse.json({error:"분석 중 오류가 발생했습니다."},{status:500});
  }
}
