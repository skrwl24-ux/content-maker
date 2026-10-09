export interface ExperimentForPrompt {
 mode?:string;title?:string;category?:string;testQuestion?:string;groundTruth?:string;sources?:string;
 hiddenTwist?:string;sourceStatus?:string;fixtureMode?:string;material?:string;pdf?:{name?:string;sha256?:string}|null;
 human?:{choice?:string;notes?:string;durationText?:string;attemptedBeforeAI?:boolean;photos?:unknown[]};
 runs?:Record<string,{model?:string;response?:string}>;
}
export type ImportedBlogDraft = {
 title:string;metaDescription:string;labels:string[];html:string;needsReview:string[];ready:boolean;
 scores:Array<{provider:"chatgpt"|"claude"|"gemini";finalAnswer:string;verdict:"correct"|"incorrect"|"partial"|"uncertain"|"recommendation";evidence:string;explanation:string}>;
 humanVerdict:"correct"|"incorrect"|"partial"|"uncertain"|"not_recorded";
};
export function buildChatGptArticlePrompt(state:ExperimentForPrompt):string;
export function buildChatGptTopicPrompt(existing:string[]):string;
export function parseChatGptDraft(raw:string,responses:Record<string,{response:string}>,mode?:string):{draft:ImportedBlogDraft|null;error:string};
