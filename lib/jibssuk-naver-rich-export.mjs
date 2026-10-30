/**
 * Jibssuk shares Paramma's existing 32/30/19/15 Naver text formatter.
 * Markdown comparison tables are retained as compact native HTML tables:
 * <=3 columns: one table; >3 columns: groups of at most three columns,
 * repeating the first identifier column so every original cell survives.
 * PNG is optional and never replaces the text/table without the user's action.
 */
import {
  parseParammaNaverBlog,
  parammaNaverPlainText,
  parammaNaverRichHtml
} from "./paramma-naver-export.mjs";

const FONT="'Nanum Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif";
const SPACER='<div style="font-family:'+FONT+';font-size:15px;line-height:1.8;margin:0;"><br></div>';
const escapeHtml=value=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const cleanInput=value=>typeof value==="string"?value.replace(/\r\n?/g,"\n").trim():"";

// Parse standard pipe tables, including pipes escaped inside a cell.
// Never infer a table from an isolated pipe or from an invalid separator.
function cells(line){
  if(typeof line!=="string"||!line.includes("|"))return null;
  let source=line.trim();
  if(source.startsWith("|"))source=source.slice(1);
  if(source.endsWith("|")&&!source.endsWith("\\|"))source=source.slice(0,-1);
  const out=[];let current="";
  for(let i=0;i<source.length;i++){
    if(source[i]==="\\"&&source[i+1]==="|"){current+="|";i++;continue;}
    if(source[i]==="|"){out.push(current.trim());current="";continue;}
    current+=source[i];
  }
  out.push(current.trim());
  return out.length>=2?out:null;
}
const isDivider=line=>/^\s*:?-{3,}:?\s*$/.test(line);

function segmentBody(body){
  const source=cleanInput(body).replace(/^[ \t]*[■▣▶●][ \t]+(.+)$/gmu,"## $1");
  if(!source)return [];
  const lines=source.split("\n"),parts=[];let text=[];let tableNumber=0;
  const flush=()=>{if(text.length){const raw=text.join("\n").trim();if(raw)parts.push({kind:"text",raw});text=[];}};
  for(let i=0;i<lines.length;){
    const headers=cells(lines[i]);
    const dividers=i+1<lines.length?cells(lines[i+1]):null;
    if(headers&&dividers&&headers.length===dividers.length
       &&dividers.every(isDivider)&&headers.every(Boolean)){
      const rows=[];let j=i+2;
      while(j<lines.length && lines[j].trim() && cells(lines[j])){
        const row=cells(lines[j]);
        if(!row||row.length!==headers.length)break;
        rows.push(row);j++;
      }
      // No data, or an inconsistent-width row? Preserve the complete original text
      // in the ordinary editor rather than silently dropping a cell.
      const invalid=j<lines.length && lines[j].trim() &&
        cells(lines[j]) && cells(lines[j]).length!==headers.length;
      if(rows.length&&!invalid){
        flush();tableNumber++;
        parts.push({kind:"table",tableNumber,headers,rows});
        i=j;continue;
      }
    }
    text.push(lines[i]);i++;
  }
  flush();
  return parts;
}
function narrowTables(part){
  const {headers,rows,tableNumber}=part;
  const selections=[];
  if(headers.length<=3)selections.push(headers.map((_,index)=>index));
  else {
    // The first column provides row identity and appears in each continuation.
    for(let i=1;i<headers.length;i+=2){
      selections.push([0,...headers.slice(i,i+2).map((_,j)=>i+j)]);
    }
  }
  return selections.map((indices,partIndex)=>({
    tableNumber,
    partNumber:partIndex+1,
    partCount:selections.length,
    headers:indices.map(i=>headers[i]),
    rows:rows.map(row=>indices.map(i=>row[i]))
  }));
}
const numericHeader=value=>/(?:가격|금액|거래량|거래건수|건수|보증금|월세|분양가|층|순위|세대수)/.test(value);

