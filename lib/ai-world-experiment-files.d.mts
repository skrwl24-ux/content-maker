export type PdfMeta = { name: string; bytes: number; sha256: string; storedAt: string };
export function storeExperimentPdf(file: File): Promise<PdfMeta>;
export function getExperimentPdf(sha256: string): Promise<Blob | null>;
