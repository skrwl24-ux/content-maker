export type ParammaV4SlotId = "00"|"01"|"02"|"03"|"04"|"05"|"06"|"07";
export type ParammaV4Topic = { category: string; title: string; thumbnailHook: string; brief: string };
export const PARAMMA_V4_SLOTS: Array<{ id: ParammaV4SlotId; role: string; scene: string }>;
export function parammaV4Count(value: unknown): 6 | 7 | 8;
export function parammaActiveSlots(version: string | undefined, imageCount: unknown, optional03?: boolean): ParammaV4SlotId[];
export function parammaV4MissingMarkers(raw: string, imageCount: unknown): ParammaV4SlotId[];
export function buildParammaV4ArticlePrompt(topic: ParammaV4Topic, imageCount: unknown, date: string): string;
export function buildParammaV4ImagePrompt(topic: ParammaV4Topic, slot: ParammaV4SlotId, plan?: string): string;
