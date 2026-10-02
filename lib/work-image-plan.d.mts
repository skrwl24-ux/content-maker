export type WorkImageKind = "thumbnail" | "table" | "chart" | "summary" | "flow";
export type WorkImagePlanItem = {
  slot: string;
  kind: WorkImageKind;
  label: string;
  role: string;
  heading: string;
  tableIndex: number | null;
  width: number;
  height: number;
};
export function makeWorkImagePlan(tables?: ReadonlyArray<{
  heading: string;
  isTimeSeries?: boolean;
}>): WorkImagePlanItem[];
