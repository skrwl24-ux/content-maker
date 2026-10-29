import type {ResearchReport} from "./research-studio.mjs";
export declare function normalizeJibssukCopiedReport(raw:string):string;
export declare function parseJibssukCopiedReport(raw:string):{report:ResearchReport;stored:string}|null;
export declare function buildJibssukIssueArticlePrompt(input?:{
 topic?:string;notes?:string;report?:ResearchReport|null;selectedAngleId?:string;today?:string;
}):string;
