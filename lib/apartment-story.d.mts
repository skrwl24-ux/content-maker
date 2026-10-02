export type ApartmentStoryCandidate = {
  id: string;
  title: string;
  kind: string;
  facts: string;
  connection: string;
  bridge: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceDate: string;
  eventDate: string;
  timing: string;
  communityNote: string;
  topic: string;
  kick: string;
  discovery: string;
  placeName: string;
  accessInfo: string;
  accessSourceUrl: string;
  storyDraft: string;
  visualMode: "map-hybrid" | "photo-info" | "timeline" | "data-card";
  visualFacts: string;
};
export declare function parseApartmentStoryResearch(raw: string): ApartmentStoryCandidate[];
export declare function makeApartmentStoryResearchPrompt(
  data: { name: string; region: string; area: string; station: string; locationLine: string },
  articleTheme: { label: string; angle: string }
): string;
export type ApartmentStoryMode = "bulk" | "school" | "mega";
export type ApartmentStoryVisualMode = ApartmentStoryCandidate["visualMode"];
export declare function makeApartmentV3PlanningPrompt(input: {
  mode: ApartmentStoryMode; name: string; region: string; dataSummary: string; previousTopics?: string; regionalHints?: string;
}): string;
export declare function makeStoryFactSheet(plan: ApartmentStoryCandidate | null): string;
export declare function extractStoryExcerpt(body: string, plan: ApartmentStoryCandidate | null, name?: string): string;
export declare function makeApprovedStoryBlock(plan: ApartmentStoryCandidate | null): string;
export declare function makeApprovedStoryVisualPrompt(plan: ApartmentStoryCandidate | null, options?: {
  mode?: ApartmentStoryMode; name?: string; region?: string; mapProvided?: boolean; finalStoryExcerpt?: string;
}): string;
