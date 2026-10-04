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
function formatPresaleInline(value) {
  return escapePresaleHtml(value).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

export function renderPresaleLinks(input) {
  const raw = String(input ?? "");
  const tokens = /\[([^\]\r\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/gi;
  let result = "";
  let cursor = 0;
  for (const match of raw.matchAll(tokens)) {
    result += formatPresaleInline(raw.slice(cursor, match.index));
    const labeled = Boolean(match[2]);
    const split = labeled ? { url: match[2], suffix: "" } : splitRawUrlPunctuation(match[3]);
    result += '<a href="' + escapePresaleHtml(split.url) +
      '" target="_blank" rel="noopener noreferrer" style="color:#1366a3;text-decoration:underline;">' +
      formatPresaleInline(labeled ? match[1] : split.url) + "</a>" + escapePresaleHtml(split.suffix);
    cursor = match.index + match[0].length;
  }
  return result + formatPresaleInline(raw.slice(cursor));
}

// Keep inline styles small: Naver's editor receives HTML and text, not embedded images.
const font = "'Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo',Arial,sans-serif";
const base = "font-family:" + font + ";line-height:1.7;word-break:keep-all;";
const infoStyles = {
  note: ["#e4f1ff", "#2879cb", "#1c5c9c"],
  estimate: ["#fff6e3", "#e7a51c", "#866213"],
  check: ["#e8f5e9", "#43a457", "#246d37"],
  warning: ["#ffebee", "#db5660", "#973f47"],
};
function formattedLines(value) {
  return String(value ?? "").split("\n").map((line) =>
    renderPresaleLinks(line.replace(/^\s*[-•]\s*/, "• "))
  ).join("<br>");
}
export function plainPresaleArticle(blocks) {
  return blocks.map((block) => {
    if (block.type === "points") return "📌 이번 분양 핵심 POINT\n" + block.text;
    if (block.type === "info") return "[" + block.title + "]\n" + block.text;
    if (block.type === "toc") return "📋 목차\n" + block.text;
    if (block.type === "table") return [block.headers.join(" | "), ...block.rows.map((row) => row.join(" | "))].join("\n");
    return block.text;
  }).join("\r\n \r\n");
}
export function richArticle(blocks) {
  const rendered = blocks.map((block) => {
    if (block.type === "table") {
      const rowHtml = (cells, head = false) => "<tr>" + cells.map((cell) =>
        "<" + (head ? "th" : "td") + ' style="border:1px solid #dce7e8;padding:7px 9px;font-size:11pt;text-align:left;' +
        (head ? "background:#e9f2fd;font-weight:700;" : "") + '">' +
        renderPresaleLinks(cell) + "</" + (head ? "th" : "td") + ">"
      ).join("") + "</tr>";
      return '<table style="width:100%;border-collapse:collapse;' + base + 'margin:10px 0;">' +
        rowHtml(block.headers, true) + block.rows.map((row) => rowHtml(row)).join("") + "</table>";
    }
    const text = renderPresaleLinks(block.text);
    if (block.type === "title") return '<div style="' + base + 'font-size:20pt;font-weight:800;margin:0 0 18px;">' + text + "</div>";
    if (block.type === "heading") {
      const small = block.level === 3;
      return '<div style="' + base + 'font-size:' + (small ? "14pt" : "17pt") +
        ';font-weight:750;margin:20px 0 8px;color:#1b2934;">' + text + "</div>";
    }
    if (block.type === "points") return '<div style="' + base +
      'font-size:11.5pt;background:#07988e;color:#ffffff;border-left:4px solid #006e65;padding:12px 15px;">' +
      '<strong>✨ 이번 분양 핵심 POINT</strong><br>' + formattedLines(block.text) + "</div>";
    if (block.type === "toc") return '<div style="' + base +
      'font-size:11.5pt;background:#f3f6fa;border-left:4px solid #2673d5;padding:11px 15px;">' +
      '<strong style="color:#2468c1;">📋 목차</strong><br>' + formattedLines(block.text) + "</div>";
    if (block.type === "info") {
      const [background, border, ink] = infoStyles[block.tone] || infoStyles.note;
      return '<div style="' + base + 'font-size:11.5pt;background:' + background +
        ';border-left:4px solid ' + border + ';padding:11px 14px;color:#202c31;">' +
        '<strong style="color:' + ink + ';">' + renderPresaleLinks(block.title) +
        "</strong><br>" + formattedLines(block.text) + "</div>";
    }
    if (block.type === "faqQuestion") return '<div style="' + base +
      'font-size:12.5pt;font-weight:700;color:#1b66c0;margin:12px 0 2px;">' + text + "</div>";
    if (block.type === "divider") return '<hr style="border:0;border-top:1px solid #e3e8ea;margin:20px 0;">';
    if (block.type === "image") return '<div style="' + base +
      'font-size:11pt;color:#677b82;background:#f4f7f7;text-align:center;padding:8px;">' + text + "</div>";
    if (block.type === "tags") return '<div style="' + base + 'font-size:10.5pt;color:#216cba;">' + text + "</div>";
    return '<div style="' + base + 'font-size:12pt;margin:0;">' + text + "</div>";
  });
  const gap = '<div style="height:9px;line-height:9px;"><br></div>';
  return "<div>" + rendered.join(gap) + "</div>";
}

export const PRESALE_COPY_BUDGET = 900 * 1024; // Conservative per-paste target, not a guarantee of editor acceptance.
export function presaleByteCount(value) {
  return new TextEncoder().encode(String(value ?? "")).byteLength;
}
export function createPresaleCopyParts(blocks, maxBytes = PRESALE_COPY_BUDGET) {
  if (!Array.isArray(blocks) || !blocks.length) return [];
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : PRESALE_COPY_BUDGET;
  const parts = [];
  let current = [];
  function makePart(group) {
    const html = richArticle(group);
    const text = plainPresaleArticle(group);
    const htmlBytes = presaleByteCount(html);
    const textBytes = presaleByteCount(text);
    return { blocks: group, html, text, htmlBytes, textBytes, oversized: Math.max(htmlBytes, textBytes) > limit };
  }
  function flush() {
    if (current.length) parts.push(makePart(current));
    current = [];
  }
  for (const block of blocks) {
    const trial = makePart([...current, block]);
    if (current.length && trial.oversized) flush();
    current.push(block);
  }
  flush();
  return parts;
}
