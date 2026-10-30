export type ParammaNaverBlock = {
  type: "title" | "subheading" | "emphasis" | "body" | "image" | "tags";
  text: string;
};
export function parseParammaNaverBlog(raw: string, options?: { includeTitle?: boolean }): ParammaNaverBlock[];
export function parammaNaverPlainText(blocks: ParammaNaverBlock[]): string;
export function parammaNaverRichHtml(blocks: ParammaNaverBlock[]): string;
