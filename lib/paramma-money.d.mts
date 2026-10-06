export type ParammaMoneyIntent = "신청" | "비용" | "비교" | "구매" | "가입" | "시즌";

export type ParammaMoneyCandidate = {
  category: "신기한 동물이야기" | "신비로운 자연" | "생활 속 궁금증" | "신기한 우리 몸";
  title: string;
  thumbnailHook: string;
  brief: string;
  intent: ParammaMoneyIntent;
  action: string;
  mainKeyword: string;
  subKeywords: string[];
  actionQuestions: string[];
  faqQuestions: string[];
  keywords: string[];
  whyNow: string;
  expiresAt: string;
  moneyScore: number;
  timelinessScore: number;
  fitScore: number;
  sourceUrls: string[];
};

export function moneyCandidateScore(candidate: Partial<ParammaMoneyCandidate>): number;
export function parseParammaMoneyCandidates(raw: string): ParammaMoneyCandidate[];
export function buildParammaMoneyResearchPrompt(input?: {
  date?: string;
  queueTitles?: string[];
  historyTitles?: string[];
}): string;
