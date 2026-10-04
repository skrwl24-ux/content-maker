import type { LabRun, LabProviderId } from "./ai-price-atlas-lab.mjs";
export type AutoVerdict = "unreviewed" | "found" | "partial" | "missed" | "review";
export type AutoDetail = {
  id: string;
  verdict: AutoVerdict;
  evidence: string;
  explanation: string;
};
export type AutoScore = {
  found: number;
  partial: number;
  missed: number;
  uncertain: number;
  unreviewed: number;
  falsePositives: null;
  evaluated: boolean;
  complete: boolean;
  details: AutoDetail[];
};
export function evaluateLabAnswer(response?: string): { evaluated: boolean; details: AutoDetail[] };
export function scoreAutoRun(run?: LabRun | null): AutoScore;
export function makeAutoReport(runs: Partial<Record<LabProviderId, LabRun>>, date?: string): string;
export function makeAutoBloggerPrompt(runs: Partial<Record<LabProviderId, LabRun>>, date?: string): string;
