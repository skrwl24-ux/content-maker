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
export function buildWorkPdfRequest(topic?: {title?: string; category?: string; hook?: string; keyword?: string}): string;

export function suggestedExperimentQuestion(title?: string): string;
export function mismatchedExperimentQuestion(title?: string, question?: string): boolean;

export type ExperimentWorkflowRun = { response?: string; reviewed?: boolean; verdict?: string; highlight?: string; usedSamePdf?: boolean };
export type ExperimentWorkflowInput = {
  title?: string; testQuestion?: string; commonPrompt?: string; fixtureMode?: "pdf" | "text";
  pdfSha256?: string; pdfName?: string; pdfAvailable?: boolean; material?: string;
  groundTruth?: string; hiddenTwist?: string; sources?: string;
  runs?: Partial<Record<"chatgpt" | "claude" | "gemini", ExperimentWorkflowRun>>;
};
export function getExperimentWorkflowStatus(input?: ExperimentWorkflowInput): {
  mismatchedQuestion: boolean;
  noKeyLeak: boolean;
  fixtureReady: boolean;
  allAnswersCollected: boolean;
  keyReady: boolean;
  allScored: boolean;
};
