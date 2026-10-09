"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  DEFAULT_SETTINGS,
  ImageSlot,
  MODE_LABELS,
  RankingMode,
  Top3Discovery,
  Top3Research,
  Top3Settings,
  discoveryPrompt,
  finalPrompt,
  formatPrice,
  imagePrompt,
  parseDiscovery,
  parseResearch,
  rankTop3,
  researchPrompt,
  validationNotes,
} from "../../lib/real-estate-top3";
import {
  apartmentV1NaverPlainText,
  apartmentV1NaverRichHtml,
  parseApartmentV1Naver,
} from "../../lib/apartment-v1-naver";

const STORAGE_KEY = "real-estate-top3-studio-v1";
const IMAGE_SLOTS: Array<{ id: ImageSlot; label: string }> = [
  { id: "00", label: "TOP3 썸네일" },
  { id: "01", label: "TOP3 순위표" },
  { id: "02", label: "가격 변화 비교" },
  { id: "03", label: "거래 흐름 비교" },
  { id: "04", label: "이번 조사에서 발견한 점" },
];

const PRESETS: Array<{ label: string; patch: Partial<Top3Settings> }> = [
  { label: "6개월 상승률", patch: { title: "최근 6개월 가장 많이 오른 아파트 TOP3", period: "최근 6개월", rankingMode: "riseRate" } },
  { label: "거래량 많은 곳", patch: { title: "최근 거래가 가장 활발한 아파트 TOP3", period: "최근 3개월", rankingMode: "tradeCount" } },
  { label: "가격 많이 내린 곳", patch: { title: "최근 가장 많이 내려온 아파트 TOP3", period: "최근 6개월", rankingMode: "dropRate" } },
  { label: "상승액 큰 곳", patch: { title: "최근 가격이 가장 많이 뛴 아파트 TOP3", period: "최근 6개월", rankingMode: "riseAmount" } },
  { label: "10억 이하 거래량", patch: { title: "10억 이하에서 최근 거래가 가장 많은 아파트 TOP3", period: "최근 3개월", priceRule: "현재 대표가격 10억원 이하", rankingMode: "tradeCount" } },
  { label: "84㎡ 저가 TOP3", patch: { title: "전용 84㎡ 지금 가격이 낮은 아파트 TOP3", period: "최근 거래 기준", areaRule: "전용 84㎡ 전후", rankingMode: "currentPriceLow" } },
];

function openChat(prompt: string, setToast: (value: string) => void) {
  const encoded = encodeURIComponent(prompt);
  if (encoded.length > 7000) {
    void navigator.clipboard.writeText(prompt);
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    setToast("긴 요청서를 복사했습니다. 열린 ChatGPT에서 Ctrl+V 하세요.");
    return;
  }
  window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
}

function articleAudit(body: string, topNames: string[]) {
  const checks: Array<{ ok: boolean; label: string; detail: string }> = [];
  const forbidden = ["직접 다녀", "걸어봤", "현장에서 느", "주민에게 물어", "살아보니"];
  const usedForbidden = forbidden.filter((word) => body.includes(word));
  checks.push({
    ok: usedForbidden.length === 0,
    label: "가짜 현장 경험",
    detail: usedForbidden.length ? "금지 표현 확인: " + usedForbidden.join(", ") : "실제 방문을 가장하는 표현이 없습니다.",
  });
  const missingNames = topNames.filter((name) => name && !body.includes(name));
  checks.push({
    ok: missingNames.length === 0,
    label: "TOP3 단지",
    detail: missingNames.length ? "원고에 빠진 단지: " + missingNames.join(", ") : "TOP3 단지명이 모두 확인됩니다.",
  });
  const missingRanks = ["3위", "2위", "1위"].filter((rank) => !body.includes(rank));
  checks.push({
    ok: missingRanks.length === 0,
    label: "순위 구조",
    detail: missingRanks.length ? "빠진 순위: " + missingRanks.join(", ") : "3위 → 2위 → 1위 구조가 확인됩니다.",
  });
  const missingImages = IMAGE_SLOTS.filter((slot) => !body.includes("이미지 " + slot.id)).map((slot) => slot.id);
  checks.push({
    ok: missingImages.length === 0,
    label: "이미지 위치",
    detail: missingImages.length ? "빠진 이미지 위치: " + missingImages.join(", ") : "이미지 00~04 위치가 모두 있습니다.",
  });
  return checks;
}

