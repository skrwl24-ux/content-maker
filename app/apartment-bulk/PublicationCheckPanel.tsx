"use client";

import { useMemo } from "react";
import { auditApartmentArticle } from "../../lib/apartment-publish-check.mjs";
import type { ApartmentStoryCandidate, ApartmentStoryMode } from "../../lib/apartment-story.mjs";
import styles from "./page.module.css";

export default function PublicationCheckPanel({
  mode, name, body, plan, dataSummary = "",
}: {
  mode: ApartmentStoryMode;
  name: string;
  body: string;
  plan: ApartmentStoryCandidate | null;
  dataSummary?: string;
}) {
  const result = useMemo(() => auditApartmentArticle({ mode, name, body, plan, dataSummary }),
    [mode, name, body, plan, dataSummary]);
  const warnings = result.checks.filter(item => item.status === "warning");
  const reviews = result.checks.filter(item => item.status === "review");
  const passes = result.checks.filter(item => item.status === "pass");
  return (
    <section className={styles.publishAudit} aria-live="polite">
      <div className={styles.publishAuditHeading}>
        <div>
          <b>발행 전 자동 검사 · V3.1</b>
          <span>완성글을 붙여넣으면 이미지 위치·태그·장소명·새로운 이동 숫자를 즉시 대조합니다.</span>
        </div>
        <strong>{!result.ready ? "원고 대기" : warnings.length ? "확인 " + warnings.length + "건" : "텍스트 구조 확인"}</strong>
      </div>
      {result.ready && (
        <div className={styles.publishAuditStats}>
          <span>형식 검사 통과 {passes.length}</span>
          <span>수정·확인 {warnings.length}</span>
          <span>원문 직접 확인 {reviews.length}</span>
        </div>
      )}
      <div className={styles.publishAuditList}>
        {result.checks.map((check, index) => (
          <div key={check.label + index} className={check.status === "warning"
            ? styles.publishAuditWarning : check.status === "pass" ? styles.publishAuditPass : styles.publishAuditReview}>
            <b>{check.status === "warning" ? "!" : check.status === "pass" ? "✓" : "·"} {check.label}</b>
            <span>{check.detail}</span>
          </div>
        ))}
      </div>
      <p>이 검사는 원고의 문자열과 잠근 기획 카드를 비교합니다. 실제 실거래 계약, 가게 영업 여부, 외부 원문·지도·사진 내용까지 자동 검증한 것은 아닙니다.</p>
    </section>
  );
}
