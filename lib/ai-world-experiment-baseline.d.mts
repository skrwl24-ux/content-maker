export type BaselineRun = {accountPlan?: ""|"free"|"guest"|"paid"|"unknown"; chatMode?: ""|"standard"|"advanced"|"unknown"; webUsed?: "unknown"|"no"|"yes"; extraToolsUsed?: "unknown"|"no"|"yes"; newChat?: boolean; model?:string; response?:string};
export const BASELINE_PROFILE:Readonly<{id:string;title:string;commonInstruction:string}>;
export function getProviderBaselineHint(id:"chatgpt"|"claude"|"gemini"): {service:string;steps:string[]} | null;
export function baselineStatus(run?:BaselineRun): {protocol:string;complete:boolean;strictFreeBaseline:boolean;deviations:string[];label:string};
