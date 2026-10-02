export type ApartmentMatchingComplex = {
  id: string;
  name: string;
  normalized_name?: string | null;
  region_code: string;
  legal_dong: string | null;
  address: string | null;
  use_date: string | null;
};
export type ApartmentMatchingTrade = {
  name: string;
  regionCode: string;
  legalDong: string | null;
  jibun: string | null;
  buildYear?: number | null;
};
export declare function normalizeApartmentName(name: string): string;
export declare function normalizeCadastralLot(value: string | null | undefined): string | null;
export declare function extractApartmentLot(address: string | null | undefined, legalDong: string | null | undefined): string | null;
export declare function matchApartmentTrade<T extends ApartmentMatchingComplex>(trade: ApartmentMatchingTrade, complexes: T[]): T | null;
