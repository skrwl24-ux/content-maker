export type GoogleContentPlan = {
  moneyIntent: "comparison" | "signup" | "billing" | "problem-solving" | "pricing" | "upgrade" | "refund" | "evergreen" | "news";
  cluster: string;
  primaryQuery: string;
  secondaryQueries: string[];
  userDecision: string;
  originalValue: string;
  originalValueType: string;
  answerFirst: string;
  evidenceLevel: string;
  sourceUrls: string[];
  checkedAt: string;
  notes: string[];
};

export function parseGoogleContentPlan(raw: string): GoogleContentPlan | null;
export function buildGoogleContentPlanPrompt(input?: {
  date?: string;
  title?: string;
  keyword?: string;
  note?: string;
  existingTitles?: string[];
}): string;
export function googleContentPlanBlock(plan: GoogleContentPlan | null | undefined): string;
export function googleImagePlanBlock(plan: GoogleContentPlan | null | undefined, slotId: string): string;
