export type ResearchFact = {
  id: string; claim: string; sourceUrl: string; sourceTitle: string; publishedAt: string;
};
export type ResearchAngle = {
  id: string; title: string; readerQuestion: string; uniqueValue: string; factIds: string[];
};
export type ResearchTrendLink = {
  subject: string; connection: string; sourceUrl: string; status: string;
};
export type ResearchReport = {
  topic: string; checkedAt: string; summary: string; facts: ResearchFact[];
  angles: ResearchAngle[]; gaps: string[]; trendLinks: ResearchTrendLink[];
};
export declare function buildDeepResearchPrompt(input?: {
  channel?: string; topic?: string; notes?: string; today?: string;
}): string;
export declare function parseResearchReport(raw: string): ResearchReport | null;
export type NaverFinalArticle = {title: string; body: string};
export declare function parseNaverFinalArticle(raw: string): NaverFinalArticle | null;
export declare function factKey(fact: ResearchFact): string;
export declare function buildFollowupResearchPrompt(input?: {
  channel?: string; topic?: string; notes?: string; report?: ResearchReport | null;
  approvedKeys?: string[]; today?: string;
}): string;
export declare function buildFinalArticlePrompt(input?: {
  channel?: string; topic?: string; notes?: string; report?: ResearchReport | null;
  selectedAngleId?: string; approvedKeys?: string[]; today?: string;
}): string;
