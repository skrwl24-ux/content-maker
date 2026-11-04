export type CocobubuNaverTable = { headers:string[]; rows:string[][]; html:string; plain:string; };
export type CocobubuNaverArticle = {title:string;html:string;plain:string;bodyHtml:string;bodyPlain:string;tables:CocobubuNaverTable[];};
export declare function buildCocobubuNaverRichArticle(title:string, article:string):CocobubuNaverArticle;
