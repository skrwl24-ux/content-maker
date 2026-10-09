export type PdfMeta = { name: string; bytes: number; sha256: string; storedAt: string };
export function storeExperimentPdf(file: File): Promise<PdfMeta>;
export function getExperimentPdf(sha256: string): Promise<Blob | null>;

export type HumanPhotoMeta = PdfMeta & {mimeType: "image/jpeg" | "image/png" | "image/webp"};
export function humanPhotoMimeType(filename: string, bytes: Uint8Array): string;
export function storeHumanPhoto(file: File): Promise<HumanPhotoMeta>;
export function getHumanPhoto(sha256: string): Promise<Blob | null>;
export function deleteHumanPhoto(sha256: string): Promise<void>;
