export declare const JIBSSUK_RESEARCH_HANDOFF_KEY: string;
export type ResearchHandoff = {
  version: 1; title: string; category: string; interestType: string;
  interestEvidence: string; sourceUrl: string; sourceDate: string; checkedAt: string;
};
export declare function makeResearchHandoff(candidate: {
  title?: string;category?: string;interestType?: string;interestEvidence?: string;
  sourceUrl?: string;sourceDate?: string;checkedAt?: string;
}): ResearchHandoff | null;
export declare function parseResearchHandoff(raw: string | null): ResearchHandoff | null;
export declare function researchNotesFromHandoff(h: ResearchHandoff): string;
export declare function pickResearchDestination(raws: Array<string | null>, h: ResearchHandoff): {
 kind: "free" | "existing" | "full" | "invalid"; slot: number;
};
