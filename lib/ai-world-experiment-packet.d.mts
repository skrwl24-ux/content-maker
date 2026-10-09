export type ExperimentPacket = {
  version: string;
  title: string;
  testQuestion: string;
  material: string;
  hiddenTwist: string;
  groundTruth: string;
  sources: string;
  sourceStatus: "verified" | "needs_verification";
};
export const PACKET_VERSION: string;
export const FAKE_COUNTRY_TITLE: string;
export const FAKE_COUNTRY_PACKET: Readonly<ExperimentPacket>;
export function buildPacketRequest(topic?: {title?: string; category?: string; hook?: string; keyword?: string}): string;
export function parseExperimentPacket(raw: string): {packet: ExperimentPacket | null; error: string};
export function buildBlindPrompt(input?: {testQuestion?: string; material?: string}): string;
export function canLockExperiment(input?: {testQuestion?: string; material?: string; groundTruth?: string; sources?: string; sourceVerified?: boolean}): boolean;
