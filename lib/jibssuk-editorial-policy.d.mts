import type {ResearchReport} from './research-studio.mjs';
export declare const JIBSSUK_READER_RULES:string;
export declare const JIBSSUK_EVIDENCE_RULES:string;
export declare const JIBSSUK_TITLE_RULES:string;
export declare const JIBSSUK_RESEARCH_FIELDS:string;
export declare function checkJibssukTitleConsistency(title:string,body:string):string[];
export declare function selectJibssukWritingEvidence(report:ResearchReport,selectedAngleId:string):ResearchReport & {omittedFactIds:string[];evidenceSelectionNote:string};
