// Browser-only PDF fixture storage. Keep binaries in IndexedDB, never in localStorage.
// A SHA-256 is recorded to help an operator distribute the identical bytes to each model.
const DB_NAME = "ai-world-experiment-files-v1";
const STORE = "fixtures";
function database() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("이 브라우저는 파일 저장소를 지원하지 않습니다."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "sha256" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("파일 저장소를 열 수 없습니다."));
  });
}
async function operation(mode, fn) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("PDF 읽기/저장 실패"));
      tx.onerror = () => reject(tx.error || new Error("PDF 저장소 오류"));
    });
  } finally { db.close(); }
}
export async function storeExperimentPdf(file) {
  if (!file || !/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
    throw new Error("PDF 파일만 등록할 수 있습니다.");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF 파일은 20MB 이하만 등록할 수 있습니다.");
  if (file.size < 8) throw new Error("빈 파일은 등록할 수 없습니다.");
  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes.slice(0,5));
  if (String.fromCharCode(...head) !== "%PDF-") throw new Error("유효한 PDF 헤더가 아닙니다.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const sha256 = Array.from(digest).map(n => n.toString(16).padStart(2,"0")).join("");
  const meta = { name: file.name, bytes: file.size, sha256, storedAt: new Date().toISOString() };
  await operation("readwrite", store => store.put({ ...meta, blob: new Blob([bytes], { type: "application/pdf" }) }));
  return meta;
}
export async function getExperimentPdf(sha256) {
  const entry = await operation("readonly", store => store.get(sha256));
  return entry && entry.blob instanceof Blob ? entry.blob : null;
}
