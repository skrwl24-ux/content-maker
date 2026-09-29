"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Status = "예정" | "작성 중" | "발행 완료";
type ScheduleRow = {
  id: string;
  date: string;
  title: string;
  keyword: string;
  status: Status;
  url: string;
  note: string;
  body?: string;
};

type BloggerOutput = {
  title: string;
  description: string;
  slug: string;
  labels: string;
  html: string;
};

const IMAGE_SLOTS = [
  { id: "00", label: "대표 이미지", role: "글의 핵심 제품·국가·가격 주제를 한눈에 보여주는 대표 비주얼" },
  { id: "01", label: "가격 요약", role: "현재 확인된 가격과 통화, 기준 시점을 간결하게 보여주는 정보 이미지" },
  { id: "02", label: "웹 vs 앱", role: "웹 결제와 앱스토어 결제 차이를 비교하는 설명 이미지" },
  { id: "03", label: "결제 방법", role: "지원되는 결제수단·결제 흐름을 쉽게 보여주는 설명 이미지" },
  { id: "04", label: "국가·지역 맥락", role: "해당 국가의 통화·세금·지역 가격 맥락을 보여주는 이미지" },
  { id: "05", label: "핵심 정리", role: "독자가 마지막에 기억할 핵심 3~4가지를 정리하는 요약 이미지" },
] as const;

const STORAGE_KEY = "content-maker-google-blog-schedule-v1";

const DEFAULT_ROWS: ScheduleRow[] = [
  { id: "2026-09-29-1", date: "2026-09-29", title: "Claude Pro Price in South Korea 2026", keyword: "Claude Pro Korea price", status: "예정", url: "", note: "한국 가격 · 웹/앱 결제 차이" },
  { id: "2026-09-30-1", date: "2026-09-30", title: "Gemini AI Subscription Price in South Korea 2026", keyword: "Gemini Korea price", status: "예정", url: "", note: "한국 구독 가격 · 결제 방식" },
  { id: "2026-10-01-1", date: "2026-10-01", title: "ChatGPT Plus Price in Taiwan 2026", keyword: "ChatGPT Plus Taiwan price", status: "예정", url: "", note: "현지 통화 · 웹/앱 비교" },
  { id: "2026-10-02-1", date: "2026-10-02", title: "ChatGPT Plus Price in Singapore 2026", keyword: "ChatGPT Plus Singapore price", status: "예정", url: "", note: "SGD 표시 · 세금 확인" },
  { id: "2026-10-03-1", date: "2026-10-03", title: "ChatGPT Plus Price in Hong Kong 2026", keyword: "ChatGPT Plus Hong Kong price", status: "예정", url: "", note: "HKD 표시 · 결제수단 확인" },
  { id: "2026-10-04-1", date: "2026-10-04", title: "ChatGPT Plus Price in India 2026", keyword: "ChatGPT Plus India price", status: "예정", url: "", note: "현지 가격 · 앱스토어 차이" },
  { id: "2026-10-05-1", date: "2026-10-05", title: "ChatGPT Plus Price in Australia 2026", keyword: "ChatGPT Plus Australia price", status: "예정", url: "", note: "AUD 가격 · 세금 포함 여부" },
  { id: "2026-10-06-1", date: "2026-10-06", title: "ChatGPT Plus Price in Canada 2026", keyword: "ChatGPT Plus Canada price", status: "예정", url: "", note: "CAD 가격 · 지역별 세금 주의" },
  { id: "2026-10-07-1", date: "2026-10-07", title: "ChatGPT Plus Price in the UK 2026", keyword: "ChatGPT Plus UK price", status: "예정", url: "", note: "GBP 가격 · VAT 확인" },
  { id: "2026-10-08-1", date: "2026-10-08", title: "ChatGPT Plus Price in Germany 2026", keyword: "ChatGPT Plus Germany price", status: "예정", url: "", note: "EUR 가격 · VAT 확인" },
  { id: "2026-10-09-1", date: "2026-10-09", title: "Claude Pro Price in Japan 2026", keyword: "Claude Pro Japan price", status: "예정", url: "", note: "JPY 가격 · 웹/앱 비교" },
  { id: "2026-10-10-1", date: "2026-10-10", title: "Gemini AI Subscription Price in Japan 2026", keyword: "Gemini Japan price", status: "예정", url: "", note: "일본 가격 · Google 결제 확인" },
  { id: "2026-10-11-1", date: "2026-10-11", title: "Cheapest Countries for AI Subscriptions in 2026", keyword: "cheapest AI subscription countries", status: "예정", url: "", note: "국가별 비교형 파워글" },
  { id: "2026-10-12-1", date: "2026-10-12", title: "ChatGPT Plus Web vs App Store Price Difference 2026", keyword: "ChatGPT web vs app price", status: "예정", url: "", note: "웹 · iOS · Android 결제 비교" },
];

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDate(value: string) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(value: string) {
  const d = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }).format(d);
}


