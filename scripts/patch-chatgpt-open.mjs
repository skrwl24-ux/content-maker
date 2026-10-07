import fs from "node:fs";

const path = "app/apartment-v1/page.tsx";
let s = fs.readFileSync(path, "utf8");
const start = s.indexOf("  const openInChatGPT = useCallback((prompt: string) => {");
const end = s.indexOf("\n\n  const rankingMap", start);
if (start < 0 || end < 0) throw new Error("openInChatGPT block not found");

const next = `  const openInChatGPT = useCallback((prompt: string) => {
    const encoded = encodeURIComponent(prompt);

    if (encoded.length > 7000) {
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      navigator.clipboard.writeText(prompt).then(() => {
        setToast("긴 요청서 복사 완료 · 열린 ChatGPT에서 Ctrl+V");
        window.setTimeout(() => setToast(""), 2400);
      }).catch(() => setError("ChatGPT는 열었지만 요청서 복사에 실패했습니다. 복사 버튼을 이용해주세요."));
      return;
    }

    window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
  }, []);`;

s = s.slice(0, start) + next + s.slice(end);
fs.writeFileSync(path, s);
