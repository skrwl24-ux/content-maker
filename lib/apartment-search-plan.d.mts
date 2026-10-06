export type ApartmentSearchPlanKeyNumber = {
  label: string;
  value: string;
  basis: string;
};

export type ApartmentSearchPlan = {
  hypotheses: string[];
  searchType: string;
  mainKeyword: string;
  subKeywords: string[];
  readerQuestions: string[];
  answerFirst: string;
  keyNumbers: ApartmentSearchPlanKeyNumber[];
  evidenceNotes: string[];
  sourceUrls: string[];
  checkedAt: string;
};

export function parseApartmentSearchPlan(raw: string): ApartmentSearchPlan | null;

export function buildApartmentSearchPlanResearchPrompt(input?: {
  date?: string;
  contentType?: "bulk" | "top3" | "presale" | "tip" | "moving" | "compare" | "power";
  topic?: string;
  materials?: string;
  dataSummary?: string;
}): string;

export function apartmentSearchPlanPromptBlock(plan: ApartmentSearchPlan | null | undefined): string;
