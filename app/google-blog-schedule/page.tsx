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
};

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

export default function GoogleBlogSchedulePage() {
  const [rows, setRows] = useState<ScheduleRow[]>(DEFAULT_ROWS);
  const [loaded, setLoaded] = useState(false);
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

  function updateRow(id: string, patch: Partial<ScheduleRow>) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
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
    }]);
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
      });
    }
    setRows(prev => [...prev, ...extra]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(row => row.id !== id));
  }

  function resetRows() {
    if (!window.confirm("현재 스케줄을 지우고 기본 14일 스케줄로 되돌릴까요?")) return;
    setRows(DEFAULT_ROWS);
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
                <th aria-label="삭제"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isToday = row.date === today;
                return (
                  <tr key={row.id} className={isToday ? styles.todayRow : undefined}>
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
      </section>
    </main>
  );
}
