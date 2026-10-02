export type ApartmentStoryCandidate = {
  id: string;
  title: string;
  kind: string;
  facts: string;
  connection: string;
  bridge: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceDate: string;
  eventDate: string;
  timing: string;
  communityNote: string;
};
export declare function parseApartmentStoryResearch(raw: string): ApartmentStoryCandidate[];