function buildArticlePrompt(row: ScheduleRow) {
  return `AI Price Atlas용 구글 Blogger 영문 글을 최종 발행본으로 작성해줘.

[작성 기준일]
${row.date}

[블로그]
AI Price Atlas
https://aipriceatlas.blogspot.com/

[이번 글]
예정 제목: ${row.title || "주제 미입력"}
핵심 SEO 키워드: ${row.keyword || "키워드 미입력"}
기획 메모: ${row.note || "없음"}

[가장 중요한 작업 방식]
- 반드시 웹 검색으로 작성 시점의 최신 가격, 세금, 결제수단, 웹 결제와 iOS/Android 앱 결제 차이를 확인한 뒤 작성할 것.
- OpenAI, Anthropic, Google 등 서비스 제공사의 공식 가격·도움말·앱스토어 정보를 우선 확인할 것.
- 가격은 통화와 과세 포함 여부, 월간/연간 여부를 명확히 구분할 것.
- 지역별 가격이 공식적으로 확인되지 않으면 추정 환율 가격을 실제 현지 가격처럼 쓰지 말 것.
- 웹 가격과 앱스토어 가격이 다를 수 있으면 별도로 구분할 것.
- 2026년 정보와 과거 가격을 섞지 말 것.
- 확인되지 않은 할인, 프로모션, 결제수단을 만들지 말 것.
- 검색 결과 문장을 복사하지 말고 자연스러운 영어로 재구성할 것.

[SEO 목표]
- 영어 검색 사용자가 "제품명 + country + price + 2026"을 검색했을 때 바로 답을 얻을 수 있게 작성.
- 제목은 예정 제목의 검색 의도를 유지하면서 더 자연스러운 SEO 제목으로 다듬을 수 있음.
- 첫 100단어 안에 핵심 가격과 가장 중요한 결제 차이를 먼저 제시.
- 과도한 키워드 반복 금지.
- 독자가 궁금해할 "How much?", "Web vs app?", "Taxes?", "How to pay?", "Is it worth checking the app price?"를 자연스럽게 해결.
- 사실 확인이 안 된 내용은 단정하지 말 것.

[본문 구조]
- 별도의 H1은 만들지 말 것. Blogger의 글 제목이 H1 역할을 함.
- 짧은 도입 2~3문단
- Key price snapshot
- Web vs iOS/Android app price
- Taxes and billing notes
- Payment methods
- Step-by-step purchase/checking guide
- FAQ 4~6개
- Final takeaway
- 필요하면 비교표 1개 사용
- 문단은 짧고 모바일에서 읽기 쉽게 작성

[이미지 위치]
본문 HTML 안에 아래 위치 문구를 각각 한 줄로 정확히 넣어줘.
[IMAGE 00 — Hero]
[IMAGE 01 — Price snapshot]
[IMAGE 02 — Web vs app]
[IMAGE 03 — Payment methods]
[IMAGE 04 — Country context]
[IMAGE 05 — Key takeaways]

[내부 링크]
관련성이 있을 때 아래 기존 글을 자연스럽게 1~2개만 연결해줘.
- ChatGPT Plus Price in South Korea 2026: https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-south-korea-2026.html
- ChatGPT Plus Price in Japan 2026: https://aipriceatlas.blogspot.com/2026/09/chatgpt-plus-price-in-japan-2026-3000.html
관련성이 낮으면 억지로 넣지 말 것.

[Blogger HTML 규칙]
- 본문은 Blogger HTML 보기에서 바로 붙여넣을 수 있는 깨끗한 HTML로 작성.
- <html>, <head>, <body>, <style>, <script> 태그 금지.
- h2, h3, p, strong, em, ul, ol, li, table, thead, tbody, tr, th, td, a, br 정도의 단순한 태그만 사용.
- 마크다운 문법을 HTML 안에 섞지 말 것.
- 표에는 width 고정값이나 복잡한 CSS를 넣지 말 것.
- 외부 광고 스크립트나 임베드 코드를 넣지 말 것.
- URL은 실제 내부링크 외에는 본문에 길게 노출하지 말 것.

[최종 출력 형식 — 매우 중요]
아래 마커를 정확히 사용하고, 마커 사이 내용만 출력할 것.
코드블록은 사용하지 말 것.

[FINAL_TITLE]
영문 최종 제목 1개

[META_DESCRIPTION]
검색 설명용 영문 140~155자 1개

[SLUG]
영문 소문자 하이픈 슬러그만

[LABELS]
쉼표로 구분한 Blogger 라벨 4~7개

[BLOGGER_HTML]
Blogger에 바로 넣을 최종 HTML 본문
[/BLOGGER_HTML]

출력 전에 가격·통화·세금·날짜를 다시 자가검수하고, 확인되지 않은 숫자를 만들지 마.`;
}

