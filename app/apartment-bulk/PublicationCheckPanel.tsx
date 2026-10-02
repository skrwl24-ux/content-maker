"use client";

import { useMemo } from "react";
import { auditApartmentArticle } from "../../lib/apartment-publish-check.mjs";
import type { ApartmentStoryCandidate, ApartmentStoryMode } from "../../lib/apartment-story.mjs";
import type { AuditMonth, SourceAudit } from "../../lib/apartment-numeric-audit.mjs";
import styles from "./page.module.css";

export default function PublicationCheckPanel({
  mode, name, body, plan, dataSummary = "", numericReference = null, autoStoryEnabled = true,
}: {
  mode: ApartmentStoryMode;
  name: string;
  body: string;
  plan: ApartmentStoryCandidate | null;
  dataSummary?: string;
  autoStoryEnabled?: boolean;
  numericReference?: { monthly: AuditMonth[]; latestTradePrice?: number | null; sourceKind?: "db" | "input"; sourceAudit?: SourceAudit | null } | null;
}) {
  const result = useMemo(() => auditApartmentArticle({ mode, name, body, plan, dataSummary, numericReference, autoStoryEnabled }),
    [mode, name, body, plan, dataSummary, numericReference, autoStoryEnabled]);
  const warnings = result.checks.filter(item => item.status === "warning");
  const reviews = result.checks.filter(item => item.status === "review");
  const passes = result.checks.filter(item => item.status === "pass");
  return (
    <section className={styles.publishAudit} aria-live="polite">
      <div className={styles.publishAuditHeading}>
        <div>
          <b>발행 전 자동 검사 · V3.1</b>
          <span>완성글을 붙여넣으면 사이트의 월별 실거래·개별 계약 데이터와 가격·거래량·증감 수치를 자동 대조합니다. 이미지 위치와 태그도 함께 검사합니다.</span>
        </div>
        <strong>{!result.ready ? "원고 대기" : warnings.length ? "확인 " + warnings.length + "건" : "텍스트 구조 확인"}</strong>
      </div>
      {result.ready && (
        <div className={styles.publishAuditStats}>
          <span>형식 검사 통과 {passes.length}</span>
          <span>수정·확인 {warnings.length}</span>
          <span>추가 확인 {reviews.length}</span>
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
      <p>자동 수치 검사는 원고와 사이트의 월별 통계 자료를 대조합니다. DB 개별 계약 재계산은 별도로 표시하며, 국토부 실시간 원문 API 직접 확인이나 외부 장소·지도·사진의 진위를 검증했다는 뜻은 아닙니다.</p>
    </section>
  );
}
