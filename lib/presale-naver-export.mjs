// Rich clipboard HTML for Naver presale articles.
// Only http(s) destinations become links. All source text/attributes are escaped.
export function escapePresaleHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function splitRawUrlPunctuation(rawUrl) {
  let url = rawUrl;
  let suffix = "";
  while (url.length) {
    const end = url[url.length - 1];
    const punctuation = /[.,!?;:，。！、\]\}]/u.test(end);
    const unmatchedClosingParen = end === ")" &&
      (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length;
    if (!punctuation && !unmatchedClosingParen) break;
    suffix = end + suffix;
    url = url.slice(0, -1);
  }
  return { url, suffix };
}

/**
 * Converts plain visible URLs and Markdown-labeled links into safe clipboard anchors.
 * Keeps the original visible URL for unlabelled references rather than hiding provenance.
 */
export function renderPresaleLinks(input) {
  const raw = String(input ?? "");
  const tokens = /\[([^\]\r\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/gi;
  let result = "";
  let cursor = 0;
  for (const match of raw.matchAll(tokens)) {
    result += escapePresaleHtml(raw.slice(cursor, match.index));
    const labeled = Boolean(match[2]);
    const split = labeled ? { url: match[2], suffix: "" } : splitRawUrlPunctuation(match[3]);
    result += '<a href="' + escapePresaleHtml(split.url) +
      '" target="_blank" rel="noopener noreferrer" style="color:#1366a3;text-decoration:underline;">' +
      escapePresaleHtml(labeled ? match[1] : split.url) + "</a>" + escapePresaleHtml(split.suffix);
    cursor = match.index + match[0].length;
  }
  return result + escapePresaleHtml(raw.slice(cursor));
}

export function richArticle(blocks) {
  const font = "'Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo',Arial,sans-serif";
  const rendered = blocks.map((block) => {
    if (block.type === "table") {
      const rowHtml = (cells, head = false) => "<tr>" + cells.map((cell) =>
        "<" + (head ? "th" : "td") + ' style="border:1px solid #dce7e8;padding:9px 12px;font-size:14pt;text-align:left;' +
        (head ? "background:#e8f3f3;font-weight:700;" : "") + '">' +
        renderPresaleLinks(cell) + "</" + (head ? "th" : "td") + ">"
      ).join("") + "</tr>";
      return '<table style="width:100%;border-collapse:collapse;font-family:' + font + ';margin:10px 0;">' +
        rowHtml(block.headers, true) + block.rows.map((row) => rowHtml(row)).join("") + "</table>";
    }
    const text = renderPresaleLinks(block.text);
    if (block.type === "title") return '<div style="font-family:' + font + ';font-size:21pt;font-weight:800;line-height:1.45;">' + text + "</div>";
    if (block.type === "heading") return '<div style="font-family:' + font + ';font-size:18pt;font-weight:700;color:#0b7772;line-height:1.5;">' + text + "</div>";
    if (block.type === "points") return '<div style="font-family:' + font + ';font-size:14pt;line-height:1.75;background:#e9f5f5;border-left:4px solid #128c84;padding:14px 18px;"><b>📌 이번 분양 핵심 POINT</b><br>' + text.replace(/\n/g, "<br>") + "</div>";
    if (block.type === "image") return '<div style="font-family:' + font + ';font-size:14pt;font-weight:700;color:#13776f;background:#f0f6f6;padding:12px;text-align:center;">' + text + "</div>";
    if (block.type === "tags") return '<div style="font-family:' + font + ';font-size:13.5pt;line-height:1.6;">' + text + "</div>";
    return '<div style="font-family:' + font + ';font-size:15pt;line-height:1.7;">' + text + "</div>";
  });
  const gap = '<div style="height:14px;"><br></div>';
  return "<div>" + rendered.join(gap) + "</div>";
}
