"use client";

import {useEffect, useMemo, useState} from "react";
import type {ChangeEvent} from "react";
import styles from "./page.module.css";

type Stage = "idea" | "writing" | "draft" | "published";
type Topic = {
  id: string;
  title: string;
  category: string;
  angle: string;
  notes: string;
  article: string;
  status: Stage;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "content-maker-cocobubu-topic-bank-v1";
const CATEGORIES = ["물·생수", "정수기·필터", "공기·생활위생", "코코부부 현장"];
const STAGE_LABELS: Record<Stage, string> = {
  idea: "글쓰기 대기",
  writing: "작성 중",
  draft: "원고 저장",
  published: "발행 완료"
};

// 검색어 후보이며 실제 검색량이나 건강 위해성이 검증됐다는 의미는 아닙니다.
const SEEDS: Array<[string, string, string]> = [
  ["물·생수", "매일 마시는 생수, 미세플라스틱도 함께 마실까?", "검출 연구와 인체 위해성의 불확실성을 구분"],
  ["물·생수", "생수병을 햇빛에 두면 물이 달라질까?", "보관 온도와 공식적인 보관 권고"],
  ["물·생수", "생수 한 병을 하루 종일 마셔도 괜찮을까?", "개봉 후 보관·위생 관리"],
  ["물·생수", "페트병 생수를 얼렸다 녹이면 어떤 일이 생길까?", "용기 변형·보관 조건 확인"],
  ["물·생수", "생수와 수돗물, 미세플라스틱은 어디에서 발견될까?", "시험 조건과 시료 차이를 표시해 비교"],
  ["물·생수", "생수와 정수기, 1년 비용은 얼마나 차이 날까?", "가정한 사용량과 비용 항목을 공개"],
  ["물·생수", "수돗물을 끓이면 불순물도 사라질까?", "끓이기의 효과와 한계"],
  ["물·생수", "물맛은 왜 집마다 다르게 느껴질까?", "수질과 온도·배관 등 가능한 요인"],
  ["정수기·필터", "정수기 물도 세균이 생길 수 있을까?", "관리 상태와 위생 정보"],
  ["정수기·필터", "정수기 필터를 제때 교체하지 않으면 어떻게 될까?", "제품별 교체 주기와 관리"],
  ["정수기·필터", "정수기 방문관리와 자가관리, 무엇이 다를까?", "모델과 계약에 따른 서비스 범위"],
  ["정수기·필터", "정수기 필터가 미세플라스틱을 걸러줄까?", "필터 유형과 실제 시험자료로만 판단"],
  ["정수기·필터", "정수기 물받이와 출수구는 얼마나 자주 청소해야 할까?", "관리 방법은 모델 설명서 확인"],
  ["정수기·필터", "얼음정수기 내부는 어떻게 관리할까?", "사용자 관리와 전문가 관리 구분"],
  ["정수기·필터", "코웨이 정수기 약정이 끝나면 어떻게 될까?", "모델·계약별 종료 조건 확인"],
  ["정수기·필터", "코웨이 정수기 구매와 렌탈, 어떤 차이가 있을까?", "비용·관리·소유권 비교"],
  ["공기·생활위생", "공기청정기는 창문을 열고 사용해도 될까?", "환기와 공기청정기의 역할 구분"],
  ["공기·생활위생", "공기청정기 필터를 청소하면 새것처럼 될까?", "필터 유형별 세척 가능 여부"],
  ["공기·생활위생", "가습기 물은 매일 갈아야 할까?", "안전한 관리 방법과 출처 확인"],
  ["공기·생활위생", "비데 노즐은 어떻게 관리해야 할까?", "제품별 공식 관리 방법"],
  ["코코부부 현장", "코웨이 코디는 하루에 어떤 일을 할까?", "실제로 경험한 업무만 기록"],
  ["코코부부 현장", "코웨이 코디 교육은 며칠 받을까?", "2026년 10월 교육 6일·동행 2일 경험을 기준으로 설명"],
  ["코코부부 현장", "코웨이 코디 첫 현장 동행, 무엇을 배웠을까?", "직접 본 내용과 느낀 점 구분"],
  ["코코부부 현장", "부부가 함께 코웨이 일을 하면 어떤 점이 다를까?", "실제 부부 경험을 중심으로 작성"]
];

const DEFAULT_TOPICS: Topic[] = SEEDS.map(([category, title, angle], index) => ({
  id: "seed-" + index,
  category, title, angle, notes: "", article: "", status: "idea",
  createdAt: "2026-11-04", updatedAt: "2026-11-04"
}));

function today() {
  return new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
}
function titleKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[“”"'.,?!·]/g, "");
}
function validTopic(value: unknown): value is Topic {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<Topic>;
  return typeof t.id === "string" && typeof t.title === "string" && typeof t.category === "string"
    && ["idea", "writing", "draft", "published"].includes(String(t.status))
    && typeof t.article === "string" && typeof t.notes === "string";
}
function writingPrompt(topic: Topic) {
  return [
    "[코코부부 네이버 블로그 · 글쓰기 요청서]",
    "기준일: " + today(),
    "제목 후보: " + topic.title,
    "분야: " + topic.category,
    "핵심 기획: " + topic.angle,
    "운영자 메모: " + (topic.notes.trim() || "없음"),
    "",
    "독자가 이 제목을 검색한 이유와 궁금한 답을 첫 3줄에 구체적으로 제시해줘.",
    "최신 웹 검색으로 공식 기관·원문 논문·제조사 안내를 확인하고, 출처와 발표일을 글 하단에 표시해줘.",
    "실제로 조사한 근거만 사용하고, 검색량·효능·비용·위험·제품 성능·경험을 만들지 마.",
    "특히 미세플라스틱 검출과 인체 위해성은 구분하며 'PET 생수는 위험하니 먹지 마세요'처럼 단정하지 마.",
    "코웨이 제품의 제거율과 관리 효과는 해당 모델의 검증 가능한 시험자료가 있을 때만 적어줘.",
    "코웨이 코디 경험담은 메모로 제공되지 않은 현장 사건·고객 반응·수입을 상상하지 마.",
    "홍보 문구가 아니라 생활 속 궁금증을 해결하는 글로 작성해줘.",
    "파람마처럼 간결하고 자연스러운 한국어를 쓰고, '살펴보겠습니다', '주목할 점' 같은 AI식 연결 문장은 빼줘.",
    "네이버 모바일에서 편하게 읽히도록 짧은 문단을 사용하고 불필요한 설명은 없애줘.",
    "관련성이 분명할 때만 마지막에 제품 관리나 정수기 선택 정보를 담아줘. 광고·제휴가 있으면 명확히 고지해줘.",
    "완성 원고와 함께 제목 대안 2개, 사실 확인이 필요한 항목, 대표 이미지 한 장의 간결한 기획도 제시해줘."
  ].join("\n");
}
function researchPrompt(topic: Topic) {
  return [
    "[코코부부 · 글감 조사만 진행]",
    "기준일: " + today(), "질문: " + topic.title, "검증할 방향: " + topic.angle,
    "추가 메모: " + (topic.notes || "없음"),
    "아직 원고를 쓰지 마. 공식 자료와 최근 신뢰 가능한 연구를 검색해 실제로 확인된 사실, 미확인 사항, 독자가 궁금해할 실용 질문을 정리해줘.",
    "각 근거는 출처 URL·발표일·적용 범위를 붙여줘. 수치·독성·건강 영향은 과장하지 마.",
    "검색량이나 클릭률을 조사하지 않았다면 추측으로 확정하지 마."
  ].join("\n");
}
function imagePrompt(topic: Topic) {
  return [
    "[코코부부 · 네이버 블로그 대표 이미지 요청서]",
    "제목: " + topic.title,
    "1600×900px, 가로 16:9, 이미지 정확히 1장.",
    "실사풍의 생활 속 장면 또는 쉬운 비교형 인포그래픽. 모바일에서 제목이 읽힐 정도로만 짧은 글자를 사용.",
    "연구 근거가 없는 건강 위협 연출, 검증되지 않은 수치, 실제 코웨이 로고·기기 외관의 부정확한 재현은 피할 것.",
    "본문과 검증 자료가 확정된 후 그 내용에 맞춰 제작."
  ].join("\n");
}
function parsedTopics(input: unknown): Topic[] {
  const raw = Array.isArray(input) ? input : (input && typeof input === "object" ? (input as {topics?: unknown}).topics : null);
  if (!Array.isArray(raw)) throw new Error("주제 보관함 JSON 형식이 아닙니다.");
  return raw.filter(validTopic).map(t => ({
    ...t, angle: typeof t.angle === "string" ? t.angle : "",
    createdAt: typeof t.createdAt === "string" ? t.createdAt : today(),
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : today()
  }));
}

export default function CocobubuQueuePage() {
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_TOPICS);
  const [selectedId, setSelectedId] = useState("seed-0");
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [includePublished, setIncludePublished] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newAngle, setNewAngle] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setTopics(parsedTopics(data));
        if (typeof data.selectedId === "string") setSelectedId(data.selectedId);
      }
    } catch {
      setNotice("저장된 주제를 읽지 못했습니다. 기존 보관 내용은 삭제하지 않았습니다. 백업을 확인해 주세요.");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, topics, selectedId}));
    } catch {
      setNotice("브라우저 저장에 실패했습니다. JSON 백업을 내려받아 보관해 주세요.");
    }
  }, [topics, selectedId, hydrated]);

  const selected = topics.find(item => item.id === selectedId) || topics[0] || null;
  const filtered = useMemo(() => topics.filter(item =>
    (includePublished || item.status !== "published") &&
    (categoryFilter === "전체" || item.category === categoryFilter) &&
    (item.title + " " + item.notes + " " + item.angle).toLowerCase().includes(query.trim().toLowerCase())
  ), [topics, includePublished, categoryFilter, query]);
  const counts = {
    waiting: topics.filter(t => t.status === "idea").length,
    writing: topics.filter(t => t.status === "writing" || t.status === "draft").length,
    published: topics.filter(t => t.status === "published").length
  };
  function edit(id: string, changes: Partial<Topic>) {
    setTopics(current => current.map(item => item.id === id ? {...item, ...changes, updatedAt: today()} : item));
  }
  function addTopic() {
    const title = newTitle.trim();
    if (!title) return setNotice("추가할 글 제목을 입력해 주세요.");
    if (topics.some(t => titleKey(t.title) === titleKey(title))) return setNotice("같거나 비슷한 제목이 이미 보관되어 있습니다.");
    const topic: Topic = {
      id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      title, category: newCategory, angle: newAngle.trim(), notes: "", article: "",
      status: "idea", createdAt: today(), updatedAt: today()
    };
    setTopics(current => [...current, topic]);
    setSelectedId(topic.id);
    setIncludePublished(false);
    setCategoryFilter("전체");
    setQuery("");
    setNewTitle("");
    setNewAngle("");
    setNotice("새 글감을 보관했습니다.");
  }
  async function copyText(content: string, message: string) {
    try {await navigator.clipboard.writeText(content); setNotice(message);}
    catch {setNotice("자동 복사에 실패했습니다. 아래 요청서를 직접 선택해서 복사해 주세요.");}
  }
  function startWriting() {
    if (!selected) return;
    if (selected.status === "idea") edit(selected.id, {status: "writing"});
    void copyText(writingPrompt(selected), "글쓰기 요청서를 복사했습니다. ChatGPT에 붙여넣어 작성하세요.");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }
  function backup() {
    const blob = new Blob([JSON.stringify({version: 1, savedAt: new Date().toISOString(), topics, selectedId}, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "cocobubu-topic-bank-" + today() + ".json";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("글감과 저장 원고의 JSON 백업을 내려받았습니다.");
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const incoming = parsedTopics(JSON.parse(await file.text()));
      const seen = new Set(topics.map(t => titleKey(t.title)));
      const additions = incoming.filter(t => {
        const key = titleKey(t.title);
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      }).map(t => ({...t, id: "import-" + Math.random().toString(36).slice(2) + "-" + Date.now()}));
      setTopics(old => [...old, ...additions]);
      setNotice("백업에서 새 글감 " + additions.length + "개를 합쳤습니다. 기존 글감과 원고는 유지했습니다.");
    } catch {setNotice("JSON 백업을 읽지 못했습니다. 원본 파일을 확인해 주세요.");}
    event.target.value = "";
  }
  function markPublished() {
    if (!selected || !selected.article.trim()) return setNotice("발행 완료 전에 원고를 저장해 주세요.");
    if (!window.confirm("실제로 네이버에 발행한 글인가요? 완료로 표시해도 원고는 삭제되지 않습니다.")) return;
    edit(selected.id, {status: "published"});
    setNotice("발행 완료로 표시했습니다. 원고와 제목은 보관됩니다.");
  }

  if (!hydrated) return <main className={styles.page}><p>코코부부 주제 보관함 불러오는 중…</p></main>;
  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/">← 콘텐츠 메이커</a>
      <strong>💧 코코부부 · 주제 보관함</strong>
      <a href="/paramma-bulk">Paramma 제작실</a>
    </header>
    <section className={styles.hero}>
      <div>
        <span className={styles.overline}>COCOBUBU · TOPIC BANK</span>
        <h1>궁금한 제목을 모아두고<br />하나씩 글로 만드세요.</h1>
        <p>물·생수, 정수기 관리, 공기·생활위생, 코코부부 현장 경험을 분리해서 보관합니다. 제목 선택부터 발행 완료까지 관리할 수 있습니다.</p>
      </div>
      <div className={styles.counts}>
        <div><strong>{counts.waiting}</strong><span>대기</span></div>
        <div><strong>{counts.writing}</strong><span>진행 중</span></div>
        <div><strong>{counts.published}</strong><span>발행 완료</span></div>
      </div>
    </section>
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    <section className={styles.layout}>
      <div className={styles.left}>
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <h2>글감 보관함 <small>{topics.length}개</small></h2>
            <button onClick={backup} className={styles.minor}>JSON 백업</button>
          </div>
          <div className={styles.inlineControls}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·메모 검색" aria-label="제목 검색" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="분야 선택">
              {["전체", ...CATEGORIES].map(group => <option key={group}>{group}</option>)}
            </select>
          </div>
          <label className={styles.checkbox}><input type="checkbox" checked={includePublished} onChange={e => setIncludePublished(e.target.checked)} /> 발행 완료 글도 보기</label>
          <div className={styles.topics}>
            {filtered.map((item, index) => <button key={item.id} className={selected?.id === item.id ? styles.activeTopic : styles.topic} onClick={() => setSelectedId(item.id)}>
              <span className={styles.topicNum}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.topicCopy}><strong>{item.title}</strong><small>{item.category} · {STAGE_LABELS[item.status]}</small></span>
            </button>)}
            {!filtered.length && <p className={styles.empty}>조건에 맞는 글감이 없습니다.</p>}
          </div>
        </section>
        <section className={styles.panel}>
          <h2>새 제목 보관</h2>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="예: 생수를 차 안에 두면 괜찮을까?" aria-label="새 제목" />
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)} aria-label="새 제목 분야">
            {CATEGORIES.map(group => <option key={group}>{group}</option>)}
          </select>
          <textarea value={newAngle} onChange={e => setNewAngle(e.target.value)} rows={2} placeholder="어떤 궁금증을 풀지 한 줄 메모(선택)" />
          <button className={styles.primary} onClick={addTopic}>+ 글감 보관</button>
          <div className={styles.importBox}>
            <label htmlFor="coco-import">다른 브라우저의 JSON 백업 합치기</label>
            <input id="coco-import" type="file" accept=".json,application/json" onChange={importBackup} />
          </div>
        </section>
      </div>
      <section className={styles.panel}>
        {selected ? <>
          <div className={styles.sectionHead}>
            <div><span className={styles.overline}>SELECTED TOPIC</span><h2>선택한 글감</h2></div>
            <select value={selected.status} onChange={e => edit(selected.id, {status: e.target.value as Stage})} aria-label="작업 상태">
              {Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <label>발행 제목</label>
          <input value={selected.title} onChange={e => edit(selected.id, {title: e.target.value})} />
          <label>주제 분류</label>
          <select value={selected.category} onChange={e => edit(selected.id, {category: e.target.value})}>
            {CATEGORIES.map(group => <option key={group}>{group}</option>)}
          </select>
          <label>기획 방향</label>
          <textarea rows={2} value={selected.angle} onChange={e => edit(selected.id, {angle: e.target.value})} />
          <label>직접 조사한 사실·현장 경험 메모</label>
          <textarea rows={4} value={selected.notes} onChange={e => edit(selected.id, {notes: e.target.value})} placeholder="현장에서 확인한 내용이나 원문 출처를 입력하세요. 없는 경험은 원고에 만들지 않습니다." />
          <div className={styles.actions}>
            <button className={styles.primary} onClick={startWriting}>글쓰기 시작 · ChatGPT 열기</button>
            <button className={styles.minor} onClick={() => void copyText(researchPrompt(selected), "사실 조사 요청서를 복사했습니다.")}>자료 조사 요청서 복사</button>
            <button className={styles.minor} onClick={() => void copyText(imagePrompt(selected), "대표 이미지 요청서를 복사했습니다.")}>이미지 요청서 복사</button>
          </div>
          <details className={styles.details}>
            <summary>이 주제의 글쓰기 요청서 미리보기</summary>
            <textarea readOnly rows={14} value={writingPrompt(selected)} />
            <button className={styles.minor} onClick={() => void copyText(writingPrompt(selected), "글쓰기 요청서를 복사했습니다.")}>요청서 복사</button>
          </details>
          <h2 className={styles.articleTitle}>완성 원고 보관</h2>
          <p className={styles.hint}>ChatGPT에서 작성·검토한 최종 원고를 붙여넣으세요. 입력 내용은 자동 저장됩니다.</p>
          <textarea className={styles.article} value={selected.article} onChange={e => edit(selected.id, {article: e.target.value, status: selected.status === "published" ? "published" : "draft"})} placeholder="완성 원고를 여기에 붙여넣으세요." rows={16} />
          <div className={styles.actions}>
            <button className={styles.minor} onClick={() => void copyText(selected.article, "원고를 복사했습니다.")} disabled={!selected.article.trim()}>원고 복사</button>
            <button className={styles.primary} onClick={markPublished}>네이버 발행 완료 표시</button>
          </div>
          <p className={styles.hint}>최근 저장 날짜: {selected.updatedAt} · 발행 완료로 바꿔도 제목·메모·원고를 지우지 않습니다.</p>
        </> : <p>글감을 하나 선택하세요.</p>}
      </section>
    </section>
    <footer>저장은 현재 브라우저에만 적용됩니다. 다른 휴대폰·컴퓨터에서 쓰려면 JSON 백업과 가져오기를 이용하세요. 기존 Paramma·집값쓱 작업은 변경하지 않습니다.</footer>
  </main>;
}