function tableHtml(group){
  const label=group.partCount>1
    ?'<div style="font-family:'+FONT+';font-size:14px;font-weight:700;margin:8px 0;color:#304866;">비교표 '+group.tableNumber+' · '+group.partNumber+'/'+group.partCount+'</div>'
    :"";
  const th=group.headers.map((value,i)=>
    '<th scope="col" style="border:1px solid #d8e2ea;background:#eff4f9;padding:12px 10px;line-height:1.6;text-align:'+
    (numericHeader(value)?"right":"left")+';font-size:15px;font-weight:700;color:#203b57;overflow-wrap:anywhere;">'+escapeHtml(value)+'</th>'
  ).join("");
  const body=group.rows.map((row,r)=>
    "<tr>"+row.map((value,i)=>
      '<td style="border:1px solid #d8e2ea;background:'+(r%2?"#f9fbfd":"#fff")+
      ';padding:11px 10px;line-height:1.7;text-align:'+
      (numericHeader(group.headers[i])?"right":"left")+
      ';font-size:15px;color:#202f3e;word-break:keep-all;overflow-wrap:anywhere;">'+escapeHtml(value)+"</td>"
    ).join("")+"</tr>"
  ).join("");
  return '<div style="font-family:'+FONT+';width:100%;margin:0;">'+label+
    '<table style="width:100%;table-layout:fixed;border-collapse:collapse;border-spacing:0;font-family:'+FONT+';">'+
    "<thead><tr>"+th+"</tr></thead><tbody>"+body+"</tbody></table></div>";
}
function tablePlain(group){
  const label=group.partCount>1?"비교표 "+group.tableNumber+" ("+group.partNumber+"/"+group.partCount+")\r\n":"";
  return label+[group.headers,...group.rows].map(row=>row.join("  |  ")).join("\r\n");
}

// Each segment is already escaped by the shared renderer or tableHtml.
function render(parts){
  return {
    plain:parts.map(p=>p.plain).filter(Boolean).join("\r\n\r\n"),
    html:parts.length?"<div>"+parts.map(p=>p.html).join(SPACER)+"</div>":"",
    blockCount:parts.reduce((sum,p)=>sum+p.count,0)
  };
}
function buildArticle(title,body){
  const parsed=segmentBody(body),tables=[],segments=[];
  for(const part of parsed){
    if(part.kind==="text"){
      const blocks=parseParammaNaverBlog(part.raw,{includeTitle:false});
      if(blocks.length)segments.push({
        plain:parammaNaverPlainText(blocks),
        html:parammaNaverRichHtml(blocks),
        count:blocks.length
      });
    }else{
      for(const group of narrowTables(part)){
        tables.push(group);
        segments.push({plain:tablePlain(group),html:tableHtml(group),count:1});
      }
    }
  }
  const bodyOut=render(segments);
  const name=cleanInput(title);
  if(!name){
    return {...bodyOut,bodyPlain:bodyOut.plain,bodyHtml:bodyOut.html,tables};
  }
  const titleBlock={type:"title",text:name};
  const titlePart={
    plain:parammaNaverPlainText([titleBlock]),
    html:parammaNaverRichHtml([titleBlock]),count:1
  };
  const full=render([titlePart,...segments]);
  // Preserve exact Paramma markup when no table exists.
  if(!tables.length){
    const bodyBlocks=parseParammaNaverBlog(
      cleanInput(body).replace(/^[ \t]*[■▣▶●][ \t]+(.+)$/gmu,"## $1"),
      {includeTitle:false}
    );
    const original=[titleBlock,...bodyBlocks];
    full.plain=parammaNaverPlainText(original);
    full.html=parammaNaverRichHtml(original);
    bodyOut.plain=bodyBlocks.length?parammaNaverPlainText(bodyBlocks):"";
    bodyOut.html=bodyBlocks.length?parammaNaverRichHtml(bodyBlocks):"";
  }
  return {...full,bodyPlain:bodyOut.plain,bodyHtml:bodyOut.html,tables};
}
export function buildJibssukNaverRichBody(body){
  const result=buildArticle("",body);
  return {plain:result.plain,html:result.html};
}
export function buildJibssukNaverRichArticle(title,body){
  return buildArticle(title,body);
}
