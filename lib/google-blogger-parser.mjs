// Parser for the six exact ChatGPT-to-Blogger output markers.
// Delimiters are recognized even when rich-text copying collapses all newlines.
const MARKER_NAMES = ["FINAL_TITLE","META_DESCRIPTION","SLUG","LABELS","BLOGGER_HTML","/BLOGGER_HTML"];
const IMAGE_IDS = ["00","01","02","03","04","05"];

function cleanMetaField(value) {
  return value.replace(/^[\s\\]+|[\s\\]+$/g, "").trim();
}

function cleanCopiedHtml(value) {
  return value
    .replace(/^```(?:html)?[ \t]*\n?/i, "")
    .replace(/\s*```[ \t]*$/i, "")
    .replace(/\\+(?=\s*<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>)/gi, "")
    .replace(/(^|\n)[ \t]*\\[ \t]*(?=\n|$)/g, "$1")
    .replace(/(<(?:p|h2|h3|h4|li|th|td|strong|em)\b[^>]*>)[ \t]*\\(?=\S)/gi, "$1")
    .trim();
}

function hasUnexpectedMetadata(value) {
  return /\[(?:FINAL_TITLE|META_DESCRIPTION|SLUG|LABELS|\/?BLOGGER_HTML)\]/i.test(value) || /<\/?\s*[a-z][^>]*>/i.test(value);
}

export function parseBloggerOutput(input, expectedSlug = "") {
  const result = { title: "", description: "", slug: "", labels: "", html: "", errors: [], valid: false };
  if (!input.trim()) return result;
  const raw = input.replace(/\r\n?/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
  const matches = [...raw.matchAll(/\[(FINAL_TITLE|META_DESCRIPTION|SLUG|LABELS|BLOGGER_HTML|\/BLOGGER_HTML)\]/gi)];
  if (matches.length !== MARKER_NAMES.length ||
      matches.some((match, index) => match[1].toUpperCase() !== MARKER_NAMES[index])) {
    result.errors.push("원고 마커가 누락·중복되었거나 순서가 잘못되었습니다. [FINAL_TITLE]부터 [/BLOGGER_HTML]까지 다시 붙여넣어 주세요.");
    return result;
  }
  const parts = matches.slice(0, -1).map((match, index) =>
    raw.slice(match.index + match[0].length, matches[index + 1].index)
  );
  result.title = cleanMetaField(parts[0]);
  result.description = cleanMetaField(parts[1]);
  result.slug = cleanMetaField(parts[2]);
  result.labels = cleanMetaField(parts[3]);
  result.html = cleanCopiedHtml(parts[4]);

  if (!result.title || result.title.length > 160 || hasUnexpectedMetadata(result.title)) {
    result.errors.push("제목에 다른 항목이나 HTML이 섞였거나 제목이 비어 있습니다.");
  }
  if (result.description.length < 140 || result.description.length > 155 || hasUnexpectedMetadata(result.description)) {
    result.errors.push("검색 설명은 HTML 없이 140~155자의 영문 문장이어야 합니다.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug) || (expectedSlug && result.slug !== expectedSlug)) {
    result.errors.push("슬러그 형식이 잘못되었거나 일정에 지정된 고정 슬러그와 다릅니다.");
  }
  const labels = result.labels.split(",").map(label => label.trim());
  if (hasUnexpectedMetadata(result.labels) || labels.length < 4 || labels.length > 7 || labels.some(label => !label || label.length > 60)) {
    result.errors.push("라벨은 다른 마커나 HTML 없이 쉼표로 구분한 4~7개여야 합니다.");
  }
  if (!/<(?:p|h2|h3|h4|ul|ol|table)\b/i.test(result.html)) {
    result.errors.push("Blogger HTML 본문을 찾지 못했습니다.");
  }
  if (/<\s*\/?\s*(?:html|head|body|script|style|iframe|form|object|embed|svg|font)\b/i.test(result.html) ||
      /\bon[a-z]+\s*=/i.test(result.html) || /javascript\s*:/i.test(result.html)) {
    result.errors.push("본문에 Blogger용으로 허용하지 않은 태그 또는 속성이 포함되어 있습니다.");
  }
  if (/<\s*h1\b/i.test(result.html)) {
    result.errors.push("본문에는 H1을 넣지 마세요. Blogger 글 제목이 최상위 제목 역할을 합니다.");
  }
  if (/\sstyle\s*=\s*["'][^"']*["']/i.test(result.html) ||
      /\s(?:class|id)\s*=\s*["'][^"']*["']/i.test(result.html)) {
    result.errors.push("Blogger 기본 디자인을 유지하려면 본문 태그에 style, class, id를 넣지 마세요.");
  }
  if (/(?:&nbsp;|<p>\s*(?:<br\s*\/?>\s*)+<\/p>|<h[2-4]>\s*(?:<br\s*\/?>\s*)*<\/h[2-4]>)/i.test(result.html)) {
    result.errors.push("빈 줄은 &nbsp;나 빈 <br> 블록으로 만들지 말고 문단·제목 태그 자체의 간격을 사용하세요.");
  }
  const missingImages = IMAGE_IDS.filter(id =>
    !new RegExp("\\[IMAGE\\s+" + id + "\\s+—\\s+[^\\]]+\\]", "i").test(result.html)
  );
  if (missingImages.length) result.errors.push("본문 이미지 위치 마커 누락: " + missingImages.join(", "));
  result.valid = result.errors.length === 0;
  return result;
}
