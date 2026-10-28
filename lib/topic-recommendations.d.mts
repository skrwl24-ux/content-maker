export type TopicRecommendation = {
  id: string; title: string; channel: string; type: string; whyNow: string;
  readerQuestion: string; extraValue: string; sourceUrl: string; publishedAt: string;
};
export type TopicRecommendationReport = {
  checkedAt: string; candidates: TopicRecommendation[];
};
export declare function buildTopicRecommendationPrompt(input?: {
  channel?: string; focus?: string; lookbackDays?: number; today?: string; existingTopics?: string[];
}): string;
export declare function parseTopicRecommendations(raw: string): TopicRecommendationReport | null;
export declare function recommendationToResearchNotes(item: TopicRecommendation, checkedAt?: string): string;
