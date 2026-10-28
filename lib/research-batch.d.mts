export declare const RESEARCH_BATCH_SIZE: number;
export declare function parseResearchBatchTopics(input: string): { topics: string[]; error: string };
export declare function researchSlotKey(slot: number): string;
export declare function emptyResearchSlot(topic?: string, channel?: string): {
  version: number; channel: string; topic: string; notes: string;
  raw: string; selectedAngleId: string; approvedKeys: string[];
  finalRaw: string; finalTitle: string; finalBody: string;
};
