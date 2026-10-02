export type LifeAuditMode = "bulk" | "school" | "mega";
export type LifeCheckStatus = "confirmed" | "update" | "unverified";
export type LifeCheck = {
  id: string;
  topic: string;
  status: LifeCheckStatus;
  original: string;
  recommendedText: string;
  finding: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceDate: string;
  matchCount: number;
};
export type LifeVerificationReport = {
  requestId: string;
  name: string;
  summary: string;
  checkedAt: string;
  checks: LifeCheck[];
};
export declare function lifeAuditRequestId(name: string, body: string): string;
export declare function makeLifeVerificationPrompt(input?: {
  mode?: LifeAuditMode;
  name?: string;
  region?: string;
  body?: string;
  placeName?: string;
}): string;
export declare function parseLifeVerificationResult(raw: string, input?: {
  name?: string;
  body?: string;
}): LifeVerificationReport;
export declare function applyLifeVerificationChanges(
  body: string, report: LifeVerificationReport | null, selectedIds: string[]
): { body: string; applied: number; skipped: number };
