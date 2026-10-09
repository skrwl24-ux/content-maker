import type { ExperimentForPrompt } from "./ai-world-experiment-chatgpt-handoff.mjs";
export function buildExperimentScheduleReport(state:ExperimentForPrompt):string;
export function buildExperimentSchedulePrompt(state:ExperimentForPrompt & {scheduleDate?:string}):string;
