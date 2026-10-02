export type ApartmentQuality = {
  notes: string[];
  observedMonths: number;
  singleTradeMonths: string[];
  matchingPending: boolean;
  trendReady: boolean;
};
export function assessApartmentDataQuality(input?: {
  representativeArea?: number | null;
  sixMonthCount?: number | null;
  analysisDate?: string | null;
  monthly?: Array<{
    month?: string;
    year_month?: string;
    tradeCount?: number;
    trade_count?: number;
    medianPrice?: number | null;
    median_price?: number | null;
  }>;
}): ApartmentQuality;
