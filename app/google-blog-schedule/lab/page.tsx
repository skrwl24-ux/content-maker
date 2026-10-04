"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  LAB_VERSION, LAB_TITLE, LAB_PROVIDERS, LAB_ISSUES,
  buildLabPdf, makeLabPrompt, makeLabAnswerKey, newLabRun,
} from "../../../lib/ai-price-atlas-lab.mjs";
import { scoreAutoRun, makeAutoReport, makeAutoBloggerPrompt } from "../../../lib/ai-price-atlas-auto-grade.mjs";
import type { LabProviderId, LabRun } from "../../../lib/ai-price-atlas-lab.mjs";
import styles from "./page.module.css";

type LabRuns = Record<LabProviderId, LabRun>;
const STORAGE_KEY = "ai-price-atlas-lab-v1";
const QUEUE_TRANSFER_KEY = "ai-price-atlas-lab-queue-transfer-v1";

function localToday() {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
    "-" + String(date.getDate()).padStart(2, "0");
}
function emptyRuns(date: string): LabRuns {
  return {
    chatgpt: newLabRun("chatgpt", date),
    claude: newLabRun("claude", date),
    gemini: newLabRun("gemini", date),
  };
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function modelLabel(provider: LabProviderId) {
  return provider === "chatgpt" ? "예: GPT-5.6" :
    provider === "claude" ? "예: Claude Sonnet (표시된 버전)" :
    "예: Gemini Pro (표시된 버전)";
}

export default function AiPriceAtlasLabPage() {
  const [runs, setRuns] = useState<LabRuns>(() => emptyRuns(""));
  const [activeProvider, setActiveProvider] = useState<LabProviderId>("chatgpt");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("불러오는 중");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [today, setToday] = useState("");
  const prompt = useMemo(() => makeLabPrompt(), []);
  const active = runs[activeProvider];
  const activeScore = scoreAutoRun(active);
  const answered = LAB_PROVIDERS.filter((p) => runs[p.id].response.trim().length > 0).length;
  const autoEvaluated = LAB_PROVIDERS.filter((p) => scoreAutoRun(runs[p.id]).evaluated).length;
  const allAnswersReady = autoEvaluated === LAB_PROVIDERS.length;
  const report = useMemo(() => makeAutoReport(runs, today), [runs, today]);
  const articlePrompt = useMemo(() => makeAutoBloggerPrompt(runs, today), [runs, today]);

  useEffect(() => {
    const date = localToday();
    setToday(date);
    const fallback = emptyRuns(date);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<LabRuns>;
        for (const provider of LAB_PROVIDERS) {
          const value = stored?.[provider.id];
          if (!value || typeof value !== "object") continue;
          fallback[provider.id] = {
            ...fallback[provider.id],
            ...value,
            providerId: provider.id,
            verdicts: { ...fallback[provider.id].verdicts, ...(value.verdicts || {}) },
          };
        }
        setSaveState("지난 테스트 복원됨");
      } else {
        setSaveState("새 테스트 준비됨");
      }
    } catch {
      setSaveState("저장소를 읽지 못해 새 테스트를 표시합니다.");
    }
    setRuns(fallback);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("저장 대기…");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
        setSaveState("이 브라우저에 자동 저장됨");
      } catch {
        setSaveState("자동 저장 실패 · ZIP으로 백업하세요.");
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [runs, hydrated]);

  function updateActive(patch: Partial<LabRun>) {
    // Re-analyze saved original answers on each edit; old manual verdict fields are intentionally ignored.
    setRuns((prev) => ({ ...prev, [activeProvider]: { ...prev[activeProvider], ...patch } }));
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(what + " 복사했습니다.");
    } catch {
      setNotice("복사 실패 · HTTPS 및 브라우저 클립보드 권한을 확인하세요.");
    }
  }
  function downloadPdf() {
    const bytes = buildLabPdf();
    saveBlob(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      "ai-price-atlas-" + LAB_VERSION + ".pdf");
    setNotice("동일한 2페이지 PDF를 내려받았습니다. 정답표는 AI에게 전달하지 마세요.");
  }
  async function exportArchive() {
    if (!answered || exporting) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      zip.file("01_fixture/ai-price-atlas-" + LAB_VERSION + ".pdf", buildLabPdf());
      zip.file("02_common_prompt.txt", prompt);
      zip.file("03_PRIVATE_answer_key.txt", makeLabAnswerKey());
      for (const provider of LAB_PROVIDERS) {
        const run = runs[provider.id];
        zip.file("04_original_ai_answers/" + provider.id + ".txt",
          "Provider: " + provider.label + "\nModel: " + (run.model || "unrecorded") +
          "\nPlan: " + (run.plan || "unrecorded") + "\nDate: " + (run.testedAt || "unrecorded") +
          "\n\n" + (run.response || "No answer collected."));
      }
      zip.file("05_scorecard/scorecard.json", JSON.stringify({
        version: LAB_VERSION, exportedAt: new Date().toISOString(),
        sources: "User-pasted original replies; deterministic local matching of metric/corrected figures; false positives unassessed.",
        issues: LAB_ISSUES, runs,
        scores: Object.fromEntries(LAB_PROVIDERS.map((p) => [p.id, scoreAutoRun(runs[p.id])])),
      }, null, 2));
      zip.file("05_scorecard/verified_report.txt", report);
      zip.file("06_blog/english_article_request.txt", articlePrompt);
      zip.file("README.txt", [
        "AI PRICE ATLAS — SYNTHETIC PDF TEST ARCHIVE",
        "IMPORTANT: 03_PRIVATE_answer_key.txt contains the five planted errors.",
        "Do not upload the whole ZIP to AI models before collecting their answers.",
        "The PDF and common prompt must be identical across every run.",
        "The five known corrections are checked locally against each pasted reply. Ambiguous passages are excluded from confirmed matches.",
        "False positives are NOT assessed automatically. Model/plan/date metadata is recommended for publishing provenance.",
        "Raw answers are user-supplied, not API outputs. This is not an independent model benchmark.",
        "Files are exported locally, not uploaded to a server.",
      ].join("\n"));
      saveBlob(await zip.generateAsync({ type: "blob" }), "ai-price-atlas-" + LAB_VERSION + "-evidence.zip");
      setNotice("PDF·정답표·AI 원문 답변·채점표·글 작성 요청서를 ZIP으로 내보냈습니다.");
    } catch {
      setNotice("ZIP 생성 실패 · 브라우저 저장 공간을 확인하세요.");
    } finally {
      setExporting(false);
    }
  }
  function sendToQueue() {
    if (!allAnswersReady) return;
    const testedNames = LAB_PROVIDERS.filter((p) => scoreAutoRun(runs[p.id]).evaluated).map((p) => p.label);
    const date = localToday();
    const title = "AI PDF Error Test: Verified Results from " + testedNames.join(", ");
    const pending = {
      id: "lab-" + Date.now(),
      kind: "experiment",
      date,
      title,
      keyword: "AI PDF numerical accuracy test",
      slug: "ai-pdf-error-test-" + date.replace(/-/g, ""),
      note: "실제 AI 웹 테스트 | 가상 PDF 2페이지 | 세 답변 자동 대조: " + testedNames.join(", ") + " | 판독 보류·오탐 미평가는 결과에 그대로 표기 | 원본은 검증실 ZIP",
      labVersion: LAB_VERSION,
      labReport: report,
      labPrompt: articlePrompt,
    };
    try {
      window.localStorage.setItem(QUEUE_TRANSFER_KEY, JSON.stringify(pending));
      window.location.href = "/google-blog-schedule?fromLab=1";
    } catch {
      setNotice("발행 큐 전달에 실패했습니다. 브라우저의 로컬 저장소를 확인하세요.");
    }
  }
  function resetTest() {
    if (!window.confirm("이 브라우저에 저장된 AI별 답변·채점 기록을 모두 초기화할까요? 필요하다면 먼저 ZIP으로 백업하세요.")) return;
    setRuns(emptyRuns(localToday()));
    setActiveProvider("chatgpt");
    setNotice("테스트가 초기화됐습니다. 공통 PDF와 프롬프트는 동일하게 유지됩니다.");
  }

  return <main className={styles.wrap}>
    <header className={styles.nav}>
      <a href="/" className={styles.back}>← 콘텐츠메이커</a>
      <div className={styles.navLinks}>
        <a href="/google-blog-schedule">기존 발행 스케줄</a>
        <span className={styles.save}>{saveState}</span>
      </div>
    </header>

    <section className={styles.hero}>
      <span className={styles.eyebrow}>AI PRICE ATLAS · FIRST-HAND LAB</span>
      <h1>AI를 직접 시험하고,<br/>결과가 있는 글을 만듭니다.</h1>
      <p>API 연결 없이 ChatGPT · Claude · Gemini의 기존 웹사이트에서 같은 문제를 풀게 하세요. 원문 답변과 정답 대조 기록을 남겨 독자에게 근거를 보여주는 방식입니다.</p>
      <div className={styles.heroMeta}>
        <span>첫 실험 · {LAB_VERSION}</span>
        <span>가상 보고서 2페이지</span>
        <span>검증할 계산 오류 5개</span>
      </div>
    </section>

    <section className={styles.progress} aria-label="실험 진행 상황">
      <div><strong>{answered}/3</strong><span>AI 답변 수집</span></div>
      <div><strong>{autoEvaluated}/3</strong><span>답변 자동 대조</span></div>
      <div><strong>{LAB_ISSUES.length}</strong><span>검증 정답 개수</span></div>
      <div><strong>0</strong><span>AI API 호출</span></div>
    </section>

    <section className={styles.panel}>
      <span className={styles.step}>STEP 01 · 동일한 테스트 준비</span>
      <h2>{LAB_TITLE}</h2>
      <p className={styles.muted}>영문 PDF와 공통 프롬프트를 만들어 뒀습니다. 파일은 별도 서비스나 서버로 업로드하지 않으며, 버튼을 누르면 브라우저에서 즉시 생성됩니다.</p>
      <div className={styles.fixtureActions}>
        <button type="button" className={styles.primary} onClick={downloadPdf}>
          ↓ 테스트 PDF 다운로드 (2페이지)
        </button>
        <button type="button" className={styles.secondary} onClick={() => void copy(prompt, "공통 영문 테스트 질문")}>
          공통 질문 복사
        </button>
      </div>
      <label className={styles.fieldLabel} htmlFor="labPrompt">모든 AI에 동일하게 입력할 질문</label>
      <textarea id="labPrompt" className={styles.promptBox} value={prompt} rows={7} readOnly />
      <p className={styles.warning}>정답표는 테스트가 끝난 뒤 열어야 합니다. 다른 AI에 PDF 대신 정답표 또는 전체 ZIP을 업로드하면 비교 결과가 무효가 됩니다.</p>
    </section>

    <section className={styles.panel}>
      <span className={styles.step}>STEP 02 · 각 AI에 직접 접속해 답변 가져오기</span>
      <h2>같은 PDF와 질문을 세 AI에게 전달하세요</h2>
      <p className={styles.muted}>아래 버튼은 해당 서비스의 공식 채팅 사이트만 엽니다. 로그인·PDF 첨부·질문 붙여넣기는 각 사이트에서 진행하고, 받은 원문을 다시 이 화면에 복사합니다. 기존 계정으로 테스트할 수 있습니다.</p>
      <div className={styles.providerTabs} role="tablist" aria-label="테스트할 AI 선택">
        {LAB_PROVIDERS.map((provider) => {
          const score = scoreAutoRun(runs[provider.id]);
          return <button type="button" role="tab" aria-selected={activeProvider === provider.id}
            key={provider.id}
            className={activeProvider === provider.id ? styles.providerActive : styles.providerTab}
            onClick={() => setActiveProvider(provider.id)}>
            <strong>{provider.label}</strong>
            <small>{score.complete ? "자동 대조 완료" : score.evaluated ? "판독 보류 " + score.uncertain + "개" : runs[provider.id].response.trim() ? "답변 저장됨" : "대기"}</small>
          </button>;
        })}
      </div>
      <div className={styles.testForm} role="tabpanel">
        <div className={styles.formHead}>
          <h3>{LAB_PROVIDERS.find((provider) => provider.id === activeProvider)?.label} 테스트 기록</h3>
          <a className={styles.openExternal}
            href={LAB_PROVIDERS.find((provider) => provider.id === activeProvider)?.url}
            target="_blank" rel="noopener noreferrer">
            AI 사이트 열기 ↗
          </a>
        </div>
        <div className={styles.formGrid}>
          <label>표시된 모델명 (선택 · 나중에 입력 가능)
            <input value={active.model} placeholder={modelLabel(activeProvider)}
              onChange={(event) => updateActive({ model: event.target.value })} />
          </label>
          <label>이용 요금제 (선택 · 나중에 입력 가능)
            <input value={active.plan} placeholder="예: Free / Plus / Pro"
              onChange={(event) => updateActive({ plan: event.target.value })} />
          </label>
          <label>시험한 날짜
            <input type="date" value={active.testedAt}
              onChange={(event) => updateActive({ testedAt: event.target.value })} />
          </label>
        </div>
        <label className={styles.fieldLabel} htmlFor="labResponse">AI의 실제 답변 전체 붙여넣기</label>
        <textarea id="labResponse" className={styles.answerBox} value={active.response}
          placeholder="AI 답변을 생략하거나 요약하지 말고 그대로 붙여넣으세요. 출처를 검증할 수 있게 원문을 보관합니다."
          onChange={(event) => updateActive({ response: event.target.value })} rows={11} />
        <div className={styles.answerFoot}>
          <small>답변 길이 {active.response.trim().length.toLocaleString()}자 · 자동 대조 즉시 반영 · 기존 내용 보존</small>
          <button type="button" className={styles.smallAction} onClick={() => void copy(prompt, "공통 질문")}>질문 다시 복사</button>
        </div>
      </div>
    </section>


    <section className={styles.panel}>
      <span className={styles.step}>STEP 03 · 정답표 자동 대조</span>
      <h2>직접 채점하지 마세요. 답변을 붙여넣으면 자동으로 계산합니다.</h2>
      <p className={styles.muted}>AI마다 표·문단·목록 형식이 달라도 오류 항목과 수정값을 찾아 대조합니다. 맥락이 불명확하면 임의로 0점 처리하지 않고 '판독 보류'로 따로 표시합니다.</p>
      {!allAnswersReady ? (
        <div className={styles.scoreStatus}>
          <span>현재 {autoEvaluated}/3개 답변 인식</span>
          <b>나머지 답변을 붙여넣으면 세 AI의 결과를 한 번에 공개합니다.</b>
          <small>공정한 블라인드 테스트를 위해 답변 3개를 수집하기 전에는 PDF의 정답 숫자를 공개하지 않습니다. 모델명·요금제는 채점 필수 입력이 아닙니다.</small>
        </div>
      ) : (
        <>
          <div className={styles.scoreStatus}>
            <span>{LAB_PROVIDERS.find((provider) => provider.id === activeProvider)?.label} 자동 대조</span>
            <b>수정값 확인 {activeScore.found}/5 · 부분 {activeScore.partial} · 미발견 {activeScore.missed} · 판독 보류 {activeScore.uncertain}</b>
            <small>동일 오류의 항목명과 수정 숫자가 실제 답변에서 연결되는지 검사합니다. 오탐(정상 값을 오류로 지적)은 자동으로 확정할 수 없어 미평가로 둡니다.</small>
          </div>
          <div className={styles.gradeGrid}>
            {LAB_ISSUES.map((issue, index) => {
              const result = activeScore.details.find((item) => item.id === issue.id);
              const verdict = result?.verdict || "unreviewed";
              const verdictName = verdict === "found" ? "수정값 확인" :
                verdict === "partial" ? "부분 발견" : verdict === "missed" ? "수정 근거 미발견" : "판독 보류";
              return <div className={styles.issue} key={issue.id}>
                <div className={styles.issueTop}>
                  <b>{index + 1}. {issue.label}</b>
                  <span>{verdictName}</span>
                </div>
                <p className={styles.corrected}>정답: {issue.corrected} <small>(PDF 기재 {issue.reported})</small></p>
                <p>{result?.explanation}</p>
                <div className={styles.excerpt}>{result?.evidence ? "AI 답변 근거: " + result.evidence : "AI 답변에서 일치하는 수정 근거를 찾지 못했습니다."}</div>
              </div>;
            })}
          </div>
          <details className={styles.reportDetails}>
            <summary>정답표와 올바른 계산식 전체 보기</summary>
            <pre>{makeLabAnswerKey()}</pre>
          </details>
        </>
      )}
    </section>

    <section className={styles.panel}>
      <span className={styles.step}>STEP 04 · 결과표와 근거 자료 만들기</span>
      <h2>독자에게 보여줄 비교 결과</h2>
      <p className={styles.muted}>검증이 끝난 AI만 비교표에 포함합니다. 미실행·미완료인 AI를 0점으로 취급하거나 전체 AI의 순위를 단정하지 않습니다.</p>
      <div className={styles.tableWrap}>
        <table className={styles.resultTable}>
          <thead><tr><th>서비스</th><th>모델</th><th>발견</th><th>부분</th><th>누락</th><th>오탐</th><th>검증</th></tr></thead>
          <tbody>{LAB_PROVIDERS.map((provider) => {
            const run = runs[provider.id];
            const score = scoreAutoRun(run);
            return <tr key={provider.id}>
              <td><strong>{provider.label}</strong></td>
              <td>{run.model || "—"}</td>
              <td>{score.complete ? score.found + "/5" : "—"}</td>
              <td>{score.complete ? score.partial : "—"}</td>
              <td>{score.complete ? score.missed : "—"}</td>
              <td>{score.complete ? score.falsePositives : "—"}</td>
              <td>{score.complete ? "수동 검증 완료" : "미완료"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className={styles.outputActions}>
        <button type="button" className={styles.primary} disabled={!completed}
          onClick={() => void copy(report, "수동 검증 결과 리포트")}>
          검증 리포트 복사
        </button>
        <button type="button" className={styles.secondary} disabled={!completed}
          onClick={() => void copy(articlePrompt, "영문 Blogger 원고 작성 요청서")}>
          영문 포스팅 요청서 복사
        </button>
        <button type="button" className={styles.primary} disabled={!completed} onClick={sendToQueue}>
          검증된 실험을 발행 큐로 등록 →
        </button>
        <button type="button" className={styles.secondary} disabled={!answered || exporting}
          onClick={() => void exportArchive()}>
          {exporting ? "ZIP 생성 중…" : "근거 전체 ZIP 백업 ↓"}
        </button>
        <a className={styles.scheduleLink} href="/google-blog-schedule">기존 발행 스케줄 ↗</a>
      </div>
      <details className={styles.reportDetails}><summary>내보낼 검증 리포트 미리보기</summary>
        <pre>{report}</pre></details>
      <p className={styles.warning}>ZIP에는 비공개 정답표와 AI별 원문 답변이 함께 들어갑니다. 테스트가 끝난 뒤 백업하고, 공개할 때는 파일별로 선별하세요. 자동 점수 판정이나 AI API 호출은 수행하지 않습니다.</p>
      <div className={styles.endActions}>
        <button type="button" className={styles.reset} onClick={resetTest}>이 실험 기록 초기화</button>
        <small>데이터는 브라우저 로컬 저장소에만 남습니다. 다른 PC로 옮기려면 ZIP을 별도로 보관하세요.</small>
      </div>
    </section>
    {notice && <div className={styles.toast} role="status">{notice}
      <button type="button" aria-label="안내 닫기" onClick={() => setNotice("")}>×</button>
    </div>}
  </main>;
}
