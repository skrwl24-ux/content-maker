/**
 * Convert an explicitly tagged ChatGPT final article to the text format
 * consumed by the existing Paramma V4 preview, image plans, scene contexts,
 * and ZIP export. Ordinary plain-text drafts pass through unchanged.
 * No missing image markers or visual plans are invented.
 */
export function normalizeParammaCompletedArticle(raw) {
  if (typeof raw !== "string" || !raw.trim()) return typeof raw === "string" ? raw : "";
  const source = raw.trim();
  const tagged = source.match(/\[NAVER_FINAL_ARTICLE_JSON\]([\s\S]*?)\[\/NAVER_FINAL_ARTICLE_JSON\]/i);
  const fenced = source.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  const candidate = (tagged ? tagged[1] : fenced ? fenced[1] : source).trim();
  // Never consume other JSON reports as articles.
  if (!candidate.startsWith("{") || candidate.length > 180000) return raw;
  let value;
  try { value = JSON.parse(candidate); } catch { return raw; }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      typeof value.body !== "string" || !value.body.trim() || value.body.length > 120000) return raw;
  const title = typeof value.title === "string" ? value.title.trim().slice(0,250) : "";
  const body = value.body.replace(/\r\n?/g,"\n").trim();
  const first = body.split("\n").find(line=>line.trim()) || "";
  const firstNormalized=first.replace(/^#{1,6}\s*/, "").replace(/^\*\*(.*?)\*\*$/, "$1").trim();
  let article = title && firstNormalized !== title ? title + "\n\n" + body : body;

  // Optional explicit plans are included only when the AI supplied them.
  if (!/(?:^|\n)\s*(?:#{1,6}\s*)?\[?이미지\s*기획\s*메모\]?/i.test(article) &&
      value.imagePlans && typeof value.imagePlans === "object" && !Array.isArray(value.imagePlans)) {
    const lines = Object.keys(value.imagePlans).filter(key=>/^0[0-7]$/.test(key))
      .sort().map(key => [key,value.imagePlans[key]])
      .filter(([_,v])=>typeof v==="string" && v.trim())
      .map(([key,v])=>"- 이미지 "+key+": "+v.trim().slice(0,500));
    if (lines.length) article += "\n\n[이미지 기획 메모]\n"+lines.join("\n");
  }
  return article;
}
