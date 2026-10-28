export type WorkplaceTop10Input = {
  place: string;
  region: string;
  neighborhoods: string;
  period: string;
  area: string;
  researchNotes: string;
  articleText: string;
};
export type WorkplaceTop10Slot = {readonly id:string;readonly title:string;readonly purpose:string;readonly kind:string};
export declare const WORKPLACE_TOP10_PRESETS: ReadonlyArray<{readonly place:string;readonly region:string;readonly neighborhoods:string}>;
export declare const WORKPLACE_TOP10_SLOTS: ReadonlyArray<WorkplaceTop10Slot>;
export declare function buildTop10Context(d: WorkplaceTop10Input): string;
export declare function buildTop10ResearchPrompt(d: WorkplaceTop10Input): string;
export declare function buildTop10ArticlePrompt(d: WorkplaceTop10Input): string;
export declare function buildTop10ImagePrompt(d: WorkplaceTop10Input,slot:WorkplaceTop10Slot): string;