function buildImagePrompt(row: ScheduleRow, slot: typeof IMAGE_SLOTS[number]) {
  return `AI Price Atlas 구글 블로그용 이미지를 1장 만들어줘.

[글 정보]
글 제목: ${row.title || "제목 미입력"}
핵심 키워드: ${row.keyword || "키워드 미입력"}
기획 메모: ${row.note || "없음"}

[이미지 역할]
슬롯: ${slot.id} · ${slot.label}
역할: ${slot.role}

[제작 목표]
- 정확한 비율: 16:9 가로형
- 권장 크기: 1600×900px
- 구글 Blogger 본문용 단일 이미지 1장
- 영어권 독자가 모바일에서도 바로 이해할 수 있는 깔끔한 편집형 디자인
- AI Price Atlas라는 가격 비교·구독 정보 블로그에 어울리는 신뢰감 있는 톤
- 과도한 네온, 유리질감, 미래형 AI 클리셰, 복잡한 3D 효과 금지
- 카드와 색상은 2~3개 중심으로 절제
- 작은 글자를 빽빽하게 넣지 말 것

[사실 검증]
- 이미지에 가격·통화·세금·결제수단 같은 구체적인 숫자나 사실을 넣기 전에는 반드시 최신 웹 자료로 확인할 것.
- 확인되지 않은 가격을 임의로 만들지 말 것.
- 웹 결제와 앱 결제 가격이 다르면 하나의 가격처럼 합치지 말 것.
- 진행 중인 프로모션이나 지역별 가격을 추정하지 말 것.

[텍스트]
- 영어만 사용.
- 핵심 문구는 짧게.
- ${slot.id === "00" ? "대표 이미지이므로 제목 전체를 반복하지 말고 제품명·국가·핵심 가격 포인트가 1초 안에 보이게 구성." : "본문 설명 이미지이므로 큰 광고성 헤드라인보다 비교·과정·요약이 중심이 되게 구성."}
- 한글, 워터마크, 타사 편집툴 로고 금지.

중요: 여러 장 합본이 아니라 슬롯 ${slot.id}에 사용할 이미지 한 장만 바로 생성해줘.`;
}

function parseSection(raw: string, name: string) {
  const pattern = new RegExp("\\[" + name + "\\]\\s*([\\s\\S]*?)(?=\\n\\[[A-Z_]+\\]|$)", "i");
  return raw.match(pattern)?.[1]?.trim() || "";
}

function parseBloggerOutput(raw: string): BloggerOutput {
  const htmlMatch = raw.match(/\[BLOGGER_HTML\]\s*([\s\S]*?)\s*\[\/BLOGGER_HTML\]/i);
  return {
    title: parseSection(raw, "FINAL_TITLE"),
    description: parseSection(raw, "META_DESCRIPTION"),
    slug: parseSection(raw, "SLUG"),
    labels: parseSection(raw, "LABELS"),
    html: (htmlMatch?.[1] || "").replace(/^```html\s*/i, "").replace(/```$/i, "").trim(),
  };
}

