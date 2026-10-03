import type { WorkImagePlanItem } from "./work-image-plan.mjs";

export function makePresaleArticlePrompt(topic: string, materials: string, dateKey: string): string;
export function makePresaleImagePlan(): WorkImagePlanItem[];
export function makePresaleImagePrompt(item: WorkImagePlanItem, topic: string, body: string, notes: string): string;
