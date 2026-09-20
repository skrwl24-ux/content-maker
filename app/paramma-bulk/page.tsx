"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Category = "신기한 동물이야기" | "신비로운 자연" | "생활 속 궁금증";
type Status = "waiting" | "working" | "done";

type Topic = {
  id: number;
  category: Category;
  title: string;
  brief: string;
};

const TOPICS: Topic[] = [
  { id: 1, category: "생활 속 궁금증", title: "9월인데 모기가 왜 이렇게 많지? 가을 모기가 사라지지 않는 이유", brief: "지금 계절과 맞는 생활 검색형 주제. 기온·습도·모기 활동 시기를 중심으로 설명합니다." },
  { id: 2, category: "신기한 동물이야기", title: "고양이는 왜 박스를 좋아할까?", brief: "생활 속에서 자주 보는 행동을 안정감·체온·본능과 연결하는 검색형 동물 주제입니다." },
  { id: 3, category: "신비로운 자연", title: "가을 하늘은 왜 유난히 높고 파랗게 보일까?", brief: "계절성 높은 자연 궁금증. 대기 상태와 빛의 산란을 쉽게 풀어냅니다." },
  { id: 4, category: "생활 속 궁금증", title: "집에 초파리가 계속 생기는 이유｜잡아도 다시 나타나는 곳은?", brief: "검색 의도가 선명한 생활형 주제. 발생 장소와 번식 조건을 사실 중심으로 정리합니다." },
  { id: 5, category: "신기한 동물이야기", title: "피스톨새우는 어떻게 총소리를 낼까?", brief: "블로그 색깔을 살리는 희귀·신기 소재. 집게와 공동현상 원리를 쉽게 설명합니다." },
  { id: 6, category: "신비로운 자연", title: "나뭇잎은 왜 가을이 되면 빨강·노랑으로 변할까?", brief: "가을 대표 검색형 자연 주제. 엽록소와 색소 변화를 이해하기 쉽게 정리합니다." },
  { id: 7, category: "생활 속 궁금증", title: "밤에 창문을 열면 벌레가 불빛으로 몰려드는 이유", brief: "누구나 경험하는 생활 질문. 곤충의 방향 감각과 인공조명의 영향을 설명합니다." },
  { id: 8, category: "신기한 동물이야기", title: "새들은 길을 어떻게 잃지 않을까?", brief: "태양·별·지구 자기장 등 동물의 놀라운 길찾기 능력을 다루는 검색형 주제입니다." },
  { id: 9, category: "신비로운 자연", title: "밤바다는 왜 파랗게 빛날까? 생물발광의 비밀", brief: "시각적으로 강한 희귀 자연 소재. 생물발광 플랑크톤과 조건을 검증해 설명합니다." },
  { id: 10, category: "생활 속 궁금증", title: "은행나무 열매는 왜 그렇게 냄새가 심할까?", brief: "가을철 생활 검색과 자연 과학을 연결하는 주제. 냄새 성분과 열매 구조를 설명합니다." },
];

const STORAGE_KEY = "paramma-publish-queue-v1";

function categoryEmoji(category: Category) {
  if (category === "신기한 동물이야기") return "🐾";
  if (category === "신비로운 자연") return "🌌";
  return "💡";
}

function categoryClass(category: Category) {
  if (category === "신기한 동물이야기") return styles.animal;
  if (category === "신비로운 자연") return styles.nature;
  return styles.life;
}

function formatToday() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function categoryGuide(category: Category) {
  if (category === "신기한 동물이야기") {
    return "동물의 행동이나 능력을 사람처럼 과도하게 의인화하지 말고, 관찰 연구와 생물학적 원인을 중심으로 설명한다. 독자가 놀랄 만한 포인트는 살리되 검증되지 않은 능력은 사실처럼 쓰지 않는다.";
  }
  if (category === "신비로운 자연") {
    return "현상이 왜 생기는지 원인→과정→결과 순서로 쉽게 설명한다. 사진이나 영상에서 강하게 보이는 현상일수록 과장·도시전설·잘못된 설명을 구분해 검증한다.";
  }
  return "독자가 검색한 질문에 초반 3~4문장 안에 핵심 답을 먼저 준다. 생활에서 실제로 체감하는 이유와 과학적 원리를 연결하고, 건강·안전 관련 내용은 공공기관 자료를 우선 확인한다.";
}

