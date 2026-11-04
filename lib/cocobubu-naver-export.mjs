// 코코부부: 기존 네이버 글꼴·줄바꿈 처리기를 재사용하고 원본 표의 행·열은 유지합니다.
import {buildJibssukNaverRichArticle} from "./jibssuk-naver-rich-export.mjs";
const escapeHtml = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const inline = value => escapeHtml(value).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/__(.*?)__/g,"<strong>$1</strong>");
const splitCells = line => {
  if(!line.includes("|"))return null;
  const source=line.trim().replace(/^\|/,"").replace(/(?<!\\)\|$/,"");
  const output=[];let cell="";
  for(let i=0;i<source.length;i++){
    if(source[i]==="\\"&&source[i+1]==="|"){cell+="|";i++;continue;}
    if(source[i]==="|"){output.push(cell.trim());cell="";continue;}
    cell+=source[i];
  }
  output.push(cell.trim());return output.length>1?output:null;
};
function readTable(lines,start){
  const headers=splitCells(lines[start]),divider=lines[start+1]?splitCells(lines[start+1]):null;
  if(!headers||!divider||headers.length!==divider.length||!headers.every(Boolean)||!divider.every(x=>/^:?-{3,}:?$/.test(x)))return null;
  const rows=[];let end=start+2;
  while(end<lines.length&&lines[end].trim()&&splitCells(lines[end])){
    const row=splitCells(lines[end]);
    if(row.length!==headers.length)return null;
    rows.push(row);end++;
  }
  return rows.length?{headers,rows,end}:null;
}
function tableHtml(t){
  const cell=(value,head)=>'<'+(head?"th":"td")+' style="border:1px solid #d8e2ea;padding:10px 8px;font-size:15px;line-height:1.6;word-break:keep-all;background:'+(head?"#eff4f9":"#fff")+';font-weight:'+(head?"700":"400")+';">'+inline(value)+'</'+(head?"th":"td")+'>';
  return '<table style="width:100%;border-collapse:collapse;border-spacing:0;table-layout:auto;font-family:Nanum Gothic,Noto Sans KR,Arial,sans-serif;"><thead><tr>'+t.headers.map(v=>cell(v,true)).join("")+'</tr></thead><tbody>'+t.rows.map(r=>'<tr>'+r.map(v=>cell(v,false)).join("")+'</tr>').join("")+'</tbody></table>';
}
export function buildCocobubuNaverRichArticle(defaultTitle,article){
  let raw=String(article||"").replace(/\r\n?/g,"\n").trim();
  let title=String(defaultTitle||"").trim();
  const heading=raw.match(/^#\s+([^\n]+)(?:\n|$)/);
  if(heading){title=heading[1].trim();raw=raw.slice(heading[0].length).trim();}
  else if(title&&raw.split("\n")[0].trim()===title){raw=raw.slice(title.length).trim();}
  const lines=raw.split("\n"),output=[],tables=[];
  for(let i=0;i<lines.length;){
    const t=readTable(lines,i);
    if(t){
      const id="COCO_NAVER_TABLE_"+tables.length+"_PLACEHOLDER";
      const html=tableHtml(t);
      const plain=[t.headers,...t.rows].map(r=>r.join(" | ")).join("\r\n");
      tables.push({headers:t.headers,rows:t.rows,html,plain,id});
      output.push("",id,"");i=t.end;
    }else{output.push(lines[i]);i++;}
  }
  const result=buildJibssukNaverRichArticle(title,output.join("\n"));
  const replace=(value,kind)=>tables.reduce((text,t)=>text.replace(t.id,kind==="html"?t.html:t.plain),value);
  return {
    title, tables:tables.map(({headers,rows,html,plain})=>({headers,rows,html,plain})),
    html:replace(result.html,"html"),plain:replace(result.plain,"plain"),
    bodyHtml:replace(result.bodyHtml,"html"),bodyPlain:replace(result.bodyPlain,"plain")
  };
}