export default function RealEstateTipsPage() {
  const [settings, setSettings] = useState<Top3Settings>(DEFAULT_SETTINGS);
  const [researchRaw, setResearchRaw] = useState("");
  const [research, setResearch] = useState<Top3Research | null>(null);
  const [researchErrors, setResearchErrors] = useState<string[]>([]);
  const [discoveryRaw, setDiscoveryRaw] = useState("");
  const [discovery, setDiscovery] = useState<Top3Discovery | null>(null);
  const [finalRaw, setFinalRaw] = useState("");
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.settings) setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
        if (typeof saved.researchRaw === "string") setResearchRaw(saved.researchRaw);
        if (saved.research) setResearch(saved.research);
        if (Array.isArray(saved.researchErrors)) setResearchErrors(saved.researchErrors);
        if (typeof saved.discoveryRaw === "string") setDiscoveryRaw(saved.discoveryRaw);
        if (saved.discovery) setDiscovery(saved.discovery);
        if (typeof saved.finalRaw === "string") setFinalRaw(saved.finalRaw);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          settings, researchRaw, research, researchErrors, discoveryRaw, discovery, finalRaw,
        }));
      } catch {}
    }, 450);
    return () => window.clearTimeout(timer);
  }, [loaded, settings, researchRaw, research, researchErrors, discoveryRaw, discovery, finalRaw]);

  const top3 = useMemo(
    () => research ? rankTop3(research.candidates, settings.rankingMode) : [],
    [research, settings.rankingMode],
  );
  const validation = useMemo(
    () => research ? validationNotes(research.candidates, settings.rankingMode) : [],
    [research, settings.rankingMode],
  );
  const researchRequest = useMemo(() => researchPrompt(settings), [settings]);
  const discoveryRequest = useMemo(
    () => research && top3.length === 3 ? discoveryPrompt(settings, top3, research) : "",
    [settings, top3, research],
  );
  const finalRequest = useMemo(
    () => research && top3.length === 3 ? finalPrompt(settings, research, top3, discovery) : "",
    [settings, research, top3, discovery],
  );
  const audit = useMemo(() => articleAudit(finalRaw, top3.map((item) => item.name)), [finalRaw, top3]);
  const naverBlocks = useMemo(() => parseApartmentV1Naver(finalRaw), [finalRaw]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(label + " 복사 완료");
    } catch {
      notify("복사 실패 · 브라우저 클립보드 권한을 확인하세요.");
    }
  }

  function applyResearch() {
    const result = parseResearch(researchRaw);
    setResearchErrors(result.errors);
    if (!result.data) {
      setResearch(null);
      notify("조사 결과 형식을 확인해 주세요.");
      return;
    }
    setResearch(result.data);
    setDiscovery(null);
    setDiscoveryRaw("");
    notify(result.errors.length ? "자료를 불러왔지만 확인할 항목이 있습니다." : "후보 자료 저장 완료 · TOP3를 자동 계산했습니다.");
  }

  function applyDiscovery() {
    const parsed = parseDiscovery(discoveryRaw);
    if (!parsed) {
      notify("발견 메모 JSON 형식을 확인해 주세요.");
      return;
    }
    const names = new Set(top3.map((item) => item.name));
    const bad = parsed.items.filter((item) => item.name && !names.has(item.name));
    if (bad.length) {
      notify("TOP3와 다른 단지명이 발견 메모에 섞여 있습니다.");
      return;
    }
    setDiscovery(parsed);
    notify("발견 메모 저장 완료");
  }

  function resetAll() {
    if (!window.confirm("현재 TOP3 작업을 모두 초기화할까요?")) return;
    setSettings(DEFAULT_SETTINGS);
    setResearchRaw("");
    setResearch(null);
    setResearchErrors([]);
    setDiscoveryRaw("");
    setDiscovery(null);
    setFinalRaw("");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  async function copyNaverRich() {
    if (!finalRaw.trim()) {
      notify("최종 글을 먼저 붙여넣어 주세요.");
      return;
    }
    const plain = apartmentV1NaverPlainText(naverBlocks);
    const html = apartmentV1NaverRichHtml(naverBlocks);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        notify("네이버 서식 포함 복사 완료");
      } else {
        await navigator.clipboard.writeText(plain);
        notify("일반 텍스트로 복사했습니다.");
      }
    } catch {
      notify("복사 실패 · 일반 복사를 이용해 주세요.");
    }
  }

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <Link href="/">← 콘텐츠 메이커</Link>
      <div><span>부동산 꿀팁</span><b>TOP3 V1</b></div>
    </header>

    <section className={styles.hero}>
      <div>
        <span>REAL ESTATE TIPS · TOP3</span>
        <h1>TOP3는 그대로,<br/>자료를 직접 살펴본 글맛을 더합니다.</h1>
        <p>후보는 웹에서 같은 기준으로 조사하고, 순위는 사이트가 계산합니다. 최종 글에는 실제 자료를 대조하며 발견한 점만 짧게 넣어 조회수 잘 나오는 TOP3 흐름을 유지합니다.</p>
      </div>
      <div className={styles.heroRule}><b>순위는 숫자로</b><span>경험은 조사 과정만</span></div>
    </section>

    {toast && <div className={styles.toast}>{toast}</div>}

    <nav className={styles.steps}>
      <span className={settings.region.trim() ? styles.done : ""}>1 · 주제</span>
      <span className={research ? styles.done : ""}>2 · 후보 조사</span>
      <span className={top3.length === 3 ? styles.done : ""}>3 · TOP3</span>
      <span className={discovery ? styles.done : ""}>4 · 발견 메모</span>
      <span className={top3.length === 3 ? styles.done : ""}>5 · 이미지</span>
      <span className={finalRaw.trim() ? styles.done : ""}>6 · 최종 글</span>
    </nav>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 01</span><h2>TOP3 주제 설정</h2><p>지역·기간·평형·가격 조건을 먼저 고정합니다. 이 기준은 후보 전체에 똑같이 적용됩니다.</p></div>
        <button className={styles.reset} onClick={resetAll}>전체 초기화</button>
      </div>

      <div className={styles.presets}>
        {PRESETS.map((preset) => <button key={preset.label} onClick={() => setSettings((current) => ({ ...current, ...preset.patch }))}>{preset.label}</button>)}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.wide}><span>고정 제목</span><input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} /></label>
        <label><span>지역</span><input value={settings.region} onChange={(e) => setSettings({ ...settings, region: e.target.value })} placeholder="예: 성남시 분당구" /></label>
        <label><span>비교 기간</span><input value={settings.period} onChange={(e) => setSettings({ ...settings, period: e.target.value })} /></label>
        <label><span>평형 기준</span><input value={settings.areaRule} onChange={(e) => setSettings({ ...settings, areaRule: e.target.value })} /></label>
        <label><span>가격 조건</span><input value={settings.priceRule} onChange={(e) => setSettings({ ...settings, priceRule: e.target.value })} /></label>
        <label><span>순위 기준</span>
          <select value={settings.rankingMode} onChange={(e) => setSettings({ ...settings, rankingMode: e.target.value as RankingMode })}>
            {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label><span>후보 수</span><input type="number" min="3" max="12" value={settings.candidateCount} onChange={(e) => setSettings({ ...settings, candidateCount: Math.max(3, Math.min(12, Number(e.target.value) || 8)) })} /></label>
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 02</span><h2>후보 {settings.candidateCount}개 조사</h2><p>GPT가 웹에서 후보를 찾고 동일 기준으로 숫자를 맞춥니다. 결과 JSON을 그대로 붙여넣으면 됩니다.</p></div>
        <div className={styles.actions}>
          <button onClick={() => void copy(researchRequest, "후보 조사 요청서")}>요청서 복사</button>
          <button className={styles.primary} onClick={() => openChat(researchRequest, notify)} disabled={!settings.region.trim()}>GPT에서 조사 →</button>
        </div>
      </div>

      <textarea className={styles.rawBox} value={researchRaw} onChange={(e) => setResearchRaw(e.target.value)} placeholder="GPT가 준 후보 조사 JSON을 여기에 붙여넣으세요." />
      <div className={styles.applyRow}>
        <button className={styles.primary} onClick={applyResearch}>조사 결과 적용 · TOP3 계산</button>
        {research && <span>{research.candidates.length}개 후보 저장 · 확인일 {research.checkedAt || "미입력"}</span>}
      </div>
      {!!researchErrors.length && <div className={styles.warningBox}>{researchErrors.map((item) => <p key={item}>⚠ {item}</p>)}</div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 03</span><h2>사이트가 계산한 TOP3</h2><p>GPT가 순위를 다시 판단하지 않습니다. 저장된 숫자와 선택한 기준만으로 1·2·3위를 정합니다.</p></div>
        <b className={styles.modeBadge}>{MODE_LABELS[settings.rankingMode]}</b>
      </div>

      {top3.length < 3 ? <div className={styles.empty}>후보 자료를 적용하면 TOP3가 여기에 자동으로 나옵니다.</div> :
        <div className={styles.rankGrid}>
          {top3.map((item, index) => <article key={item.name} className={index === 0 ? styles.first : ""}>
            <span className={styles.rankNo}>{index + 1}위</span>
            <h3>{item.name}</h3>
            <p>{item.location} · {item.exclusiveArea === null ? "면적 확인 필요" : "전용 " + item.exclusiveArea + "㎡"}</p>
            <div className={styles.numbers}>
              <div><span>현재</span><b>{formatPrice(item.currentPrice)}</b></div>
              <div><span>비교</span><b>{formatPrice(item.comparePrice)}</b></div>
              <div><span>변동률</span><b>{item.changeRate === null ? "—" : item.changeRate.toFixed(2) + "%"}</b></div>
              <div><span>거래</span><b>{item.tradeCount === null ? "—" : item.tradeCount + "건"}</b></div>
            </div>
            {item.tradeCount !== null && item.tradeCount <= 1 && <em>표본 주의 · 거래 {item.tradeCount}건</em>}
          </article>)}
        </div>
      }
      {!!validation.length && <div className={styles.warningBox}>{validation.map((item) => <p key={item}>체크 · {item}</p>)}</div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 04</span><h2>발견 포인트 · 에디터 노트</h2><p>TOP3 순위는 건드리지 않고, 자료를 펼쳐보며 눈에 띈 점과 주의점을 단지별 1~2문장만 찾습니다.</p></div>
        <div className={styles.actions}>
          <button disabled={!discoveryRequest} onClick={() => void copy(discoveryRequest, "발견 메모 요청서")}>요청서 복사</button>
          <button className={styles.primary} disabled={!discoveryRequest} onClick={() => openChat(discoveryRequest, notify)}>GPT에서 발견 찾기 →</button>
        </div>
      </div>

      <div className={styles.experienceRule}>
        <div><b>사용 가능</b><span>자료를 펼쳐보니 · 거래를 하나씩 대조해보니 · 같은 기준으로 놓고 보니</span></div>
        <div><b>사용 금지</b><span>직접 다녀왔다 · 걸어봤다 · 주민에게 물어봤다 · 살아보니</span></div>
      </div>

      <textarea className={styles.rawBox} value={discoveryRaw} onChange={(e) => setDiscoveryRaw(e.target.value)} placeholder="GPT가 준 발견 메모 JSON을 붙여넣으세요." />
      <div className={styles.applyRow}>
        <button className={styles.primary} disabled={!discoveryRaw.trim()} onClick={applyDiscovery}>발견 메모 적용</button>
        {discovery && <span>핵심 발견 · {discovery.biggestDiscovery || discovery.headline}</span>}
      </div>

      {discovery && <div className={styles.discoveryGrid}>
        {top3.map((candidate, index) => {
          const note = discovery.items.find((item) => item.name === candidate.name || item.rank === index + 1);
          return <article key={candidate.name}>
            <b>{index + 1}위 · {candidate.name}</b>
            <p><strong>눈에 띈 점</strong> {note?.noticedPoint || "—"}</p>
            <p><strong>주의</strong> {note?.caution || "—"}</p>
            {note?.lifestyleObservation && <p><strong>생활권 한 줄</strong> {note.lifestyleObservation}</p>}
          </article>;
        })}
      </div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 05</span><h2>TOP3 전용 이미지 5장</h2><p>썸네일은 1254×1254, 본문 이미지는 1600×900. 저장된 순위와 숫자만 사용합니다.</p></div>
      </div>

      <div className={styles.imageGrid}>
        {IMAGE_SLOTS.map((slot) => {
          const prompt = top3.length === 3 ? imagePrompt(slot.id, settings, top3, discovery) : "";
          return <article key={slot.id}>
            <div><span>{slot.id}</span><b>{slot.label}</b></div>
            <small>{slot.id === "00" ? "1254×1254" : "1600×900"}</small>
            <div className={styles.actions}>
              <button disabled={!prompt} onClick={() => void copy(prompt, slot.id + " 이미지 요청서")}>복사</button>
              <button className={styles.primary} disabled={!prompt} onClick={() => openChat(prompt, notify)}>GPT 열기</button>
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><span>STEP 06</span><h2>최종 TOP3 글</h2><p>3위 → 2위 → 1위의 기존 조회수형 구조를 유지하면서, 조사 과정에서 확인한 관찰만 자연스럽게 녹입니다.</p></div>
        <div className={styles.actions}>
          <button disabled={!finalRequest} onClick={() => void copy(finalRequest, "최종 글 요청서")}>요청서 복사</button>
          <button className={styles.primary} disabled={!finalRequest} onClick={() => openChat(finalRequest, notify)}>GPT에서 최종 글 →</button>
        </div>
      </div>

      <textarea className={styles.finalBox} value={finalRaw} onChange={(e) => setFinalRaw(e.target.value)} placeholder="ChatGPT가 만든 최종 글을 그대로 붙여넣으세요." />

      <div className={styles.finalActions}>
        <button onClick={() => void copy(finalRaw, "최종 글")} disabled={!finalRaw.trim()}>일반 복사</button>
        <button className={styles.primary} onClick={() => void copyNaverRich()} disabled={!finalRaw.trim()}>네이버 서식 복사</button>
      </div>

      {!!finalRaw.trim() && <div className={styles.auditGrid}>
        {audit.map((item) => <div key={item.label} className={item.ok ? styles.auditOk : styles.auditWarn}>
          <b>{item.ok ? "✓ " : "⚠ "}{item.label}</b><span>{item.detail}</span>
        </div>)}
      </div>}
    </section>

    <footer className={styles.footer}>
      <span>자동 저장 · 브라우저 로컬</span>
      <span>TOP3 숫자는 사이트 계산 · 경험담은 실제 조사 과정만</span>
    </footer>
  </main>;
}
