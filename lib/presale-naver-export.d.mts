import type { PresaleArticleBlock } from "./apartment-presale.mjs";

export function escapePresaleHtml(value: unknown): string;
export function renderPresaleLinks(input: unknown): string;
export function richArticle(blocks: PresaleArticleBlock[]): string;

export function plainPresaleArticle(blocks: PresaleArticleBlock[]): string;
export const PRESALE_COPY_BUDGET: number;
export function presaleByteCount(value: unknown): number;
export type PresaleCopyPart = {
  blocks: PresaleArticleBlock[];
  html: string;
  text: string;
  htmlBytes: number;
  textBytes: number;
  oversized: boolean;
};
export function createPresaleCopyParts(blocks: PresaleArticleBlock[], maxBytes?: number): PresaleCopyPart[];
