import type { WorkImagePlanItem } from "./work-image-plan.mjs";

export function makePresaleArticlePrompt(topic: string, materials: string, dateKey: string): string;
export function makePresaleImagePlan(): WorkImagePlanItem[];
export function makePresaleImagePrompt(item: WorkImagePlanItem, topic: string, body: string, notes: string): string;

export type PresaleProjectInput = {
  topic?: string;
  dateKey?: string;
  sources?: string;
  materials?: string;
  facts?: string;
  kick?: string;
  article?: string;
};
export type PresaleArticleBlock =
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "title" | "heading" | "points" | "body" | "image" | "tags"; text: string };
export function makePresaleResearchPrompt(input?: PresaleProjectInput): string;
export function makePresaleProjectPrompt(input?: PresaleProjectInput): string;
export function makePresaleReviewPrompt(input?: PresaleProjectInput): string;
export function auditPresaleArticle(article: string): { checks: { key: string; label: string; ok: boolean }[]; passed: boolean; tagCount: number };
export function parsePresaleArticle(article: string): PresaleArticleBlock[];
