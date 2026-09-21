function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function inline(text: string, rich: boolean): string {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__/g;
  let result = "", start = 0;
  for (const match of text.matchAll(re)) {
    result += rich ? escape(text.slice(start, match.index)) : text.slice(start, match.index);
    if (match[1]) result += rich ? '<a href="' + escape(match[2]) + '" style="color:#1675b6;text-decoration:underline;">' + escape(match[1]) + '</a>' : match[1] + " (" + match[2] + ")";
    else result += rich ? "<strong>" + escape(match[3] || match[4]) + "</strong>" : match[3] || match[4];
    start = match.index! + match[0].length;
  }
  return result + (rich ? escape(text.slice(start)) : text.slice(start));
}
export function naverCopy(body: string, topic: string) {
  let source = body.replace(/\r\n?/g, "\n");
  if (source.includes("[본문]") && source.includes("[/본문]")) source = source.slice(source.indexOf("[본문]") + 4, source.indexOf("[/본문]"));
  source = source.split(/\[이미지\s*0\d\]/)[0];
  const lines = source.split("\n").map(line => line.replace(/\\([#*_~&])/g, "$1").replace(/\\\s*$/, "").trim())
    .filter(line => line && !/^\[\/?(?:본문|제목)\]$/.test(line) && !/^\x60\x60\x60/.test(line) && !/^:::/.test(line));
  const plainTitle = topic.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
  if (lines.length && inline(lines[0].replace(/^#{1,6}\s+/, ""), false) === plainTitle) lines.shift();
  const plain: string[] = [], html: string[] = [];
  for (const line of lines) {
    const heading = /^#{1,6}\s+/.test(line) || (/^[🏠📊🚉🔎✅📌📚📎]/u.test(line) && line.length <= 55 && !/[.!?。]$/.test(line));
    const text = line.replace(/^#{1,6}\s+/, "");
    plain.push(inline(text, false));
    const tag = heading ? "h2" : "p";
    html.push("<" + tag + ' style="margin:0 0 20px;font-size:' + (heading ? "20px;font-weight:700" : "16px;font-weight:400") + ';line-height:1.8;text-align:left;">' + inline(text, true) + "</" + tag + ">");
  }
  return { title: plainTitle, plain: plain.join("\n\n"), html: '<div style="font-family:Arial,\'Malgun Gothic\',sans-serif;color:#222;">' + html.join("") + "</div>" };
}
