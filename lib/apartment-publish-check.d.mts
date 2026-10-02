import type { ApartmentStoryCandidate, ApartmentStoryMode } from "./apartment-story.mjs";
export type ApartmentCheckStatus = "pass" | "warning" | "review";
export type ApartmentCheck = { status: ApartmentCheckStatus; label: string; detail: string };
export declare function auditApartmentArticle(input: {
  mode?: ApartmentStoryMode; name?: string; body: string;
  plan?: ApartmentStoryCandidate | null; dataSummary?: string;
  sourceData?: {
    area?: string; recentPrice?: string; previousPrice?: string;
    monthly?: Array<{ month: string; medianPrice: number | null; tradeCount: number }>;
  } | null;
}): {ready: boolean; checks: ApartmentCheck[]};
