"use client";

import { useMemo } from "react";
import { auditApartmentArticle } from "../../lib/apartment-publish-check.mjs";
import type { ApartmentStoryCandidate, ApartmentStoryMode } from "../../lib/apartment-story.mjs";
import styles from "./page.module.css";

export default function PublicationCheckPanel({
  mode, name, body, plan, dataSummary = "", sourceData = null,
}: {
  mode: ApartmentStoryMode;
  name: string;
  body: string;
  plan: ApartmentStoryCandidate | null;
  dataSummary?: string;
  sourceData?: { area?: string; recentPrice?: string; previousPrice?: string; monthly?: Array<{ month: string; medianPrice: number | null; tradeCount: number }> } | null;
}) {
  const result = useMemo(() => auditApartmentArticle({ mode, name, body, plan, dataSummary, sourceData }),
    [mode, name, body, plan, dataSummary, sourceData]);
  const warnings = result.checks.filter(item => item.status === "warning");
  const reviews = result.checks.filter(item => item.status === "review");
  const passes = result.checks.filter(item => item.status === "pass");
  return (
    <section className={styles.publishAudit} aria-live="polite">
      <div className={styles.publishAuditHeading}>
        <div>
          <b>발행 전 자동 검사 · V3.1</b>
          <span>완성글을 붙여넣으면 이미지 위치·태그뿐 아니라 가격·거래량·변화율도 사이트 원본 실거래 데이터와 자동 대조합니다.</span>
        </div>
        <strong>{!result.ready ? "원고 대기" : warnings.length ? "확인 " + warnings.length + "건" : "텍스트 구조 확인"}</strong>
      </div>
      {result.ready && (
        <div className={styles.publishAuditStats}>
          <span>형식 검사 통과 {passes.length}</span>
          <span>수정·확인 {warnings.length}</span>
          <span>외부 원문 확인 {reviews.length}</span>
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
      <p>가격·거래량·변화율은 사이트의 실거래 원본과 자동 대조합니다. 외부 장소·영업 여부·지도·경로는 바로 아래 '생활정보 웹 검증하기'에서 GPT 웹 검색 결과와 실제 원문 링크를 받아 확인하세요.</p>
    </section>
  );
}
