/**
 * Jibssuk shares the actual Naver block formatter used by Paramma.
 * Title 32px / subheading 30px / emphasis 19px / body 15px,
 * with the same paragraph spacing and clipboard HTML.
 * The article body is a separate field, so do not misclassify its first line as a title.
 */
import {
  parseParammaNaverBlog,
  parammaNaverPlainText,
  parammaNaverRichHtml
} from "./paramma-naver-export.mjs";

function cleanInput(value) {
  return typeof value==="string"?value.replace(/\r\n?/g,"\n").trim():"";
}

function bodyBlocks(body) {
  // Support older Jibssuk drafts that used an isolated ■ heading marker.
  const raw=cleanInput(body).replace(/^[ \t]*[■▣▶●][ \t]+(.+)$/gmu,"## $1");
  return raw?parseParammaNaverBlog(raw,{includeTitle:false}):[];
}

export function buildJibssukNaverRichBody(body) {
  const blocks=bodyBlocks(body);
  return {
    plain:blocks.length?parammaNaverPlainText(blocks):"",
    html:blocks.length?parammaNaverRichHtml(blocks):""
  };
}

export function buildJibssukNaverRichArticle(title,body) {
  const name=cleanInput(title);
  const blocks=bodyBlocks(body);
  const titledBlocks=name?[{type:"title",text:name},...blocks]:blocks;
  return {
    plain:titledBlocks.length?parammaNaverPlainText(titledBlocks):"",
    html:titledBlocks.length?parammaNaverRichHtml(titledBlocks):"",
    bodyPlain:blocks.length?parammaNaverPlainText(blocks):"",
    bodyHtml:blocks.length?parammaNaverRichHtml(blocks):"",
    blockCount:titledBlocks.length
  };
}
