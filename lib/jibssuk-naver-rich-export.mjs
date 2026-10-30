/**
 * Light, editorial formatting for pasting Jibssuk articles into Naver SmartEditor ONE.
 * The original plain text is preserved alongside the rich HTML clipboard flavor.
 * Naver may remove external styles during paste; do not claim pixel-perfect retention.
 */
const escapeHtml=(value)=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

function inline(text){
  const escaped=escapeHtml(text);
  // Highlight only deliberately marked **bold** spans. Never infer emphasis.
  return escaped.replace(/\*\*([^*\n]+)\*\*/g,
    '<strong style="font-weight:700;color:#1c416c;">$1</strong>');
}

const hStyle="margin:26px 0 12px;font-size:19px;line-height:1.65;font-weight:700;color:#1c416c;";
const pStyle="margin:0 0 20px;font-size:16px;line-height:1.9;color:#252f3e;white-space:normal;";
const sourceStyle="margin:0 0 10px;font-size:13px;line-height:1.75;color:#586779;white-space:normal;";

function isHeading(text){
  const mark=text.match(/^(?:#{1,3}\s+|[■▣▶●]\s*)(.{2,120})$/u);
  if(mark)return mark[1].trim();
  return text==="출처"?"출처":null;
}

function formatBlock(block){
  const lines=block.split("\n").map(x=>x.trimEnd());
  const nonempty=lines.filter(x=>x.trim());
  if(!nonempty.length)return "";
  // A heading may appear after a line break without a blank paragraph.
  if(lines.length>1 && lines.some(x=>isHeading(x.trim())!==null)){
    const segments=[];let current=[];
    const flush=()=>{if(current.length){segments.push(formatBlock(current.join("\n")));current=[];}};
    for(const line of lines){
      if(isHeading(line.trim())!==null){flush();segments.push(formatBlock(line.trim()));}
      else current.push(line);
    }
    flush();
    return segments.join("\n");
  }
  const single=nonempty.length===1?nonempty[0].trim():null;
  const heading=single?isHeading(single):null;
  if(heading!==null)return '<h3 style="'+hStyle+'">'+inline(heading)+'</h3>';
  const isSource=nonempty.every(x=>/^(?:https?:\/\/|(?:한국부동산원|머니투데이|매일경제|연합뉴스|뉴시스|땅집고)\b|자료 기준일[:：]|[^\n]+?\(\d{4}\.\d{1,2}\.\d{1,2}\))/.test(x.trim()));
  const body=lines.map(line=>{
    // Option/price calculations remain in the writer's order, with bold totals.
    if(/^\s*(?:합계|총액|총 공급금액|최종 공급금액)\s*[:：]?\s*/u.test(line)){
      return '<strong style="font-weight:700;color:#b75e25;">'+inline(line)+'</strong>';
    }
    if(/^\s*\d{3}동\s+\d+호\s*$/u.test(line)){
      return '<strong style="font-weight:700;color:#1c416c;">'+inline(line)+'</strong>';
    }
    return inline(line);
  }).join("<br>");
  return '<p style="'+(isSource?sourceStyle:pStyle)+'">'+body+"</p>";
}

export function buildJibssukNaverRichBody(body){
  const plain=typeof body==="string"?body.replace(/\r\n?/g,"\n").trim():"";
  if(!plain)return {plain:"",html:""};
  const blocks=plain.split(/\n[ \t]*\n+/).map(formatBlock).filter(Boolean);
  const html='<div style="font-family:Malgun Gothic,Apple SD Gothic Neo,Arial,sans-serif;background:#ffffff;color:#252f3e;font-size:16px;line-height:1.9;">'+blocks.join("\n")+"</div>";
  return {plain,html};
}
