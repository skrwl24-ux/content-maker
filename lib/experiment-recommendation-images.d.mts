export type RecommendationReport = {
  mode: "subjective_recommendation_comparison";
  title?: string;
  commonQuestion?: string;
  independentReplies?: Array<{ provider: string; verbatimResponse?: string }>;
};

export type RecommendationImageRole = {
  label: string;
  role: string;
  layout: string;
  exclude: string;
};

export declare const RECOMMENDATION_IMAGE_ROLES: Record<string, RecommendationImageRole>;
export declare function parseRecommendationReport(raw: unknown): RecommendationReport | null;
export declare function recommendationImageSlot(report: RecommendationReport | null, slotId: string): RecommendationImageRole | null;
export declare function buildRecommendationImagePrompt(
  row: { title?: string; labReport?: string },
  slot: { id: string }
): string | null;
