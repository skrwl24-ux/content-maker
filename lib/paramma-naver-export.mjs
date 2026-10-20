// Paramma Naver export: preserve deliberate mobile line breaks inside each paragraph.
function cleanNaverLine(line) {
  return line
    .replace(/^>\s?/, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .replace(/^__(.*?)__$/, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\\#/g, "#")
    .trim();
}

function isNonPublishNaverHeading(line) {
  const normalized = cleanNaverLine(line)
    .replace(/^\[|\]$/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^(이미지.*기획\s*메모|검수\s*메모)(?:\s*[:：-].*)?$/i.test(normalized);
}

function normalizeNaverParagraphLines(raw) {
  const source = String(raw || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let firstPublishLineSeen = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    // Retain each intentional Enter. Joining with spaces caused the lost line breaks.
    out.push(paragraph.join("\n"));
    paragraph = [];
  };

  const isStructural = (trimmed) => {
    if (!trimmed) return false;
    if (/^:::writing\b/i.test(trimmed) || trimmed === ":::" || /^---option\b/i.test(trimmed)) return true;
    if (/^#{1,6}\s+/.test(trimmed)) return true;
    if (/^(\*\*|__)[\s\S]+\1$/.test(trimmed)) return true;
    if (/^>\s+/.test(trimmed)) return true;
    if (/^(?:---+|\*\*\*+)$/.test(trimmed)) return true;
    const cleaned = cleanNaverLine(trimmed);
    if (/^\[이미지\s*\d+/i.test(cleaned)) return true;
    if (/^#[^\s#]+(?:\s+#[^\s#]+)+/.test(cleaned)) return true;
    return /^[🐾🌌💡🧠✅📌🔎]/u.test(cleaned) && cleaned.length <= 40 && !/[.!?]$/.test(cleaned);
  };

  for (const rawLine of source) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph();
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (/^:::writing\b/i.test(trimmed) || trimmed === ":::" || /^---option\b/i.test(trimmed)) {
      flushParagraph();
      out.push(trimmed);
      continue;
    }
    if (!firstPublishLineSeen) {
      flushParagraph();
      out.push(trimmed);
      firstPublishLineSeen = true;
      continue;
    }
    if (isStructural(trimmed)) {
      flushParagraph();
      out.push(trimmed);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return out.join("\n");
}

export function parseParammaNaverBlog(raw) {
  const allLines = String(raw || "").replace(/\r\n?/g, "\n").split("\n");
  const cutoff = allLines.findIndex((line) => isNonPublishNaverHeading(line));
  const publishLines = cutoff >= 0 ? allLines.slice(0, cutoff) : allLines;
  const lines = normalizeNaverParagraphLines(publishLines.join("\n")).split("\n");
  const blocks = [];
  let firstContent = true;
  let bodyLines = [];

  const flushBody = () => {
    if (!bodyLines.length) return;
    blocks.push({ type: "body", text: bodyLines.join("\n") });
    bodyLines = [];
  };

  for (const original of lines) {
    const trimmed = original.trim();
    if (!trimmed) {
      flushBody();
      continue;
    }
    if (/^:::writing\b/i.test(trimmed) || trimmed === ":::" || /^---option\b/i.test(trimmed)) {
      flushBody();
      continue;
    }
    // The Markdown horizontal rule is a visual divider, not article text.
    if (/^(?:---+|\*\*\*+)$/.test(trimmed)) {
      flushBody();
      continue;
    }

    const line = cleanNaverLine(trimmed);
    if (!line) continue;
    if (firstContent) {
      blocks.push({ type: "title", text: line });
      firstContent = false;
      continue;
    }

    const hashtagCount = (line.match(/#[^\s#]+/g) || []).length;
    if (hashtagCount >= 2 && line.startsWith("#")) {
      flushBody();
      blocks.push({ type: "tags", text: line });
      continue;
    }
    if (/^\[이미지\s*\d+/i.test(line)) {
      flushBody();
      blocks.push({ type: "image", text: line });
      continue;
    }

    const markdownHeading = /^#{2,6}\s+/.test(trimmed);
    const wholeBold = /^(\*\*|__)[\s\S]+\1$/.test(trimmed);
    const blockQuote = /^>\s+/.test(trimmed);
    const emojiHeading = /^[🐾🌌💡🧠✅📌🔎]/u.test(line) && line.length <= 40 && !/[.!?]$/.test(line);

    if (markdownHeading || emojiHeading) {
      flushBody();
      blocks.push({ type: "subheading", text: line });
      continue;
    }
    if (wholeBold || blockQuote) {
      flushBody();
      blocks.push({ type: "emphasis", text: line });
      continue;
    }
    bodyLines.push(line);
  }
  flushBody();
  return blocks;
}

function escapeNaverHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parammaNaverPlainText(blocks) {
  // CRLF for Windows; one empty line between blocks, one newline within paragraphs.
  return blocks.map((block) => block.text.replace(/\r\n?/g, "\n").replace(/\n/g, "\r\n")).join("\r\n\r\n");
}

export function parammaNaverRichHtml(blocks) {
  const font = "'Nanum Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif";
  const sizes = { title: 32, subheading: 30, emphasis: 19, body: 15, image: 15, tags: 15 };
  const blockHtml = blocks.map((block) => {
    const size = sizes[block.type] || 15;
    const lineHeight = block.type === "title" ? 1.35 : block.type === "subheading" ? 1.45 : block.type === "emphasis" ? 1.65 : block.type === "body" ? 1.8 : 1.7;
    const weight = block.type === "title" || block.type === "subheading" || block.type === "emphasis" ? 700 : block.type === "image" ? 600 : 400;
    // HTML clipboard needs <br> for soft line breaks (CSS white-space alone is not portable).
    const safe = escapeNaverHtml(block.text).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
    return '<div style="font-family:' + font + ';font-size:' + size + 'px;line-height:' + lineHeight + ';font-weight:' + weight + ';margin:0;">' + safe + '</div>';
  });
  const spacer = '<div style="font-family:' + font + ';font-size:15px;line-height:1.8;margin:0;"><br></div>';
  return "<div>" + blockHtml.join(spacer) + "</div>";
}
