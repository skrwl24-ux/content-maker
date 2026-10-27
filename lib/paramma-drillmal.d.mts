export type DrillmalSettings = {
  enabled: boolean;
  voice: "light" | "balanced" | "strong";
  imageMode: "key" | "thumbnail" | "all";
  autoStamp: boolean;
  corner: "left" | "right";
};
export const DEFAULT_DRILLMAL_SETTINGS: Readonly<DrillmalSettings>;
export function normalizeDrillmalSettings(raw: unknown): DrillmalSettings;
export function drillmalImageApplies(settings: DrillmalSettings, slot: string): boolean;
export function drillmalArticleRules(settings: DrillmalSettings): string;
export function drillmalImageRules(settings: DrillmalSettings, slot: string): string;