function buildArticlePrompt(topic: Topic) {
  return `Paramma 블로거 네이버 글을 최종 발행본으로 만들어줘.

[작성 기준일]
${formatToday()}

[발행 정보]
이번 묶음: 1차 발행 10개
발행 순서: ${topic.id}/10
카테고리: ${topic.category}
주제: ${topic.title}
기획 의도: ${topic.brief}

[가장 중요한 작업 방식]
- 먼저 웹 검색으로 사실을 확인한 뒤 글을 작성할 것.
- 현재·계절성 내용은 작성 기준일과 맞는 최신 자료를 우선 확인할 것.
- 정부기관, 대학, 학술논문, 박물관·과학기관, 공신력 있는 전문기관을 우선 활용할 것.
- 블로그나 커뮤니티의 주장을 그대로 사실처럼 사용하지 말 것.
- 서로 다른 설명이 있는 내용은 무엇이 확실하고 무엇이 가설인지 구분할 것.
- 숫자·기간·온도·생태 특징 등 구체적인 사실은 임의로 만들지 말 것.
- 검색 결과를 그대로 베끼지 말고 이해하기 쉬운 한국어로 재구성할 것.

[카테고리 작성 규칙]
${categoryGuide(topic.category)}

[네이버 검색형 제목]
- 제목 후보 5개를 먼저 내부적으로 비교할 것.
- 최종 제목은 검색어가 자연스럽게 들어가면서도 “왜/어떻게/정말?” 같은 궁금증을 살릴 것.
- 낚시성 과장, 사실과 다른 단정, 지나치게 긴 제목은 피할 것.
- 본문 최종 출력에서는 최종 선택 제목 1개만 맨 위에 표시할 것.

[본문 구성]
- 모바일에서 읽기 편하게 짧은 문단으로 작성.
- 도입부에서 독자의 실제 궁금증을 바로 꺼낼 것.
- 핵심 답을 너무 늦게 숨기지 말 것.
- 소제목 4~6개 정도.
- 핵심 원리와 과정을 쉬운 말로 설명.
- 사람들이 자주 오해하는 부분이 있으면 별도 문단으로 바로잡기.
- 같은 말을 반복해 분량만 늘리지 말 것.
- AI가 쓴 티가 나는 상투적인 결론은 피할 것.
- 정보글이지만 딱딱한 논문체보다는 자연스러운 개인 블로그 문체.
- 필요하면 마지막에 ‘한눈에 정리’ 3줄 정도 사용.
- 네이버 블로그용 태그 8~12개를 마지막에 한 줄로 제공.

[이미지 구성]
최종 본문 안에 이미지 위치를 정확히 표시해줘.
- 이미지 00: 썸네일
- 이미지 01: 핵심 원리 또는 가장 이해가 필요한 장면
- 이미지 02: 과정·비교·구조를 보여주는 장면
- 필요할 때만 이미지 03 추가
이미지를 억지로 늘리지 말 것.

[이미지 요청서]
본문 뒤에 별도로 각 이미지의 생성 요청서를 만들어줘.
- 썸네일은 1254×1254 정사각형
- 본문 이미지는 1600×900 가로형 기본
- 실제 생물·자연의 형태를 왜곡하지 말 것
- 교육용 인포그래픽이 더 적합한 장면은 그렇게 제안할 것
- 사진형이 더 적합한 장면은 자연스러운 다큐멘터리 사진 느낌으로 제안할 것
- 이미지 안에 들어갈 핵심 문구가 필요하면 짧게 제안할 것

[최종 출력 순서]
1. 최종 제목
2. 네이버 발행용 본문
3. 태그
4. 이미지 00~02(필요 시 03) 제작 요청서
5. 마지막에 ‘검수 메모’로 사용한 주요 출처와 핵심 사실을 짧게 정리

중요: 검색하지 않고 일반 상식만으로 작성하지 말고, 반드시 최신 웹 검색과 사실 검증을 거쳐 완성해줘.`;
}

