export type Provider = "chatgpt"|"claude"|"gemini";
export type Status = "idea"|"collecting"|"analyzing"|"drafting"|"published";
export type ImageSlot = "hero" | Provider | "insight";
export interface AtlasProject {
 id:string; topic:string; category:string; date:string; updatedAt:string; status:Status; question:string; notes:string;
 responses:Record<Provider,string>; images:Record<ImageSlot,string>; analysis:string; articleRaw:string; publishedUrl:string;
}
export interface ParsedArticle {
 valid:boolean; errors:string[]; title:string; description:string; slug:string; labels:string; html:string;
}
export const STORAGE_KEY:string;
export const BLOG_BASE:string;
export const PROVIDERS:Provider[];
export const IMAGE_SLOTS:Array<{id:ImageSlot;label:string;note:string}>;
export const CATEGORIES:string[];
export const STATUS:Status[];
export const STATUS_LABEL:Record<Status,string>;
export function makeId():string;
export function createExperiment(topic:string,category?:string,date?:string):AtlasProject;
export function normalizeTopic(text:string):string;
export function isDuplicateTopic(topic:string,existing:Array<string|Pick<AtlasProject,"topic">>):boolean;
export function parseBulkTopics(input:string,existing?:Array<string|Pick<AtlasProject,"topic">>):{items:string[];skipped:string[]};
export function responsesReady(project:AtlasProject):boolean;
export function buildIdeasPrompt(projects:AtlasProject[]):string;
export function buildAnalysisPrompt(project:AtlasProject):string;
export function buildArticlePrompt(project:AtlasProject):string;
export function buildHeroPrompt(project:AtlasProject):string;
export function buildInsightPrompt(project:AtlasProject):string;
export function validPublishedUrl(s:string):boolean;
export function relatedProjects(project:AtlasProject,projects:AtlasProject[]):AtlasProject[];
export function relatedHtml(project:AtlasProject,projects:AtlasProject[],location:"mid"|"end"):string;
export function parseArticle(raw:string):ParsedArticle;
export function assembleArticle(project:AtlasProject,projects:AtlasProject[],allowMissingImages?:boolean):{html:string;errors:string[];parsed:ParsedArticle};