function htmlToPlain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/h2>|<\/h3>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function GoogleBlogSchedulePage() {
  const [rows, setRows] = useState<ScheduleRow[]>(DEFAULT_ROWS);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(DEFAULT_ROWS[0].id);
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const today = todayLocal();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setRows(parsed);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows, loaded]);

  const counts = useMemo(() => ({
    total: rows.length,
    planned: rows.filter(r => r.status === "예정").length,
    writing: rows.filter(r => r.status === "작성 중").length,
    done: rows.filter(r => r.status === "발행 완료").length,
  }), [rows]);
  const selected = rows.find(row => row.id === selectedId) || rows[0];
  const articlePrompt = selected ? buildArticlePrompt(selected) : "";
  const articleChatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(articlePrompt);
  const bloggerOutput = useMemo(() => parseBloggerOutput(selected?.body || ""), [selected?.body]);

  function updateRow(id: string, patch: Partial<ScheduleRow>) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
  }

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
      return true;
    } catch {
      setNotice("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
      return false;
    }
  }

  function startWork() {
    if (!selected) return;
    updateRow(selected.id, { status: selected.status === "발행 완료" ? "발행 완료" : "작성 중" });
  }

  async function copyBloggerRich() {
    if (!bloggerOutput.html) {
      setCopyMessage("ChatGPT 완성본을 먼저 붙여넣어 주세요.");
      return;
    }
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([bloggerOutput.html], { type: "text/html" }),
            "text/plain": new Blob([htmlToPlain(bloggerOutput.html)], { type: "text/plain" }),
          }),
        ]);
        setCopyMessage("✅ Blogger 서식 포함 전체복사 완료 · Blogger 작성 화면에서 Ctrl+V 하세요.");
      } else {
        await navigator.clipboard.writeText(bloggerOutput.html);
        setCopyMessage("HTML 코드로 복사했습니다. Blogger의 HTML 보기에서 붙여넣으세요.");
      }
    } catch {
      setCopyMessage("복사에 실패했습니다. HTML 코드 복사를 사용해주세요.");
    }
  }

  async function copyHtmlCode() {
    if (!bloggerOutput.html) {
      setCopyMessage("ChatGPT 완성본을 먼저 붙여넣어 주세요.");
      return;
    }
    await copyText(bloggerOutput.html, "✅ Blogger HTML 코드 복사 완료 · HTML 보기에서 붙여넣으세요.");
  }

  function addRow() {
    const lastDate = rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date : today;
    const date = nextDate(lastDate);
    setRows(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      title: "",
      keyword: "",
      status: "예정",
      url: "",
      note: "",
      body: "",
    }]);
    setSelectedId(prev => prev || rows[0]?.id || "");
  }

  function addWeek() {
    let date = rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date : today;
    const extra: ScheduleRow[] = [];
    for (let i = 0; i < 7; i++) {
      date = nextDate(date);
      extra.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        date,
        title: "",
        keyword: "",
        status: "예정",
        url: "",
        note: "",
        body: "",
      });
    }
    setRows(prev => [...prev, ...extra]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(row => row.id !== id));
    if (selectedId === id) {
      const next = rows.find(row => row.id !== id);
      if (next) setSelectedId(next.id);
    }
  }

  function resetRows() {
    if (!window.confirm("현재 스케줄을 지우고 기본 14일 스케줄로 되돌릴까요?")) return;
    setRows(DEFAULT_ROWS);
    setSelectedId(DEFAULT_ROWS[0].id);
    setNotice("");
    setCopyMessage("");
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => window.location.href = "/"}>← 콘텐츠 메이커</button>
        <div className={styles.saved}>자동 저장됨</div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Google Blog · AI Price Atlas</span>
          <h1>구글 블로그 글 스케줄</h1>
          <p>1일 1포스팅 기준으로 제목, 핵심 키워드, 진행 상태와 발행 링크를 한곳에서 관리합니다.</p>
        </div>
        <div className={styles.heroDate}>오늘 {dayLabel(today)}</div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.stats}>
        <div><span>전체</span><b>{counts.total}</b></div>
        <div><span>예정</span><b>{counts.planned}</b></div>
        <div><span>작성 중</span><b>{counts.writing}</b></div>
        <div><span>발행 완료</span><b>{counts.done}</b></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>발행 일정표</h2>
            <p>기본안은 2026년 9월 29일부터 14일치입니다. 셀을 클릭해 바로 수정할 수 있습니다.</p>
          </div>
          <div className={styles.actions}>
            <button onClick={addRow}>+ 하루 추가</button>
            <button onClick={addWeek}>+ 7일 추가</button>
            <button className={styles.reset} onClick={resetRows}>기본안 복원</button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>상태</th>
                <th>글 제목</th>
                <th>핵심 키워드</th>
                <th>발행 링크</th>
                <th>메모</th>
                <th>작업</th>
                <th aria-label="삭제"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isToday = row.date === today;
                return (
                  <tr key={row.id} className={`${isToday ? styles.todayRow : ""} ${row.id === selectedId ? styles.selectedRow : ""}`}>
                    <td className={styles.dateCell}>
                      <input type="date" value={row.date} onChange={e => updateRow(row.id, { date: e.target.value })} />
                      <small>{dayLabel(row.date)}{isToday ? " · 오늘" : ""}</small>
                    </td>
                    <td>
                      <select
                        value={row.status}
                        className={`${styles.status} ${row.status === "발행 완료" ? styles.done : row.status === "작성 중" ? styles.writing : styles.planned}`}
                        onChange={e => updateRow(row.id, { status: e.target.value as Status })}
                      >
                        <option>예정</option>
                        <option>작성 중</option>
                        <option>발행 완료</option>
                      </select>
                    </td>
                    <td><input className={styles.titleInput} value={row.title} placeholder="글 제목" onChange={e => updateRow(row.id, { title: e.target.value })} /></td>
                    <td><input value={row.keyword} placeholder="SEO 키워드" onChange={e => updateRow(row.id, { keyword: e.target.value })} /></td>
                    <td><input value={row.url} placeholder="발행 후 URL" onChange={e => updateRow(row.id, { url: e.target.value })} /></td>
                    <td><input value={row.note} placeholder="가격 확인 · 이미지 등" onChange={e => updateRow(row.id, { note: e.target.value })} /></td>
                    <td><button className={styles.workBtn} onClick={() => { setSelectedId(row.id); setNotice(""); }}>{row.id === selectedId ? "작업 중" : "글 작업"}</button></td>
                    <td><button className={styles.deleteBtn} onClick={() => removeRow(row.id)} aria-label="행 삭제">×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.footerNote}>
          <b>운영 팁</b>
          <span>가격 글은 발행 직전에 최신 웹 가격과 결제 방식을 다시 확인하고, 완료 후 발행 링크를 붙여두면 중복 주제를 피하기 쉽습니다.</span>
        </div>


        {selected && <section className={styles.workPanel}>
          <div className={styles.workHead}>
            <div>
              <span className={styles.workEyebrow}>GOOGLE BLOG WORKFLOW</span>
              <h2>{selected.title || "제목을 먼저 입력해 주세요."}</h2>
              <p>{selected.date} · {selected.keyword || "SEO 키워드 미입력"}</p>
            </div>
            <span className={styles.workStatus}>{selected.status}</span>
          </div>

          <div className={styles.workflowGrid}>
            <section className={styles.requestCard}>
              <span className={styles.stepNo}>01</span>
              <h3>본문 요청서</h3>
              <p>최신 가격을 웹에서 검증하고 SEO 제목·검색 설명·슬러그·라벨·Blogger HTML까지 한 번에 받습니다.</p>
              <div className={styles.requestActions}>
                <a
                  className={styles.primaryAction}
                  href={articleChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    startWork();
                    void copyText(articlePrompt, "본문 요청서를 ChatGPT로 열고 클립보드에도 복사했습니다.");
                  }}
                >
                  📝 GPT에 요청서 바로 열기
                </a>
                <button onClick={() => void copyText(articlePrompt, "본문 요청서를 복사했습니다.")}>요청서만 복사</button>
              </div>
              <details className={styles.promptDetails}>
                <summary>본문 요청서 확인</summary>
                <textarea readOnly value={articlePrompt} />
              </details>
            </section>

            <section className={styles.requestCard}>
              <span className={styles.stepNo}>02</span>
              <h3>이미지 요청서 6장</h3>
              <p>대표 이미지부터 가격·결제·비교·요약까지 슬롯별로 ChatGPT 새 창에 바로 전달합니다.</p>
              <div className={styles.imagePromptGrid}>
                {IMAGE_SLOTS.map(slot => {
                  const prompt = buildImagePrompt(selected, slot);
                  const chatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
                  return (
                    <div key={slot.id} className={styles.imagePromptItem}>
                      <div><b>{slot.id} · {slot.label}</b><small>{slot.role}</small></div>
                      <div>
                        <a
                          href={chatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            startWork();
                            void copyText(prompt, `${slot.id} 이미지 요청서를 열고 복사했습니다.`);
                          }}
                        >GPT 열기</a>
                        <button onClick={() => void copyText(prompt, `${slot.id} 이미지 요청서를 복사했습니다.`)}>복사</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className={styles.bodyCard}>
            <div className={styles.bodyHead}>
              <div>
                <span className={styles.stepNo}>03</span>
                <h3>ChatGPT 완성본 붙여넣기</h3>
                <p>[FINAL_TITLE]부터 [BLOGGER_HTML]까지 받은 전체 결과를 그대로 붙여넣으세요.</p>
              </div>
              <button
                className={styles.completeBtn}
                disabled={!selected.body?.trim()}
                onClick={() => updateRow(selected.id, { status: "발행 완료" })}
              >
                ✓ 발행 완료 표시
              </button>
            </div>
            <textarea
              className={styles.bodyEditor}
              value={selected.body || ""}
              placeholder="ChatGPT가 만든 최종 결과 전체를 붙여넣으세요."
              onChange={e => updateRow(selected.id, { body: e.target.value, status: selected.status === "발행 완료" ? "발행 완료" : "작성 중" })}
            />
          </section>

          <section className={styles.bloggerCard}>
            <div className={styles.bloggerHead}>
              <div>
                <span className={styles.stepNo}>04</span>
                <h3>Blogger 바로 업로드 서식</h3>
                <p>제목·검색 설명·슬러그·라벨을 따로 복사하고, 본문은 서식 포함 전체복사 또는 HTML 코드 복사를 사용하세요.</p>
              </div>
              <a className={styles.bloggerOpen} href="https://www.blogger.com/" target="_blank" rel="noopener noreferrer">Blogger 열기 ↗</a>
            </div>

            <div className={styles.metaGrid}>
              <div><span>최종 제목</span><b>{bloggerOutput.title || "완성본을 붙여넣으면 표시됩니다."}</b><button disabled={!bloggerOutput.title} onClick={() => void copyText(bloggerOutput.title, "최종 제목을 복사했습니다.")}>복사</button></div>
              <div><span>검색 설명</span><b>{bloggerOutput.description || "META_DESCRIPTION"}</b><button disabled={!bloggerOutput.description} onClick={() => void copyText(bloggerOutput.description, "검색 설명을 복사했습니다.")}>복사</button></div>
              <div><span>슬러그</span><b>{bloggerOutput.slug || "SLUG"}</b><button disabled={!bloggerOutput.slug} onClick={() => void copyText(bloggerOutput.slug, "슬러그를 복사했습니다.")}>복사</button></div>
              <div><span>라벨</span><b>{bloggerOutput.labels || "LABELS"}</b><button disabled={!bloggerOutput.labels} onClick={() => void copyText(bloggerOutput.labels, "라벨을 복사했습니다.")}>복사</button></div>
            </div>

            <div className={styles.bloggerActions}>
              <button className={styles.bloggerPrimary} disabled={!bloggerOutput.html} onClick={() => void copyBloggerRich()}>Blogger 서식 포함 전체복사</button>
              <button disabled={!bloggerOutput.html} onClick={() => void copyHtmlCode()}>HTML 코드 복사</button>
              <span>작성 화면 붙여넣기 = 서식 복사 · HTML 보기 = HTML 코드 복사</span>
            </div>
            {copyMessage && <div className={styles.copyMessage}>{copyMessage}</div>}

            <div className={styles.previewPane}>
              <div className={styles.previewHead}><b>Blogger 본문 미리보기</b><span>{bloggerOutput.html ? "HTML 본문 인식 완료" : "완성본 대기"}</span></div>
              {bloggerOutput.html ? (
                <iframe
                  title="Blogger preview"
                  sandbox=""
                  className={styles.previewFrame}
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#202124;line-height:1.7;padding:24px;max-width:860px;margin:auto}h2{font-size:26px;margin-top:34px}h3{font-size:21px;margin-top:28px}p{font-size:17px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:10px;text-align:left}a{color:#1769aa}img{max-width:100%}</style></head><body>${bloggerOutput.html}</body></html>`}
                />
              ) : (
                <div className={styles.previewEmpty}>ChatGPT 결과를 위에 붙여넣으면 Blogger에 들어갈 본문을 여기서 확인할 수 있습니다.</div>
              )}
            </div>
          </section>
        </section>}
      </section>
    </main>
  );
}