function buildNextTenPrompt() {
  const previous = TOPICS.map((t) => `${t.id}. [${t.category}] ${t.title}`).join("\n");
  return `Paramma 블로거의 다음 발행 순서 10개를 새로 추천해줘.

현재 날짜 기준으로 계절성·검색성·생활 궁금증·블로그 색깔을 함께 고려해줘.

[운영 카테고리]
- 신기한 동물이야기
- 신비로운 자연
- 생활 속 궁금증

[운영 방식]
- 탭별로 따로 추천하지 말고 세 카테고리를 한 개의 발행 큐에 섞을 것.
- 1번부터 10번까지 실제로 올릴 순서를 정해줄 것.
- 검색형·생활형 소재를 중심으로 하되 희귀하고 신기한 소재도 일부 섞을 것.
- 대략 검색형 70%, 희귀·신기형 30% 느낌으로 구성.
- 같은 종류의 소재가 연속해서 몰리지 않게 할 것.
- 계절에 맞지 않는 주제는 우선순위를 낮출 것.
- 아래 이전 10개와 동일하거나 지나치게 비슷한 주제는 제외할 것.
- 각 항목에 카테고리와 한 줄 기획 의도를 함께 표시할 것.

[이전 10개]
${previous}

최종 출력은 1~10번 표로 깔끔하게 정리해줘.`;
}

