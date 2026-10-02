import type { ApartmentStoryCandidate, ApartmentStoryMode } from "./apartment-story.mjs";
export type ApartmentCheckStatus = "pass" | "warning" | "review";
export type ApartmentCheck = { status: ApartmentCheckStatus; label: string; detail: string };
export declare function auditApartmentArticle(input: {
  mode?: ApartmentStoryMode; name?: string; body: string;
  plan?: ApartmentStoryCandidate | null; dataSummary?: string;
}): {ready: boolean; checks: ApartmentCheck[]};
