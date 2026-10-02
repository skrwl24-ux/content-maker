export type BloggerOutput = {
  title: string;
  description: string;
  slug: string;
  labels: string;
  html: string;
  errors: string[];
  valid: boolean;
};
export function parseBloggerOutput(raw: string, expectedSlug?: string): BloggerOutput;
