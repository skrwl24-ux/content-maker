export type ParammaImageSlotId = "00" | "01" | "02" | "03";
export function extractParammaImagePlans(raw: string): Partial<Record<ParammaImageSlotId, string>>;
