type SourceRow = { kaptName?: unknown; kaptAddr?: unknown; doroJuso?: unknown; hoCnt?: unknown; kaptUsedate?: unknown; bjdCode?: unknown; as3?: unknown };
type Previous = { name?: string | null; address?: string | null; road_address?: string | null; households?: number | null; use_date?: string | null; bjd_code?: string | null; legal_dong?: string | null };
export declare function mergeKaptApartmentDetail(row?: SourceRow, basic?: SourceRow | null, existing?: Previous | null): {
  name: string | null;
  address: string | null;
  road_address: string | null;
  households: number | null;
  use_date: string | null;
  bjd_code: string | null;
  legal_dong: string | null;
  detailsReceived: boolean;
};
