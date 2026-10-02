export type AuditMonth = { month: string; tradeCount: number; medianPrice: number | null };
export type StoredDeal = { contract_date: string; price_won: number | string; cancelled?: boolean | null };
export type SourceAudit = {
  status: "matched" | "mismatch" | "unavailable";
  comparedMonths: number;
  rawTradeCount: number;
  mismatches: string[];
  reason: string;
};
export type NumberCheck = {
  status: "pass" | "warning" | "review";
  label: string;
  detail: string;
};
export declare function reconcileMonthlyWithTrades(
  monthly: AuditMonth[],
  rawTrades: StoredDeal[] | null,
  options?: {truncated?: boolean}
): SourceAudit;
export declare function auditArticleFigures(input: {
  body?: string;
  monthly?: AuditMonth[];
  latestTradePrice?: number | null;
  sourceKind?: "db" | "input";
  sourceAudit?: SourceAudit | null;
}): NumberCheck[];