export default function ParammaBulkPage() {
  const [selectedId, setSelectedId] = useState(1);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.statuses) setStatuses(parsed.statuses);
        if (parsed?.selectedId) setSelectedId(parsed.selectedId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ statuses, selectedId }));
    } catch {}
  }, [statuses, selectedId]);

  const selected = TOPICS.find((t) => t.id === selectedId) || TOPICS[0];
  const doneCount = useMemo(() => TOPICS.filter((t) => statuses[t.id] === "done").length, [statuses]);
  const progress = Math.round((doneCount / TOPICS.length) * 100);
  const articlePrompt = useMemo(() => buildArticlePrompt(selected), [selected]);

  function statusOf(id: number): Status {
    return statuses[id] || "waiting";
  }

  function selectTopic(id: number) {
    setSelectedId(id);
    setNotice("");
  }

  function startTopic(id: number) {
    setSelectedId(id);
    setStatuses((prev) => ({ ...prev, [id]: prev[id] === "done" ? "done" : "working" }));
  }

  function completeTopic(id: number) {
    setStatuses((prev) => ({ ...prev, [id]: "done" }));
    const next = TOPICS.find((t) => t.id > id && statusOf(t.id) !== "done");
    if (next) setSelectedId(next.id);
    setNotice(next ? `${id}번 완료. 다음 ${next.id}번으로 이동했습니다.` : "이번 10개가 모두 끝났습니다. 다음 10개를 요청할 차례예요.");
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
    } catch {
      setNotice("클립보드 복사에 실패했습니다. 요청서에서 직접 선택해 복사해주세요.");
    }
  }

  async function copyAndOpen() {
    startTopic(selected.id);
    await copyText(articlePrompt, `${selected.id}번 ChatGPT 검색 요청서를 복사했습니다. 새 채팅에 붙여넣으세요.`);
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  async function requestNextTen() {
    await copyText(buildNextTenPrompt(), "다음 10개 추천 요청서를 복사했습니다. ChatGPT에 붙여넣으세요.");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  function resetProgress() {
    if (!window.confirm("이번 10개의 진행 상태를 모두 초기화할까요?")) return;
    setStatuses({});
    setSelectedId(1);
    setNotice("진행 상태를 초기화했습니다.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a href="/" className={styles.homeLink}>← 콘텐츠 메이커</a>
        <div className={styles.brand}>🌿 Paramma 블로거</div>
        <button type="button" className={styles.resetButton} onClick={resetProgress}>진행 초기화</button>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PARAMMA PUBLISH QUEUE</p>
          <h1>이번 발행 10개</h1>
          <p>카테고리를 따로 고르지 않습니다. 추천 순서대로 하나씩 검색·작성하고 발행 완료만 체크하세요.</p>
        </div>
        <div className={styles.progressCard}>
          <div><b>{doneCount}</b><span>/ 10 완료</span></div>
          <div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div>
          <small>{progress}% 진행</small>
        </div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.layout}>
        <div className={styles.queuePanel}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>PUBLISH ORDER</p>
              <h2>1번부터 순서대로</h2>
            </div>
            <span>카테고리는 배지로만 표시</span>
          </div>

          <div className={styles.queue}>
            {TOPICS.map((topic) => {
              const status = statusOf(topic.id);
              const selectedNow = selected.id === topic.id;
              return (
                <button
                  type="button"
                  key={topic.id}
                  className={`${styles.topicCard} ${selectedNow ? styles.selected : ""} ${status === "done" ? styles.done : ""}`}
                  onClick={() => selectTopic(topic.id)}
                >
                  <span className={styles.number}>{String(topic.id).padStart(2, "0")}</span>
                  <div className={styles.topicMain}>
                    <span className={`${styles.category} ${categoryClass(topic.category)}`}>
                      {categoryEmoji(topic.category)} {topic.category}
                    </span>
                    <b>{topic.title}</b>
                    <small>{topic.brief}</small>
                  </div>
                  <span className={`${styles.status} ${styles[status]}`}>
                    {status === "done" ? "완료" : status === "working" ? "진행 중" : "대기"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.nextBatch}>
            <div>
              <b>10개가 끝났나요?</b>
              <span>현재 10개와 겹치지 않도록 다음 발행 10개를 ChatGPT에 요청합니다.</span>
            </div>
            <button type="button" onClick={() => void requestNextTen()}>다음 10개 요청하기</button>
          </div>
        </div>

        <aside className={styles.workPanel}>
          <p className={styles.eyebrow}>CURRENT ARTICLE</p>
          <div className={styles.currentNo}>{String(selected.id).padStart(2, "0")}</div>
          <span className={`${styles.category} ${categoryClass(selected.category)}`}>
            {categoryEmoji(selected.category)} {selected.category}
          </span>
          <h2>{selected.title}</h2>
          <p className={styles.brief}>{selected.brief}</p>

          <div className={styles.flow}>
            <div><span>1</span><p><b>요청서 복사</b><small>작성 기준일·카테고리·검색 규칙 자동 포함</small></p></div>
            <div><span>2</span><p><b>ChatGPT 검색·작성</b><small>최신 웹 검색 → 제목 → 본문 → 이미지 요청서</small></p></div>
            <div><span>3</span><p><b>네이버 발행</b><small>최종 글과 이미지를 올린 뒤 완료 체크</small></p></div>
          </div>

          <div className={styles.primaryActions}>
            <button type="button" className={styles.primary} onClick={() => void copyAndOpen()}>
              🔎 ChatGPT 검색 요청서 복사 + 열기
            </button>
            <button type="button" className={styles.secondary} onClick={() => void copyText(articlePrompt, "요청서를 복사했습니다.")}>
              요청서만 복사
            </button>
          </div>

          <details className={styles.promptDetails}>
            <summary>요청서 내용 확인</summary>
            <textarea value={articlePrompt} readOnly />
          </details>

          <button type="button" className={styles.completeButton} onClick={() => completeTopic(selected.id)}>
            ✓ 이 글 발행 완료
          </button>
        </aside>
      </section>
    </main>
  );
}
