"use client";

import { useState } from "react";
import {
  lifeAuditRequestId, makeLifeVerificationPrompt,
  parseLifeVerificationResult, applyLifeVerificationChanges, isLifeVerificationChangeApplicable,
} from "../../lib/apartment-life-audit.mjs";
import type { ApartmentStoryMode } from "../../lib/apartment-story.mjs";
import styles from "./page.module.css";

type LifeItem = {
  id: string; topic: string; status: "confirmed" | "update" | "unverified";
  original: string; recommendedText: string; finding: string;
  sourceTitle: string; sourceUrl: string; sourceDate: string; matchCount: number;
};
type LifeReport = {
  requestId: string; name: string; summary: string; checkedAt: string; checks: LifeItem[];
};

export default function LifeVerificationPanel({
  mode, name, region, body, placeName = "", onBodyChange,
}: {
  mode: ApartmentStoryMode; name: string; region: string; body: string;
  placeName?: string; onBodyChange: (next: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [report, setReport] = useState<LifeReport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const available = !!body.trim() && !!name.trim();
  const stale = !!report && report.requestId !== lifeAuditRequestId(name, body);
  const claims = report?.checks || [];
  const confirmed = claims.filter(item => item.status === "confirmed").length;
  const updates = claims.filter(item => item.status === "update").length;
  const uncertain = claims.filter(item => item.status === "unverified").length;

  const getPrompt = () => makeLifeVerificationPrompt({ mode, name, region, body, placeName });

  function openResearch() {
    if (!available) return;
    const prompt = getPrompt();
    setReport(null);
    setSelected([]);
    setMessage("");
    if (prompt.length > 6500) {
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      void navigator.clipboard.writeText(prompt).then(() =>
        setMessage("원고가 길어서 검증 요청서를 복사하고 ChatGPT를 열었습니다. 새 채팅에 Ctrl+V로 붙여넣어 주세요.")
      ).catch(() => setMessage("ChatGPT를 열었습니다. 요청서 복사 버튼을 눌러 본문을 전달해 주세요."));
    } else {
      window.open("https://chatgpt.com/?q=" + encodeURIComponent(prompt), "_blank", "noopener,noreferrer");
      setMessage("ChatGPT에 웹 검색을 요청했습니다. [LOCAL_AUDIT_JSON] 블록까지 결과 전체를 아래에 붙여넣으세요.");
    }
  }
  async function copyPrompt() {
    if (!available) return;
    try {
      await navigator.clipboard.writeText(getPrompt());
      setMessage("현재 원고를 포함한 생활정보 웹 검증 요청서를 복사했습니다. 웹 검색이 가능한 ChatGPT 채팅에 붙여넣으세요.");
    } catch {
      setMessage("클립보드 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  }
  function importReport() {
    try {
      const parsed = parseLifeVerificationResult(raw, { name, body }) as LifeReport;
      // A parsed report is tied to this exact draft. Apply unique, sourced
      // corrections (or unsupported-claim deletions) in one guarded pass.
      const applicable = parsed.checks
        .filter(item => item.matchCount === 1 && isLifeVerificationChangeApplicable(item))
        .map(item => item.id);
      if (applicable.length) {
        const result = applyLifeVerificationChanges(body, parsed, applicable);
        if (result.applied) {
          onBodyChange(result.body);
          setReport(null);
          setSelected([]);
          setRaw("");
          setMessage(result.applied + "곳의 안전한 수정 문장을 본문에 자동 반영했습니다." +
            (result.skipped ? " " + result.skipped + "곳은 원문 불일치로 적용하지 않았습니다." : "") +
            " 가격·거래 데이터는 별도 자동 검사가 계속 대조합니다.");
          return;
        }
      }
      setReport(parsed);
      setSelected([]);
      setMessage("검증 결과를 읽었습니다. 자동 수정할 문장이 없거나 현재 본문과 정확히 일치하지 않습니다.");
    } catch (error) {
      setReport(null);
      setSelected([]);
      setMessage(error instanceof Error ? error.message : "검증 결과를 읽을 수 없습니다.");
    }
  }
  function toggle(id: string, checked: boolean) {
    setSelected(previous => checked ? [...previous.filter(item => item !== id), id] : previous.filter(item => item !== id));
  }
  function applySelected() {
    if (!report || stale) {
      setMessage("현재 원고가 검증 요청 당시와 달라졌습니다. 새로 웹 검증을 진행해 주세요.");
      return;
    }
    const result = applyLifeVerificationChanges(body, report, selected);
    if (!result.applied) {
      setMessage("안전하게 일치하는 수정 구간이 없습니다. 해당 원문 문장과 교체 문장을 비교한 뒤 수동 편집해 주세요.");
      return;
    }
    onBodyChange(result.body);
    setReport(null);
    setSelected([]);
    setRaw("");
    setMessage(result.applied + "곳의 문장을 최종편집 본문에 반영했습니다." +
      (result.skipped ? " " + result.skipped + "곳은 원문이 달라 자동 적용하지 않았습니다." : "") +
      " 본문이 변경됐으므로 필요하면 웹 검증을 다시 진행하고, 자동 실거래 검사가 그대로 통과하는지도 확인해 주세요.");
  }

  return (
    <section className={styles.lifeAuditPanel} aria-live="polite">
      <div className={styles.lifeAuditHeading}>
        <div>
          <b>생활정보 웹 검증하기 · V3.3</b>
          <span>맛집·카페 운영 여부, 실제 장소, 지도 위치, 거리·도보시간을 GPT 웹 검색으로 별도 확인하는 단계입니다.</span>
        </div>
        <strong>{!available ? "완성글 대기" : report && !stale ? "결과 " + claims.length + "건" : "웹 조사 가능"}</strong>
      </div>
      <p className={styles.lifeAuditNote}>사이트는 실거래 숫자를 자체 데이터와 대조합니다. 생활정보는 ChatGPT에서 실제 웹을 조사한 결과를 이곳에 받아와 원문 링크와 수정 문장으로 확인합니다. 사이트 자체가 웹 원문을 자동 열람했다는 뜻은 아닙니다.</p>
      <div className={styles.lifeAuditActions}>
        <button type="button" className={styles.lifeAuditPrimary} disabled={!available} onClick={openResearch}>① ChatGPT에서 생활정보 웹 검증</button>
        <button type="button" disabled={!available} onClick={() => void copyPrompt()}>검증 요청서 복사</button>
      </div>
      <label className={styles.lifeAuditLabel}>
        <b>② GPT 검증 결과 붙여넣기 · 안전한 수정 자동 반영</b>
        <textarea value={raw} onChange={event => setRaw(event.target.value)}
          placeholder="[LOCAL_AUDIT_JSON]부터 [/LOCAL_AUDIT_JSON]까지 GPT의 검증 결과 전체를 붙여넣으세요."
          rows={4}/>
      </label>
      <div className={styles.lifeAuditActions}>
        <button type="button" disabled={!available || !raw.trim()} onClick={importReport}>검증 결과 읽고 본문 자동 수정</button>
      </div>
      {message && <p className={styles.lifeAuditMessage}>{message}</p>}
      {report && stale && <p className={styles.lifeAuditAlert}>검증 이후 원고 또는 대상 단지가 변경됐습니다. 이전 결과는 적용할 수 없으니 현재 본문으로 다시 조사해 주세요.</p>}
      {report && !stale && (
        <div className={styles.lifeAuditResults}>
          <div className={styles.lifeAuditCounts}>
            <span>원문 근거 제시 {confirmed}</span>
            <span>수정 제안 {updates}</span>
            <span>확인 부족 {uncertain}</span>
          </div>
          <p className={styles.lifeAuditSummary}>{report.checkedAt ? report.checkedAt + " 조사 · " : ""}{report.summary}</p>
          {!claims.length && <p className={styles.lifeAuditNote}>GPT가 이 원고에서 별도로 조사할 외부 생활정보 주장을 찾지 못했습니다. 숫자 검사는 위 발행 전 자동 검사를 참고하세요.</p>}
          {claims.map(item => {
            const canApply = item.matchCount === 1 && isLifeVerificationChangeApplicable(item);
            return (
              <article className={styles.lifeAuditItem} key={item.id}>
                <div className={styles.lifeAuditItemHead}>
                  <b>{item.topic || "생활정보"}</b>
                  <span>{item.status === "confirmed" ? "원문 근거 제시" : item.status === "update" ? "수정 필요" : "근거 미확인"}</span>
                </div>
                {item.original && <p><b>원고 문장</b> {item.original}</p>}
                <p><b>조사 결과</b> {item.finding || "상세 조사 내용 없음"}</p>
                {item.sourceUrl && <p><b>확인할 원문</b> <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceTitle || "출처 열기"} ↗</a>{item.sourceDate ? " · " + item.sourceDate : ""}</p>}
                {!item.sourceUrl && <p className={styles.lifeAuditAlert}>원문 링크 없음 · 이 내용은 확인 완료로 취급하지 않습니다.</p>}
                {(item.status !== "confirmed") && <>
                  <p><b>수정 제안</b> {item.recommendedText || "해당 문장 삭제"}</p>
                  {item.matchCount !== 1 && <p className={styles.lifeAuditAlert}>현재 본문에서 원문 문장 {item.matchCount}곳 발견. 정확히 한 번만 일치해야 자동 변경할 수 있습니다.</p>}
                  {canApply ? <label className={styles.lifeAuditPick}>
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={event => toggle(item.id, event.target.checked)} />
                    이 수정안을 검토했고 본문에 적용합니다.
                  </label> : <p className={styles.lifeAuditNote}>자동 적용 조건이 맞지 않습니다. 필요하면 최종편집에서 직접 반영해 주세요. 근거 없는 새로운 문장은 자동으로 넣지 않습니다.</p>}
                </>}
              </article>
            );
          })}
          <div className={styles.lifeAuditActions}>
            <button type="button" className={styles.lifeAuditPrimary} disabled={!selected.length} onClick={applySelected}>
              ③ 선택한 수정 문장 {selected.length}곳 본문에 적용
            </button>
          </div>
          <p className={styles.lifeAuditNote}>AI 조사 결과는 원문 링크와 문장을 확인하기 위한 보조 자료입니다. 영업 여부·실제 지도 경로의 최신 상태를 사이트가 독립적으로 보증하지는 않습니다. 근거가 없는 이동 수치는 본문과 03번 이미지에서 제외해 주세요.</p>
        </div>
      )}
    </section>
  );
}
