"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { ensureAnonymousSession } from "../../lib/supabase-browser";
import {
  ApartmentRankingRow,
  AreaSnapshot,
  DataSnapshot,
  DEFAULT_CHART_TEMPLATE,
  DEFAULT_FINAL_ARTICLE_TEMPLATE,
  DEFAULT_LIFE_IMAGE_PROMPT_TEMPLATE,
  DEFAULT_LIFE_KICK_PROMPT_TEMPLATE,
  DEFAULT_STRUCTURE_PROMPT_TEMPLATE,
  DEFAULT_THUMBNAIL_PROMPT_TEMPLATE,
  buildChartPrompt,
  buildDataSnapshot,
  buildFinalArticlePrompt,
  buildLifeImagePrompt,
  buildLifeKickPrompt,
  buildStructurePrompt,
  buildThumbnailPrompt,
  formatWon,
  safeParseJson,
} from "../../lib/apartment-content-v1";
import {
  apartmentV1NaverPlainText,
  apartmentV1NaverRichHtml,
  auditApartmentV1Article,
  parseApartmentV1Naver,
} from "../../lib/apartment-v1-naver";

type RecommendationRow = {
  id: string;
  user_id: string;
  year: number;
  slot_no: number;
  complex_id: string;
  article_id: string | null;
  status: "recommended" | "working" | "replaceable";
};

type ArticleRow = {
  id: string;
  user_id: string;
  complex_id: string;
  reference_date: string;
  status: "draft" | "preparing" | "ready" | "published";
  data_status: "pending" | "pass" | "warning";
  data_snapshot: Record<string, unknown>;
  data_check_result: Record<string, unknown>;
  structure_mode: "include" | "exclude";
  structure_snapshot: unknown[];
  kick_status: "pending" | "verified" | "not_found";
  kick_title: string;
  kick_summary: string;
  kick_source_text: string;
  kick_snapshot: Record<string, unknown>;
  final_article: string;
  naver_formatted: string;
};

type StructureRow = {
  id?: string;
  user_id: string;
  complex_id: string;
  area_group: number;
  room_count: number | null;
  bath_count: number | null;
  status: "verified" | "varies" | "needs_check";
  source_text: string;
};

type TemplateRow = {
  id?: string;
  template_key: string;
  name: string;
  is_active: boolean;
  template_text: string;
  reference_image_url: string;
};

type TextPromptKey =
  | "APT_FINAL_ARTICLE_V1"
  | "APT_STRUCTURE_V1"
  | "APT_LIFE_KICK_V1"
  | "APT_LIFE_IMAGE_V1"
  | "APT_THUMBNAIL_V1";

const TEXT_PROMPT_DEFINITIONS: Record<TextPromptKey, {
  name: string;
  defaultText: string;
  description: string;
  placeholders: string[];
}> = {
  APT_FINAL_ARTICLE_V1: {
    name: "최종 글 요청서",
    defaultText: DEFAULT_FINAL_ARTICLE_TEMPLATE,
    description: "핵심 POINT · 목차 · 가격 · 구조 · 생활 킥 · Q&A · 마무리의 최종 글 구성입니다.",
    placeholders: ["{{TITLE}}", "{{COMPLEX_DATA_BLOCK}}", "{{DATA_BLOCK}}", "{{STRUCTURE_DATA_BLOCK}}", "{{LIFE_KICK_BLOCK}}", "{{TOC_BLOCK}}", "{{SOURCE_LINE}}"],
  },
  APT_STRUCTURE_V1: {
    name: "평형 구조 조사 요청서",
    defaultText: DEFAULT_STRUCTURE_PROMPT_TEMPLATE,
    description: "평형별 방·욕실과 타입 차이를 웹에서 조사하는 요청서입니다.",
    placeholders: ["{{COMPLEX_NAME}}", "{{AREA_LIST}}"],
  },
  APT_LIFE_KICK_V1: {
    name: "생활·입지 조사 요청서",
    defaultText: DEFAULT_LIFE_KICK_PROMPT_TEMPLATE,
    description: "생활 킥 1개와 검증 가능한 도보 정보를 조사하는 요청서입니다.",
    placeholders: ["{{COMPLEX_NAME}}", "{{ADDRESS}}", "{{YEAR}}"],
  },
  APT_LIFE_IMAGE_V1: {
    name: "생활 킥 이미지 요청서",
    defaultText: DEFAULT_LIFE_IMAGE_PROMPT_TEMPLATE,
    description: "저장된 생활 킥만 사용해 본문 이미지를 만드는 요청서입니다.",
    placeholders: ["{{COMPLEX_NAME}}", "{{KICK_TITLE}}", "{{KICK_SUMMARY}}"],
  },
  APT_THUMBNAIL_V1: {
    name: "썸네일 요청서",
    defaultText: DEFAULT_THUMBNAIL_PROMPT_TEMPLATE,
    description: "단지명과 고정 제목을 넣어 썸네일을 만드는 요청서입니다.",
    placeholders: ["{{TITLE}}"],
  },
};

function defaultTextPromptRows(): Record<TextPromptKey, TemplateRow> {
  return Object.fromEntries(
    (Object.entries(TEXT_PROMPT_DEFINITIONS) as Array<[TextPromptKey, typeof TEXT_PROMPT_DEFINITIONS[TextPromptKey]]>)
      .map(([key, value]) => [key, {
        template_key: key,
        name: value.name,
        is_active: true,
        template_text: value.defaultText,
        reference_image_url: "",
      }])
  ) as Record<TextPromptKey, TemplateRow>;
}

type IdentityCandidate = {
  candidate_key: string;
  source_apartment_name: string;
  build_year: number | null;
  classification: string;
  raw_trade_count: number;
  area_groups: number[];
};

type ComplexIdentityState = {
  loaded: boolean;
  kaptCode: string;
  regionCode: string;
  legalDong: string;
  lot: string;
  address: string;
  roadAddress: string;
  unresolved: IdentityCandidate[];
};

type MonthCoverageRow = {
  year_month: string;
  fetched_at: string;
  raw_trade_count: number;
};

function expectedCoverageMonths(referenceDate: string) {
  const year = referenceDate.slice(0, 4);
  const endMonth = Math.max(1, Math.min(12, Number(referenceDate.slice(5, 7)) || 12));
  return Array.from({ length: endMonth }, (_, index) =>
    year + "-" + String(index + 1).padStart(2, "0")
  );
}

function kstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function kstDateFromTimestamp(value: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year && values.month && values.day
    ? values.year + "-" + values.month + "-" + values.day
    : "";
}

function normalizeName(value: string) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/아파트/g, "")
    .replace(/[\s·ㆍ.\-_,()[\]{}]/g, "")
    .trim();
}

function displayLocation(item: ApartmentRankingRow) {
  return [item.sido, item.sigungu, item.legal_dong].filter(Boolean).join(" ");
}

function normalizeCadastralLot(value: string) {
  const raw = String(value || "").normalize("NFKC").replace(/\s+/g, "");
  const parts = raw.match(/^(산)?(\d+)(?:-(\d+))?$/);
  if (!parts) return "";
  return (parts[1] || "") + String(Number(parts[2])) +
    (parts[3] == null ? "" : "-" + String(Number(parts[3])));
}

function extractCadastralLot(address: string, legalDong: string) {
  const source = String(address || "");
  const dong = String(legalDong || "").trim();
  if (!source || !dong) return "";
  const index = source.indexOf(dong);
  if (index < 0) return "";
  const tail = source.slice(index + dong.length).trim();
  const match = tail.match(/^((?:산\s*)?\d+(?:-\d+)?)(?=\s|$)/);
  return match ? normalizeCadastralLot(match[1]) : "";
}

function areaRangeText(area: AreaSnapshot) {
  if (Math.abs(area.exclusiveMin - area.exclusiveMax) < 0.05) {
    return "전용 " + area.exclusiveMin.toFixed(1).replace(/\.0$/, "") + "㎡";
  }
  return "전용 " + area.exclusiveMin.toFixed(1) + "~" + area.exclusiveMax.toFixed(1) + "㎡";
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause) {
    const message = String((cause as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

export default function ApartmentV1Page() {
  const supabaseRef = useRef<any>(null);
  const userIdRef = useRef("");
  const accessTokenRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rankings, setRankings] = useState<ApartmentRankingRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [rankScopeLabel, setRankScopeLabel] = useState("현재 수집 범위");
  const [workspace, setWorkspace] = useState<ApartmentRankingRow | null>(null);
  const [article, setArticle] = useState<ArticleRow | null>(null);
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [identityState, setIdentityState] = useState<ComplexIdentityState>({
    loaded: false,
    kaptCode: "",
    regionCode: "",
    legalDong: "",
    lot: "",
    address: "",
    roadAddress: "",
    unresolved: [],
  });
  const [tradeCoverage, setTradeCoverage] = useState<MonthCoverageRow[]>([]);
  const [structureRaw, setStructureRaw] = useState("");
  const [lifeRaw, setLifeRaw] = useState("");
  const [finalRaw, setFinalRaw] = useState("");
  const [naverApplied, setNaverApplied] = useState(false);
  const [naverCopyMessage, setNaverCopyMessage] = useState("");
  const [publishAuditVisible, setPublishAuditVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"prompts" | "chart">("prompts");
  const [selectedPromptKey, setSelectedPromptKey] = useState<TextPromptKey>("APT_FINAL_ARTICLE_V1");
  const [promptTemplates, setPromptTemplates] = useState<Record<TextPromptKey, TemplateRow>>(() => defaultTextPromptRows());
  const [chartTemplate, setChartTemplate] = useState<TemplateRow>({
    template_key: "APT_PRICE_FLOW_V1",
    name: "평형별 가격 흐름 V1",
    is_active: true,
    template_text: DEFAULT_CHART_TEMPLATE,
    reference_image_url: "",
  });

  const year = Number(kstDate().slice(0, 4));

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(label + " 복사 완료");
    } catch {
      setError("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  }, [notify]);

  const openInChatGPT = useCallback((prompt: string) => {
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const rankingMap = useMemo(() => {
    return new Map(rankings.map((item) => [item.complex_id, item]));
  }, [rankings]);

  const loadTemplates = useCallback(async () => {
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    if (!supabase || !userId) return;

    const keys = ["APT_PRICE_FLOW_V1", ...Object.keys(TEXT_PROMPT_DEFINITIONS)];
    const { data, error: loadError } = await supabase
      .from("apt_content_prompt_templates")
      .select("id,template_key,name,is_active,template_text,reference_image_url")
      .eq("user_id", userId)
      .in("template_key", keys);
    if (loadError) throw loadError;

    const existing = new Map<string, TemplateRow>(
      ((data || []) as TemplateRow[]).map((row) => [row.template_key, row])
    );
    const missingRows: any[] = [];

    const chart = existing.get("APT_PRICE_FLOW_V1");
    if (chart) {
      setChartTemplate(chart);
    } else {
      missingRows.push({
        user_id: userId,
        template_key: "APT_PRICE_FLOW_V1",
        name: "평형별 가격 흐름 V1",
        is_active: true,
        template_text: DEFAULT_CHART_TEMPLATE,
        reference_image_url: "",
      });
    }

    const nextTextRows = defaultTextPromptRows();
    (Object.keys(TEXT_PROMPT_DEFINITIONS) as TextPromptKey[]).forEach((key) => {
      const row = existing.get(key);
      if (row) {
        nextTextRows[key] = row;
      } else {
        const definition = TEXT_PROMPT_DEFINITIONS[key];
        missingRows.push({
          user_id: userId,
          template_key: key,
          name: definition.name,
          is_active: true,
          template_text: definition.defaultText,
          reference_image_url: "",
        });
      }
    });
    setPromptTemplates(nextTextRows);

    if (missingRows.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("apt_content_prompt_templates")
        .upsert(missingRows, { onConflict: "user_id,template_key", ignoreDuplicates: true })
        .select("id,template_key,name,is_active,template_text,reference_image_url");
      if (insertError) throw insertError;
      const insertedMap = new Map<string, TemplateRow>(
        ((inserted || []) as TemplateRow[]).map((row) => [row.template_key, row])
      );
      if (insertedMap.has("APT_PRICE_FLOW_V1")) {
        setChartTemplate(insertedMap.get("APT_PRICE_FLOW_V1") as TemplateRow);
      }
      if (inserted?.length) {
        setPromptTemplates((current) => {
          const next = { ...current };
          (Object.keys(TEXT_PROMPT_DEFINITIONS) as TextPromptKey[]).forEach((key) => {
            const row = insertedMap.get(key);
            if (row) next[key] = row;
          });
          return next;
        });
      }
    }
  }, []);
  const loadHome = useCallback(async () => {
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    if (!supabase || !userId) return;

    setLoading(true);
    setError("");
    try {
      const [rankingResult, regionResult, historyResponse] = await Promise.all([
        supabase
          .from("apt_content_year_ranking")
          .select("*")
          .eq("year", year)
          .order("national_rank", { ascending: true })
          .limit(80),
        supabase
          .from("apt_tracked_regions")
          .select("sido_name")
          .eq("enabled", true),
        fetch("/api/publish-history", { cache: "no-store" }).then((response) => response.ok ? response.json() : { items: [] }),
      ]);

      if (rankingResult.error) throw rankingResult.error;
      const rankingRows = (rankingResult.data || []) as ApartmentRankingRow[];
      setRankings(rankingRows);

      const sidoCount = new Set((regionResult.data || []).map((row: any) => row.sido_name).filter(Boolean)).size;
      const scopeLabel = sidoCount >= 17 ? "전국" : "현재 수집 범위";
      setRankScopeLabel(scopeLabel);

      const historyItems = Array.isArray(historyResponse?.items) ? historyResponse.items : [];
      const publishedIds = new Set(
        historyItems
          .filter((item: any) => item.item_type === "complex" && String(item.published_on || "").startsWith(String(year)))
          .map((item: any) => String(item.complex_id || ""))
          .filter(Boolean)
      );
      const publishedNames = new Set(
        historyItems
          .filter((item: any) => item.item_type === "complex" && String(item.published_on || "").startsWith(String(year)))
          .map((item: any) => normalizeName(item.complex_name || item.title || ""))
          .filter(Boolean)
      );

      let { data: poolRows, error: poolError } = await supabase
        .from("apt_content_candidate_pool")
        .select("complex_id,rank,transaction_count,status")
        .eq("user_id", userId)
        .eq("year", year)
        .order("rank", { ascending: true });
      if (poolError) throw poolError;
      poolRows = poolRows || [];

      const activeCount = poolRows.filter((row: any) => row.status === "ready" || row.status === "reserved").length;
      if (activeCount <= 3) {
        const existing = new Set(poolRows.map((row: any) => row.complex_id));
        const candidates = rankingRows.filter((row) => {
          if (existing.has(row.complex_id)) return false;
          if (publishedIds.has(row.complex_id)) return false;
          if (publishedNames.has(normalizeName(row.name))) return false;
          return true;
        }).slice(0, Math.max(0, 20 - activeCount));

        if (candidates.length) {
          const { error: insertError } = await supabase
            .from("apt_content_candidate_pool")
            .insert(candidates.map((row) => ({
              user_id: userId,
              year,
              complex_id: row.complex_id,
              rank: row.national_rank,
              transaction_count: row.transaction_count,
              status: "ready",
            })));
          if (insertError) throw insertError;
          const refreshed = await supabase
            .from("apt_content_candidate_pool")
            .select("complex_id,rank,transaction_count,status")
            .eq("user_id", userId)
            .eq("year", year)
            .order("rank", { ascending: true });
          if (refreshed.error) throw refreshed.error;
          poolRows = refreshed.data || [];
        }
      }

      let { data: recRows, error: recError } = await supabase
        .from("apt_content_recommendations")
        .select("id,user_id,year,slot_no,complex_id,article_id,status")
        .eq("user_id", userId)
        .eq("year", year)
        .order("slot_no", { ascending: true });
      if (recError) throw recError;
      recRows = recRows || [];

      const used = new Set(recRows.map((row: any) => row.complex_id));
      for (const slotNo of [1, 2]) {
        if (recRows.some((row: any) => row.slot_no === slotNo)) continue;
        const next = poolRows.find((row: any) => row.status === "ready" && !used.has(row.complex_id));
        if (!next) break;
        const { data: inserted, error: insertRecError } = await supabase
          .from("apt_content_recommendations")
          .insert({
            user_id: userId,
            year,
            slot_no: slotNo,
            complex_id: next.complex_id,
            status: "recommended",
          })
          .select("id,user_id,year,slot_no,complex_id,article_id,status")
          .single();
        if (insertRecError) throw insertRecError;
        await supabase
          .from("apt_content_candidate_pool")
          .update({ status: "reserved", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("year", year)
          .eq("complex_id", next.complex_id);
        recRows.push(inserted);
        used.add(next.complex_id);
      }

      setRecommendations((recRows || []) as RecommendationRow[]);
      await loadTemplates();
    } catch (cause) {
      setError(errorMessage(cause, "추천 후보를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [loadTemplates, year]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase, session } = await ensureAnonymousSession();
        if (cancelled) return;
        supabaseRef.current = supabase;
        userIdRef.current = session.user.id;
        accessTokenRef.current = session.access_token || "";
        await loadHome();
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "초기화에 실패했습니다.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHome]);

  const loadWorkspace = useCallback(async (articleRow: ArticleRow, complex: ApartmentRankingRow) => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    setBusy("workspace");
    setError("");
    setTradeCoverage([]);
    setIdentityState({
      loaded: false,
      kaptCode: "",
      regionCode: "",
      legalDong: "",
      lot: "",
      address: "",
      roadAddress: "",
      unresolved: [],
    });
    try {
      const referenceDate = articleRow.reference_date || kstDate();
      const yearStart = referenceDate.slice(0, 4) + "-01-01";
      const [tradeResult, structureResult, identityResult] = await Promise.all([
        supabase
          .from("apt_trades")
          .select("contract_date,exclusive_area,area_group,price_won")
          .eq("complex_id", complex.complex_id)
          .eq("cancelled", false)
          .gte("contract_date", yearStart)
          .lte("contract_date", referenceDate)
          .order("contract_date", { ascending: true })
          .limit(1000),
        supabase
          .from("apt_content_area_structures")
          .select("id,user_id,complex_id,area_group,room_count,bath_count,status,source_text")
          .eq("user_id", userIdRef.current)
          .eq("complex_id", complex.complex_id)
          .order("area_group", { ascending: true }),
        supabase
          .from("apt_complexes")
          .select("kapt_code,region_code,legal_dong,address,road_address")
          .eq("id", complex.complex_id)
          .single(),
      ]);
      if (tradeResult.error) throw tradeResult.error;
      if (structureResult.error) throw structureResult.error;
      if (identityResult.error) throw identityResult.error;

      const identityRow = identityResult.data || {};
      const legalDong = String(identityRow.legal_dong || complex.legal_dong || "");
      const address = String(identityRow.address || complex.address || "");
      const lot = extractCadastralLot(address, legalDong);
      let unresolved: IdentityCandidate[] = [];

      if (identityRow.region_code && legalDong && lot) {
        const { data: unresolvedRows, error: unresolvedError } = await supabase
          .from("apt_unmatched_source_candidates")
          .select("candidate_key,source_apartment_name,build_year,classification,raw_trade_count,area_groups")
          .eq("region_code", identityRow.region_code)
          .eq("legal_dong", legalDong)
          .eq("jibun", lot)
          .eq("is_active", true)
          .order("raw_trade_count", { ascending: false });
        if (unresolvedError) throw unresolvedError;
        unresolved = (unresolvedRows || []) as IdentityCandidate[];
      }

      const expectedMonths = expectedCoverageMonths(referenceDate);
      let coverageRows: MonthCoverageRow[] = [];
      if (identityRow.region_code && expectedMonths.length) {
        const { data: coverageData, error: coverageError } = await supabase
          .from("apt_trade_month_coverage")
          .select("year_month,fetched_at,raw_trade_count")
          .eq("region_code", identityRow.region_code)
          .in("year_month", expectedMonths)
          .order("year_month", { ascending: true });
        if (coverageError) throw coverageError;
        coverageRows = (coverageData || []) as MonthCoverageRow[];
      }

      const coverageMap = new Map(coverageRows.map((row) => [row.year_month, row]));
      const missingCoverage = expectedMonths.filter((month) => !coverageMap.has(month));
      const currentCoverage = coverageMap.get(referenceDate.slice(0, 7));
      const currentCoverageFresh = Boolean(
        currentCoverage && kstDateFromTimestamp(currentCoverage.fetched_at) >= referenceDate
      );
      const coverageReady = missingCoverage.length === 0 && currentCoverageFresh;

      const built = buildDataSnapshot(complex, tradeResult.data || [], referenceDate, rankScopeLabel);
      const identityReady = Boolean(lot && unresolved.length === 0);
      const identityMeta = {
        source: "molit_api",
        identityStatus: identityReady ? "matched" : "review",
        kaptCode: String(identityRow.kapt_code || ""),
        regionCode: String(identityRow.region_code || ""),
        legalDong,
        jibun: lot,
        unresolvedCount: unresolved.length,
        unresolvedSourceNames: unresolved.map((item) => item.source_apartment_name),
        coverageReady,
        missingCoverage,
      };

      const { error: articleUpdateError } = await supabase
        .from("apt_content_articles")
        .update({
          data_snapshot: built,
          data_status: identityReady && coverageReady ? "pass" : "warning",
          data_check_result: identityMeta,
          structure_snapshot: structureResult.data || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", articleRow.id)
        .eq("user_id", userIdRef.current);
      if (articleUpdateError) throw articleUpdateError;

      setWorkspace(complex);
      setArticle({
        ...articleRow,
        data_status: identityReady && coverageReady ? "pass" : "warning",
        data_snapshot: built,
        data_check_result: identityMeta,
        structure_snapshot: structureResult.data || [],
      });
      setSnapshot(built);
      setTradeCoverage(coverageRows);
      setStructures((structureResult.data || []) as StructureRow[]);
      setIdentityState({
        loaded: true,
        kaptCode: String(identityRow.kapt_code || ""),
        regionCode: String(identityRow.region_code || ""),
        legalDong,
        lot,
        address,
        roadAddress: String(identityRow.road_address || complex.road_address || ""),
        unresolved,
      });
      setStructureRaw("");
      setLifeRaw("");
      setFinalRaw(articleRow.final_article || "");
      setNaverApplied(Boolean(articleRow.naver_formatted));
      setNaverCopyMessage("");
      setPublishAuditVisible(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "단지 작업을 열지 못했습니다.");
    } finally {
      setBusy("");
    }
  }, [rankScopeLabel]);
  const refreshMolitData = useCallback(async () => {
    if (!workspace || !article || !accessTokenRef.current) return;
    setBusy("molit-refresh");
    setError("");
    try {
      const response = await fetch("/api/apartment/content-sync", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessTokenRef.current,
        },
        body: JSON.stringify({ complexId: workspace.complex_id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "국토부 자료 새로고침에 실패했습니다.");
      await loadWorkspace(article, workspace);
      notify("국토부 2026년 자료 새로고침 완료");
    } catch (cause) {
      setError(errorMessage(cause, "국토부 자료 새로고침에 실패했습니다."));
    } finally {
      setBusy("");
    }
  }, [article, loadWorkspace, notify, workspace]);

  const startArticle = useCallback(async (rec: RecommendationRow, complex: ApartmentRankingRow) => {
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    if (!supabase || !userId) return;
    setBusy("start-" + rec.slot_no);
    setError("");
    try {
      let articleRow: ArticleRow;
      if (rec.article_id) {
        const { data, error: articleError } = await supabase
          .from("apt_content_articles")
          .select("*")
          .eq("id", rec.article_id)
          .eq("user_id", userId)
          .single();
        if (articleError) throw articleError;
        articleRow = data as ArticleRow;
      } else {
        const { data, error: createError } = await supabase
          .from("apt_content_articles")
          .insert({
            user_id: userId,
            complex_id: complex.complex_id,
            reference_date: kstDate(),
            status: "preparing",
          })
          .select("*")
          .single();
        if (createError) throw createError;
        articleRow = data as ArticleRow;
        const { error: recUpdateError } = await supabase
          .from("apt_content_recommendations")
          .update({
            article_id: articleRow.id,
            status: "working",
            updated_at: new Date().toISOString(),
          })
          .eq("id", rec.id)
          .eq("user_id", userId);
        if (recUpdateError) throw recUpdateError;
        setRecommendations((current) => current.map((item) => item.id === rec.id
          ? { ...item, article_id: articleRow.id, status: "working" }
          : item));
      }
      await loadWorkspace(articleRow, complex);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "글 작업을 시작하지 못했습니다.");
    } finally {
      setBusy("");
    }
  }, [loadWorkspace]);

  const refreshStructures = useCallback(async () => {
    if (!workspace) return;
    const supabase = supabaseRef.current;
    const { data, error: structureError } = await supabase
      .from("apt_content_area_structures")
      .select("id,user_id,complex_id,area_group,room_count,bath_count,status,source_text")
      .eq("user_id", userIdRef.current)
      .eq("complex_id", workspace.complex_id)
      .order("area_group", { ascending: true });
    if (structureError) throw structureError;
    setStructures((data || []) as StructureRow[]);
    if (article) {
      await supabase
        .from("apt_content_articles")
        .update({ structure_snapshot: data || [], updated_at: new Date().toISOString() })
        .eq("id", article.id)
        .eq("user_id", userIdRef.current);
    }
  }, [article, workspace]);


  const applyStructureResult = useCallback(async () => {
    if (!workspace || !article) return;
    try {
      const parsed = safeParseJson(structureRaw) as any;
      const areas = Array.isArray(parsed.areas) ? parsed.areas : [];
      if (!areas.length) throw new Error("areas 배열이 없습니다.");
      const rows = areas
        .filter((item: any) => Number.isFinite(Number(item.areaGroup)))
        .map((item: any) => {
          const status = item.status === "verified" || item.status === "varies" ? item.status : "needs_check";
          return {
            user_id: userIdRef.current,
            complex_id: workspace.complex_id,
            area_group: Number(item.areaGroup),
            room_count: status === "verified" && item.rooms !== null ? Number(item.rooms) : null,
            bath_count: status === "verified" && item.baths !== null ? Number(item.baths) : null,
            status,
            source_text: String(item.source || ""),
            verified_at: status === "needs_check" ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
      if (!rows.length) throw new Error("저장 가능한 평형 정보가 없습니다.");
      const { error: upsertError } = await supabaseRef.current
        .from("apt_content_area_structures")
        .upsert(rows, { onConflict: "user_id,complex_id,area_group" });
      if (upsertError) throw upsertError;
      await refreshStructures();
      notify("평형 구조 결과 적용 완료");
    } catch (cause) {
      setError(cause instanceof Error ? "구조 결과 JSON 오류: " + cause.message : "구조 결과를 적용하지 못했습니다.");
    }
  }, [article, refreshStructures, structureRaw, workspace, notify]);

  const excludeStructure = useCallback(async () => {
    if (!article) return;
    const { error: updateError } = await supabaseRef.current
      .from("apt_content_articles")
      .update({ structure_mode: "exclude", updated_at: new Date().toISOString() })
      .eq("id", article.id)
      .eq("user_id", userIdRef.current);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setArticle({ ...article, structure_mode: "exclude" });
    notify("구조 섹션 제외로 설정");
  }, [article, notify]);

  const applyLifeResult = useCallback(async () => {
    if (!article) return;
    try {
      const parsed = safeParseJson(lifeRaw) as any;
      const verified = parsed.kickFound === true && parsed.verified === true && String(parsed.title || "").trim();
      const patch = verified ? {
        kick_status: "verified",
        kick_title: String(parsed.title || "").trim(),
        kick_summary: String(parsed.summary || "").trim(),
        kick_source_text: String(parsed.sourceText || "").trim(),
        kick_snapshot: parsed,
      } : {
        kick_status: "not_found",
        kick_title: "",
        kick_summary: "",
        kick_source_text: String(parsed.sourceText || ""),
        kick_snapshot: parsed,
      };
      const { error: updateError } = await supabaseRef.current
        .from("apt_content_articles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", article.id)
        .eq("user_id", userIdRef.current);
      if (updateError) throw updateError;
      setArticle({ ...article, ...(patch as any) });
      notify(verified ? "생활 킥 1개 확정" : "생활 킥 확인 필요");
    } catch (cause) {
      setError(cause instanceof Error ? "생활 킥 JSON 오류: " + cause.message : "생활 킥 결과를 적용하지 못했습니다.");
    }
  }, [article, lifeRaw, notify]);

  const saveFinalArticle = useCallback(async () => {
    if (!article || !finalRaw.trim()) return;
    const { error: updateError } = await supabaseRef.current
      .from("apt_content_articles")
      .update({
        final_article: finalRaw.trim(),
        naver_formatted: "",
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id)
      .eq("user_id", userIdRef.current);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setArticle({ ...article, final_article: finalRaw.trim(), naver_formatted: "", status: "ready" });
    setNaverApplied(false);
    setPublishAuditVisible(false);
    setNaverCopyMessage("");
    notify("최종 원고 저장 완료");
  }, [article, finalRaw, notify]);

  const naverBlocks = useMemo(() => parseApartmentV1Naver(finalRaw), [finalRaw]);

  const publishAudit = useMemo(() => {
    if (!snapshot || !workspace) return null;
    return auditApartmentV1Article({
      body: finalRaw,
      complexName: workspace.name,
      referenceDate: snapshot.referenceDate,
      areas: snapshot.areas.map((area) => ({
        displayName: area.displayName,
        currentMedian: area.currentMedian,
      })),
      includeStructure: article?.structure_mode !== "exclude",
      kickTitle: article?.kick_title || "",
    });
  }, [article?.kick_title, article?.structure_mode, finalRaw, snapshot, workspace]);
  const applyNaverFormatting = useCallback(async () => {
    if (!article || !finalRaw.trim() || !naverBlocks.length) return;
    const plain = apartmentV1NaverPlainText(naverBlocks);
    const { error: updateError } = await supabaseRef.current
      .from("apt_content_articles")
      .update({
        final_article: finalRaw.trim(),
        naver_formatted: plain,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id)
      .eq("user_id", userIdRef.current);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setArticle({ ...article, final_article: finalRaw.trim(), naver_formatted: plain, status: "ready" });
    setNaverApplied(true);
    setNaverCopyMessage("✓ 네이버 서식 적용 완료");
    notify("네이버 서식 적용 완료");
  }, [article, finalRaw, naverBlocks, notify]);

  const copyNaverRichText = useCallback(async () => {
    if (!naverApplied || !naverBlocks.length) {
      setNaverCopyMessage("네이버 서식 적용을 먼저 눌러주세요.");
      return;
    }
    const plain = apartmentV1NaverPlainText(naverBlocks);
    const html = apartmentV1NaverRichHtml(naverBlocks);
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        setNaverCopyMessage("✓ 네이버 서식 복사 완료 · 네이버에서 Ctrl+V");
      } else {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("브라우저 제한으로 문단 간격 텍스트를 복사했습니다.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("서식 복사가 제한되어 문단 간격 텍스트를 복사했습니다.");
      } catch {
        setNaverCopyMessage("복사에 실패했습니다. 클립보드 권한을 확인해주세요.");
      }
    }
  }, [naverApplied, naverBlocks]);

  const publishArticle = useCallback(async () => {
    if (!article || !workspace) return;
    const supabase = supabaseRef.current;
    setBusy("publish");
    setError("");
    try {
      const now = new Date().toISOString();
      const { error: articleError } = await supabase
        .from("apt_content_articles")
        .update({ status: "published", published_at: now, updated_at: now })
        .eq("id", article.id)
        .eq("user_id", userIdRef.current);
      if (articleError) throw articleError;

      const recommendation = recommendations.find((item) => item.article_id === article.id);
      if (recommendation) {
        const { error: recError } = await supabase
          .from("apt_content_recommendations")
          .update({ status: "replaceable", updated_at: now })
          .eq("id", recommendation.id)
          .eq("user_id", userIdRef.current);
        if (recError) throw recError;
        await supabase
          .from("apt_content_candidate_pool")
          .update({ status: "published", updated_at: now })
          .eq("user_id", userIdRef.current)
          .eq("year", year)
          .eq("complex_id", workspace.complex_id);
      }

      await fetch("/api/publish-history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemType: "complex",
          title: workspace.name + " 얼마일까?",
          contentType: "bulk",
          complexId: workspace.complex_id,
          complexName: workspace.name,
          publishedOn: kstDate(),
          source: "apartment-v1",
        }),
      });

      setWorkspace(null);
      setArticle(null);
      setSnapshot(null);
      setIdentityState({ loaded:false,kaptCode:"",regionCode:"",legalDong:"",lot:"",address:"",roadAddress:"",unresolved:[] });
      await loadHome();
      notify("발행 완료 처리");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "발행 완료 처리에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }, [article, loadHome, recommendations, workspace, year, notify]);

  const replaceCandidate = useCallback(async (rec: RecommendationRow) => {
    const supabase = supabaseRef.current;
    setBusy("replace-" + rec.slot_no);
    setError("");
    try {
      let { data: poolRows, error: poolError } = await supabase
        .from("apt_content_candidate_pool")
        .select("complex_id,rank,status")
        .eq("user_id", userIdRef.current)
        .eq("year", year)
        .eq("status", "ready")
        .order("rank", { ascending: true });
      if (poolError) throw poolError;
      const used = new Set(recommendations.map((item) => item.complex_id));
      let next = (poolRows || []).find((row: any) => !used.has(row.complex_id));

      if (!next) {
        await loadHome();
        const refreshed = await supabase
          .from("apt_content_candidate_pool")
          .select("complex_id,rank,status")
          .eq("user_id", userIdRef.current)
          .eq("year", year)
          .eq("status", "ready")
          .order("rank", { ascending: true });
        poolRows = refreshed.data || [];
        next = poolRows.find((row: any) => !used.has(row.complex_id));
      }

      if (!next) throw new Error("교체할 새 후보가 없습니다.");

      const now = new Date().toISOString();
      const { error: recError } = await supabase
        .from("apt_content_recommendations")
        .update({
          complex_id: next.complex_id,
          article_id: null,
          status: "recommended",
          assigned_at: now,
          updated_at: now,
        })
        .eq("id", rec.id)
        .eq("user_id", userIdRef.current);
      if (recError) throw recError;

      await supabase
        .from("apt_content_candidate_pool")
        .update({ status: "reserved", updated_at: now })
        .eq("user_id", userIdRef.current)
        .eq("year", year)
        .eq("complex_id", next.complex_id);

      await loadHome();
      notify("새 후보로 교체 완료");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "후보 교체에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }, [loadHome, recommendations, year, notify]);

  const uploadTemplateReferenceImage = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 등록할 수 있습니다.");
      return;
    }
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    if (!supabase || !userId) return;

    setBusy("template-image");
    setError("");
    try {
      const extension = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = userId + "/apartment-template/apt-price-flow-v1." + extension;
      const { error: uploadError } = await supabase.storage
        .from("content-maker-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("content-maker-assets").getPublicUrl(path);
      const url = publicData.publicUrl + "?v=" + Date.now();
      const next = { ...chartTemplate, reference_image_url: url };
      setChartTemplate(next);

      const { error: saveError } = await supabase
        .from("apt_content_prompt_templates")
        .upsert({
          user_id: userId,
          template_key: "APT_PRICE_FLOW_V1",
          name: next.name || "평형별 가격 흐름 V1",
          is_active: next.is_active,
          template_text: next.template_text || DEFAULT_CHART_TEMPLATE,
          reference_image_url: url,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,template_key" });
      if (saveError) throw saveError;
      notify("기준 디자인 이미지 저장 완료");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "기준 이미지를 저장하지 못했습니다.");
    } finally {
      setBusy("");
    }
  }, [chartTemplate, notify]);

  const copyReferenceImage = useCallback(async () => {
    if (!chartTemplate.reference_image_url) return;
    try {
      const response = await fetch(chartTemplate.reference_image_url);
      if (!response.ok) throw new Error("기준 이미지를 불러오지 못했습니다.");
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이미지 변환에 실패했습니다.");
      context.drawImage(bitmap, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 변환에 실패했습니다.")), "image/png");
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      notify("기준 디자인 이미지 복사 완료");
    } catch {
      window.open(chartTemplate.reference_image_url, "_blank", "noopener,noreferrer");
      notify("복사가 지원되지 않아 기준 이미지를 새 창으로 열었습니다.");
    }
  }, [chartTemplate.reference_image_url, notify]);

  const saveChartTemplate = useCallback(async () => {
    const row = {
      user_id: userIdRef.current,
      template_key: "APT_PRICE_FLOW_V1",
      name: chartTemplate.name || "평형별 가격 흐름 V1",
      is_active: chartTemplate.is_active,
      template_text: chartTemplate.template_text || DEFAULT_CHART_TEMPLATE,
      reference_image_url: chartTemplate.reference_image_url || "",
      updated_at: new Date().toISOString(),
    };
    const { data, error: templateError } = await supabaseRef.current
      .from("apt_content_prompt_templates")
      .upsert(row, { onConflict: "user_id,template_key" })
      .select("id,template_key,name,is_active,template_text,reference_image_url")
      .single();
    if (templateError) {
      setError(templateError.message);
      return;
    }
    setChartTemplate(data as TemplateRow);
    notify("차트 템플릿 저장 완료");
  }, [chartTemplate, notify]);

  const saveTextPromptTemplate = useCallback(async () => {
    const definition = TEXT_PROMPT_DEFINITIONS[selectedPromptKey];
    const current = promptTemplates[selectedPromptKey];
    const text = current.template_text.trim();
    if (!text) {
      setError("요청서 내용을 비워둘 수 없습니다.");
      return;
    }
    const missing = definition.placeholders.filter((placeholder) => !text.includes(placeholder));
    if (missing.length) {
      setError("필수 치환값이 빠졌습니다: " + missing.join(", "));
      return;
    }

    const row = {
      user_id: userIdRef.current,
      template_key: selectedPromptKey,
      name: definition.name,
      is_active: true,
      template_text: text,
      reference_image_url: "",
      updated_at: new Date().toISOString(),
    };
    const { data, error: templateError } = await supabaseRef.current
      .from("apt_content_prompt_templates")
      .upsert(row, { onConflict: "user_id,template_key" })
      .select("id,template_key,name,is_active,template_text,reference_image_url")
      .single();
    if (templateError) {
      setError(templateError.message);
      return;
    }
    setPromptTemplates((currentRows) => ({
      ...currentRows,
      [selectedPromptKey]: data as TemplateRow,
    }));
    notify(definition.name + " 저장 완료");
  }, [notify, promptTemplates, selectedPromptKey]);

  const resetTextPromptTemplate = useCallback(() => {
    const definition = TEXT_PROMPT_DEFINITIONS[selectedPromptKey];
    setPromptTemplates((currentRows) => ({
      ...currentRows,
      [selectedPromptKey]: {
        ...currentRows[selectedPromptKey],
        template_text: definition.defaultText,
      },
    }));
    notify("기본 요청서를 불러왔습니다. 저장을 누르면 고정됩니다.");
  }, [notify, selectedPromptKey]);

  const expectedTradeMonths = useMemo(
    () => snapshot ? expectedCoverageMonths(snapshot.referenceDate) : [],
    [snapshot]
  );
  const coveredTradeMonths = useMemo(
    () => new Map(tradeCoverage.map((row) => [row.year_month, row])),
    [tradeCoverage]
  );
  const missingTradeMonths = useMemo(
    () => expectedTradeMonths.filter((month) => !coveredTradeMonths.has(month)),
    [coveredTradeMonths, expectedTradeMonths]
  );
  const currentTradeCoverage = snapshot ? coveredTradeMonths.get(snapshot.referenceDate.slice(0, 7)) : null;
  const tradeCoverageReady = Boolean(
    snapshot &&
    missingTradeMonths.length === 0 &&
    currentTradeCoverage &&
    kstDateFromTimestamp(currentTradeCoverage.fetched_at) >= snapshot.referenceDate
  );
  const identityReady = Boolean(
    identityState.loaded &&
    identityState.lot &&
    identityState.unresolved.length === 0
  );
  const apiDataReady = Boolean(
    snapshot &&
    identityReady &&
    tradeCoverageReady &&
    snapshot.totalTransactions > 0
  );

  const structureByArea = useMemo(() => {
    const map = new Map<number, StructureRow>();
    structures.forEach((item) => map.set(Number(item.area_group), item));
    return map;
  }, [structures]);

  const needsCheckGroups = useMemo(() => {
    if (!snapshot) return [] as number[];
    return snapshot.areas
      .filter((area) => {
        const value = structureByArea.get(area.areaGroup);
        return !value || value.status === "needs_check";
      })
      .map((area) => area.areaGroup);
  }, [snapshot, structureByArea]);

  const structureReady = article?.structure_mode === "exclude" || needsCheckGroups.length === 0;
  const lifeReady = article?.kick_status === "verified";
  const finalReady = apiDataReady && structureReady && lifeReady;
  if (loading) {
    return <main className={styles.page}><div className={styles.loading}>아파트 콘텐츠메이커를 준비하고 있습니다…</div></main>;
  }

  return (
    <main className={styles.page}>
      {toast ? <div className={styles.toast}>✓ {toast}</div> : null}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>NAVER REAL ESTATE CONTENT</p>
          <h1>아파트 콘텐츠메이커</h1>
          <p className={styles.headerCopy}>거래가 많은 단지를 고르고, 데이터·생활 킥·원고까지 한 흐름으로 만듭니다.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={styles.ghostButton}>기존 홈</Link>
          <button className={styles.ghostButton} onClick={() => setSettingsOpen((value) => !value)}>⚙ 설정</button>
        </div>
      </header>

      {error ? <div className={styles.errorBox}>{error}<button onClick={() => setError("")}>닫기</button></div> : null}

      {settingsOpen ? (
        <section className={styles.settingsCard}>
          <div className={styles.settingsTabs}>
            <button
              className={settingsTab === "prompts" ? styles.settingsTabActive : ""}
              onClick={() => setSettingsTab("prompts")}
            >
              요청서 관리
            </button>
            <button
              className={settingsTab === "chart" ? styles.settingsTabActive : ""}
              onClick={() => setSettingsTab("chart")}
            >
              차트 디자인
            </button>
          </div>

          {settingsTab === "prompts" ? (
            <>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.stepLabel}>PROMPT SETTINGS</span>
                  <h2>요청서 관리</h2>
                </div>
              </div>
              <p className={styles.muted}>
                여기서 저장한 요청서는 다음 아파트에도 계속 사용됩니다. ChatGPT에서 새 요청서를 만들어달라고 한 뒤 그대로 붙여넣고 저장하면 됩니다.
              </p>

              <div className={styles.promptEditorTop}>
                <label>
                  <span>수정할 요청서</span>
                  <select
                    value={selectedPromptKey}
                    onChange={(event) => setSelectedPromptKey(event.target.value as TextPromptKey)}
                  >
                    {(Object.keys(TEXT_PROMPT_DEFINITIONS) as TextPromptKey[]).map((key) => (
                      <option key={key} value={key}>{TEXT_PROMPT_DEFINITIONS[key].name}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.promptHelp}>
                  <strong>{TEXT_PROMPT_DEFINITIONS[selectedPromptKey].name}</strong>
                  <span>{TEXT_PROMPT_DEFINITIONS[selectedPromptKey].description}</span>
                </div>
              </div>

              <div className={styles.placeholderBox}>
                <strong>유지해야 하는 자동 치환값</strong>
                <div>
                  {TEXT_PROMPT_DEFINITIONS[selectedPromptKey].placeholders.map((placeholder) => (
                    <code key={placeholder}>{placeholder}</code>
                  ))}
                </div>
                <span>이 표시는 단지명·실거래·구조·생활 킥 같은 저장자료가 자동으로 들어가는 자리이므로 삭제하지 않는 것이 안전합니다.</span>
              </div>

              <textarea
                className={styles.templateArea}
                value={promptTemplates[selectedPromptKey].template_text}
                onChange={(event) => setPromptTemplates((current) => ({
                  ...current,
                  [selectedPromptKey]: {
                    ...current[selectedPromptKey],
                    template_text: event.target.value,
                  },
                }))}
              />
              <div className={styles.rightActions}>
                <button className={styles.copyButton} onClick={resetTextPromptTemplate}>기본 요청서 불러오기</button>
                <button className={styles.primaryButton} onClick={saveTextPromptTemplate}>이 요청서 저장</button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.stepLabel}>CHART SETTINGS</span>
                  <h2>차트 이미지 템플릿</h2>
                </div>
                <label className={styles.switchRow}>
                  <input
                    type="checkbox"
                    checked={chartTemplate.is_active}
                    onChange={(event) => setChartTemplate((current) => ({ ...current, is_active: event.target.checked }))}
                  />
                  <span>{chartTemplate.is_active ? "활성화" : "비활성화"}</span>
                </label>
              </div>
              <p className={styles.muted}>한 번 저장해두면 매 단지마다 같은 디자인 이미지와 요청서를 사용하고, 이번 단지 데이터만 바뀝니다.</p>
              <div className={styles.referenceImageBox}>
                <div className={styles.referenceImagePreview}>
                  {chartTemplate.reference_image_url ? (
                    <img src={chartTemplate.reference_image_url} alt="평형별 가격 차트 기준 디자인" />
                  ) : (
                    <div className={styles.referenceImageEmpty}>기준 디자인 이미지 미등록</div>
                  )}
                </div>
                <div className={styles.referenceImageInfo}>
                  <strong>기준 디자인 이미지</strong>
                  <span>{chartTemplate.reference_image_url ? "APT_PRICE_FLOW_V1에 이미지가 저장되어 있습니다." : "마음에 든 완성 예시 이미지를 한 번 등록해주세요."}</span>
                  <div className={styles.referenceImageActions}>
                    <label className={styles.uploadButton}>
                      {busy === "template-image" ? "업로드 중…" : chartTemplate.reference_image_url ? "기준 이미지 교체" : "기준 이미지 등록"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy === "template-image"}
                        onChange={(event) => {
                          void uploadTemplateReferenceImage(event.target.files?.[0] || null);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {chartTemplate.reference_image_url ? (
                      <>
                        <button className={styles.copyButton} onClick={copyReferenceImage}>기준 이미지 복사</button>
                        <a className={styles.secondaryLink} href={chartTemplate.reference_image_url} target="_blank" rel="noreferrer">이미지 열기</a>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <textarea
                className={styles.templateArea}
                value={chartTemplate.template_text}
                onChange={(event) => setChartTemplate((current) => ({ ...current, template_text: event.target.value }))}
              />
              <div className={styles.rightActions}>
                <button className={styles.primaryButton} onClick={saveChartTemplate}>차트 템플릿 저장</button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {!workspace ? (
        <>
          <nav className={styles.categoryNav}>
            <button className={styles.categoryActive}>아파트 단지 글</button>
            <button disabled>분양 글</button>
            <button disabled>금융·재테크 글</button>
            <button disabled>부동산 꿀팁</button>
          </nav>

          <section className={styles.hero}>
            <div>
              <span className={styles.stepLabel}>오늘 만들 콘텐츠</span>
              <h2>올해 실제 거래가 많은 단지부터</h2>
              <p>{year}년 1월 1일부터 현재까지 국토부 실거래 누적 건수 기준입니다.</p>
            </div>
            <div className={styles.scopeBadge}>{rankScopeLabel} 순위</div>
          </section>

          <section className={styles.recommendationGrid}>
            {[1, 2].map((slotNo) => {
              const rec = recommendations.find((item) => item.slot_no === slotNo);
              const complex = rec ? rankingMap.get(rec.complex_id) : null;
              if (!rec || !complex) {
                return <div key={slotNo} className={styles.recommendationCard}><div className={styles.emptyCard}>추천 후보 준비 중</div></div>;
              }
              return (
                <article key={rec.id} className={styles.recommendationCard}>
                  <div className={styles.cardTopLine}>
                    <span>추천 {slotNo}</span>
                    <span className={styles.rankBadge}>{rankScopeLabel} {complex.national_rank}위</span>
                  </div>
                  <h3>{complex.name}</h3>
                  <p className={styles.location}>{displayLocation(complex)}</p>
                  <div className={styles.metricRow}>
                    <div><strong>{complex.transaction_count}</strong><span>{year} 거래</span></div>
                    <div><strong>{complex.households ? complex.households.toLocaleString() : "-"}</strong><span>세대</span></div>
                  </div>
                  {rec.status === "replaceable" ? (
                    <button
                      className={styles.secondaryButton}
                      disabled={busy === "replace-" + slotNo}
                      onClick={() => replaceCandidate(rec)}
                    >
                      {busy === "replace-" + slotNo ? "교체 중…" : "새 후보로 갈아끼우기"}
                    </button>
                  ) : (
                    <button
                      className={styles.primaryButton}
                      disabled={busy === "start-" + slotNo || busy === "workspace"}
                      onClick={() => startArticle(rec, complex)}
                    >
                      {rec.status === "working" ? "이어하기" : "글 만들기"}
                    </button>
                  )}
                </article>
              );
            })}
          </section>

          <section className={styles.noteCard}>
            <strong>현재 구현 범위</strong>
            <span>아파트 단지 글 V1만 먼저 연결했습니다. 다른 3개 카테고리는 다음 단계에서 같은 2-slot 구조로 붙이면 됩니다.</span>
          </section>
        </>
      ) : snapshot && article ? (
        <>
          <button className={styles.backButton} onClick={() => {
            setWorkspace(null); setArticle(null); setSnapshot(null);
            setIdentityState({ loaded:false,kaptCode:"",regionCode:"",legalDong:"",lot:"",address:"",roadAddress:"",unresolved:[] });
          }}>← 추천으로 돌아가기</button>

          <section className={styles.workspaceHero}>
            <div>
              <span className={styles.stepLabel}>단지 작업</span>
              <h2>{workspace.name}</h2>
              <p>{displayLocation(workspace)}</p>
            </div>
            <div className={styles.heroStats}>
              <span>{year} 거래 <strong>{snapshot.totalTransactions}건</strong></span>
              <span>{rankScopeLabel} <strong>{workspace.national_rank}위</strong></span>
              <span>기준일 <strong>{snapshot.referenceDate.replace(/-/g, ".")}</strong></span>
            </div>
          </section>



          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>자동 수집</span>
                <h2>단지 기본정보</h2>
              </div>
              <span className={styles.goodPill}>✓ K-apt</span>
            </div>
            <div className={styles.doubleCheckGrid}>
              <div>
                <span>세대수</span>
                <strong>{workspace.households ? workspace.households.toLocaleString() + "세대" : "확인 필요"}</strong>
              </div>
              <div>
                <span>사용승인일</span>
                <strong>{workspace.use_date || "확인 필요"}</strong>
              </div>
              <div>
                <span>주소</span>
                <strong>{identityState.roadAddress || identityState.address || workspace.road_address || workspace.address || "확인 필요"}</strong>
              </div>
              <div>
                <span>확인 평형</span>
                <strong>{snapshot.areas.map((area) => area.displayName).join(", ") || "확인 필요"}</strong>
              </div>
            </div>
          </section>

          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>자동 수집</span>
                <h2>실거래 자료</h2>
              </div>
              <div className={styles.inlineButtons}>
                <span className={styles.sourcePill}>{snapshot.referenceDate.replace(/-/g, ".")} 기준 · 국토부 실거래 API</span>
                <button
                  className={styles.copyButton}
                  disabled={busy === "molit-refresh"}
                  onClick={refreshMolitData}
                >
                  {busy === "molit-refresh" ? "새로고침 중…" : "2026 자료 새로고침"}
                </button>
              </div>
            </div>

            <div className={styles.doubleCheckPanel}>
              <div className={styles.doubleCheckHead}>
                <div>
                  <strong>
                    {!identityReady ? "단지 식별 확인 필요" :
                     !tradeCoverageReady ? "국토부 자료 새로고침 필요" :
                     snapshot.totalTransactions > 0 ? "실거래 자료 준비 완료" : "수집 완료 · 올해 거래 없음"}
                  </strong>
                  <span>
                    {tradeCoverageReady
                      ? snapshot.year + "년 1~" + Number(snapshot.referenceDate.slice(5, 7)) + "월 수집 완료 · 연결 거래 " + snapshot.totalTransactions + "건"
                      : missingTradeMonths.length
                        ? "수집 확인이 안 된 월: " + missingTradeMonths.map((month) => Number(month.slice(5, 7)) + "월").join(", ")
                        : "현재 월 자료를 기준일까지 다시 확인해주세요."}
                  </span>
                </div>
                <b className={apiDataReady ? styles.statusGood : styles.statusWarn}>
                  {apiDataReady ? "✓ 차트 제작 가능" : "⚠ 확인 필요"}
                </b>
              </div>
              {!identityReady ? (
                <div className={styles.doubleCheckWarnings}>
                  <div>⚠ 단지 식별이 필요한 자료가 있습니다. 이 경우에만 별도 확인합니다.</div>
                  {identityState.unresolved.length ? (
                    <Link
                      className={styles.secondaryLink}
                      href={"/apartment-bulk/unmatched?regionCode=" + encodeURIComponent(identityState.regionCode) +
                        "&name=" + encodeURIComponent(identityState.unresolved[0]?.source_apartment_name || workspace.name)}
                    >
                      단지 식별 확인 →
                    </Link>
                  ) : null}
                </div>
              ) : !tradeCoverageReady ? (
                <div className={styles.doubleCheckWarnings}>
                  <div>⚠ 거래 0건인 달과 아직 수집하지 않은 달을 구분하기 위해 1월~현재 자료를 한 번 새로고침해주세요.</div>
                </div>
              ) : null}
            </div>

            <div className={styles.areaTable}>
              <div className={styles.tableHeader}><span>평형</span><span>현재 대표가격</span><span>올해 거래</span><span>기준월</span></div>
              {snapshot.areas.map((area) => (
                <div key={area.areaGroup} className={styles.tableRow}>
                  <span><strong>{area.displayName}</strong><small>{areaRangeText(area)}</small></span>
                  <span>{formatWon(area.currentMedian)}</span>
                  <span>{area.totalCount}건</span>
                  <span>{area.latestMonth ? area.latestMonth.replace("-", ".") : "-"}</span>
                </div>
              ))}
            </div>

            <div className={styles.imageRequestRow}>
              <div>
                <strong>가격 차트 이미지</strong>
                <span>
                  기준 디자인 APT_PRICE_FLOW_V1 {chartTemplate.reference_image_url ? "✓" : "· 이미지 미등록"}
                  {" · "}식별 완료된 국토부 실거래 자료로 제작합니다.
                </span>
              </div>
              <div className={styles.imageActionButtons}>
                {chartTemplate.reference_image_url ? (
                  <button className={styles.copyButton} onClick={copyReferenceImage}>기준 이미지 복사</button>
                ) : null}
                <button
                  className={styles.primaryButton}
                  disabled={!apiDataReady || !chartTemplate.is_active}
                  onClick={() => copyText(
                    buildChartPrompt(snapshot, chartTemplate.template_text) +
                    (chartTemplate.reference_image_url ? "\n\n[중요]\n함께 붙여넣은 기준 디자인 이미지를 레이아웃·정보 배치의 레퍼런스로 사용하고, 이번 단지 데이터만 교체할 것." : ""),
                    "차트 이미지 요청서"
                  )}
                >
                  차트 이미지 요청서 복사
                </button>
                <button
                  className={styles.secondaryButton}
                  disabled={!apiDataReady || !chartTemplate.is_active}
                  onClick={() => openInChatGPT(
                    buildChartPrompt(snapshot, chartTemplate.template_text) +
                    (chartTemplate.reference_image_url ? "\n\n[중요]\n기준 디자인 이미지는 사이트의 [기준 이미지 복사] 버튼으로 복사한 뒤 ChatGPT 입력창에 Ctrl+V로 붙여넣고, 이 요청서를 함께 사용할 것." : "")
                  )}
                >
                  GPT 열기
                </button>
              </div>
            </div>
            {!chartTemplate.is_active ? <p className={styles.inlineWarning}>차트 템플릿이 비활성화되어 있습니다. 상단 설정에서 켤 수 있습니다.</p> : null}
          </section>

          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>자료 조사</span>
                <h2>평형별 구조</h2>
              </div>
              {needsCheckGroups.length ? <span className={styles.warningPill}>⚠ 확인 필요 {needsCheckGroups.length}개</span> : <span className={styles.goodPill}>✓ 확인 완료</span>}
            </div>

            <div className={styles.structureGrid}>
              {snapshot.areas.map((area) => {
                const value = structureByArea.get(area.areaGroup);
                return (
                  <div key={area.areaGroup} className={styles.structureItem}>
                    <div><strong>{area.displayName}</strong><small>{area.exclusiveLabel}</small></div>
                    {value?.status === "verified" ? (
                      <span>방 {value.room_count} · 욕실 {value.bath_count}</span>
                    ) : value?.status === "varies" ? (
                      <span className={styles.statusWarn}>타입별 상이</span>
                    ) : (
                      <span className={styles.statusWarn}>⚠ 확인 필요</span>
                    )}
                  </div>
                );
              })}
            </div>

            {needsCheckGroups.length ? (
              <>
                <div className={styles.inlineButtons}>
                  <button className={styles.copyButton} onClick={() => copyText(buildStructurePrompt(snapshot, needsCheckGroups, promptTemplates.APT_STRUCTURE_V1.template_text), "구조 조사 요청서")}>구조 조사 요청서 복사</button>
                  <button className={styles.secondaryButton} onClick={() => openInChatGPT(buildStructurePrompt(snapshot, needsCheckGroups, promptTemplates.APT_STRUCTURE_V1.template_text))}>GPT 열기</button>
                </div>
                <div className={styles.pasteBox}>
                  <label>GPT 구조 조사 결과 붙여넣기 · JSON 코드블록만 복사해서 붙여넣으세요</label>
                  <textarea value={structureRaw} onChange={(event) => setStructureRaw(event.target.value)} placeholder='{"areas":[{"areaGroup":84,"rooms":3,"baths":2,"status":"verified","source":"..."}]}' />
                  <div className={styles.splitActions}>
                    <button className={styles.smallButton} disabled={!structureRaw.trim()} onClick={applyStructureResult}>구조 자료 저장</button>
                    <button className={styles.textButton} onClick={excludeStructure}>확인이 어려우면 구조 섹션 제외</button>
                  </div>
                </div>
              </>
            ) : null}
            {article.structure_mode === "exclude" ? <p className={styles.inlineWarning}>최종 글에서는 평형 구조 목차를 제외합니다.</p> : null}
          </section>

          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>자료 조사</span>
                <h2>생활·입지 킥</h2>
              </div>
              {article.kick_status === "verified" ? <span className={styles.goodPill}>✓ 생활 킥 1개 확정</span> : <span className={styles.statusMuted}>조사 전</span>}
            </div>

            {article.kick_status === "verified" ? (
              <div className={styles.kickResult}>
                <span>생활 킥</span>
                <h3>{article.kick_title}</h3>
                <p>{article.kick_summary}</p>
                {(article.kick_snapshot as any)?.walkingVerified && (article.kick_snapshot as any)?.walkingMinutes ? (
                  <div className={styles.walkingInfo}>
                    <strong>도보 약 {(article.kick_snapshot as any).walkingMinutes}분</strong>
                    {(article.kick_snapshot as any)?.walkingDistanceM ? <span>약 {(article.kick_snapshot as any).walkingDistanceM}m</span> : null}
                    <small>
                      {String((article.kick_snapshot as any)?.routeFrom || "단지")}
                      {" → "}
                      {String((article.kick_snapshot as any)?.routeTo || article.kick_title)}
                    </small>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className={styles.muted}>단지 위치를 기준으로 실제 생활에 의미 있는 시설·공원·시장·교통·문화 요소 중 하나만 검증합니다.</p>
            )}

            <div className={styles.actionStrip}>
              <div className={styles.inlineButtons}>
                <button className={styles.copyButton} onClick={() => copyText(buildLifeKickPrompt(snapshot, promptTemplates.APT_LIFE_KICK_V1.template_text), "생활 킥 조사 요청서")}>생활 킥 조사 요청서 복사</button>
                <button className={styles.secondaryButton} onClick={() => openInChatGPT(buildLifeKickPrompt(snapshot, promptTemplates.APT_LIFE_KICK_V1.template_text))}>GPT 열기</button>
              </div>
            </div>
            <div className={styles.pasteBox}>
              <label>GPT 생활 킥 조사 결과 붙여넣기 · JSON 코드블록만 복사해서 붙여넣으세요</label>
              <textarea value={lifeRaw} onChange={(event) => setLifeRaw(event.target.value)} placeholder='{"kickFound":true,"title":"...","summary":"...","walkingVerified":true,"walkingMinutes":8,"walkingDistanceM":600,"routeFrom":"단지","routeTo":"○○역 1번 출구","sourceText":"...","verified":true}' />
              <button className={styles.smallButton} disabled={!lifeRaw.trim()} onClick={applyLifeResult}>생활·입지 자료 저장</button>
            </div>

            <div className={styles.imageRequestRow}>
              <div>
                <strong>생활 킥 이미지</strong>
                <span>확정된 생활 킥 1개만 이미지 요청서에 사용합니다.</span>
              </div>
              <div className={styles.inlineButtons}>
                <button
                  className={styles.primaryButton}
                  disabled={!lifeReady}
                  onClick={() => copyText(buildLifeImagePrompt(snapshot, {
                    title: article.kick_title,
                    summary: article.kick_summary,
                    category: String((article.kick_snapshot as any)?.category || ""),
                    walkingVerified: Boolean((article.kick_snapshot as any)?.walkingVerified),
                    walkingMinutes: (article.kick_snapshot as any)?.walkingMinutes ?? null,
                    walkingDistanceM: (article.kick_snapshot as any)?.walkingDistanceM ?? null,
                    routeFrom: String((article.kick_snapshot as any)?.routeFrom || ""),
                    routeTo: String((article.kick_snapshot as any)?.routeTo || ""),
                  }, promptTemplates.APT_LIFE_IMAGE_V1.template_text), "생활 킥 이미지 요청서")}
                >
                  생활 킥 이미지 요청서 복사
                </button>
                <button
                  className={styles.secondaryButton}
                  disabled={!lifeReady}
                  onClick={() => openInChatGPT(buildLifeImagePrompt(snapshot, {
                    title: article.kick_title,
                    summary: article.kick_summary,
                    category: String((article.kick_snapshot as any)?.category || ""),
                    walkingVerified: Boolean((article.kick_snapshot as any)?.walkingVerified),
                    walkingMinutes: (article.kick_snapshot as any)?.walkingMinutes ?? null,
                    walkingDistanceM: (article.kick_snapshot as any)?.walkingDistanceM ?? null,
                    routeFrom: String((article.kick_snapshot as any)?.routeFrom || ""),
                    routeTo: String((article.kick_snapshot as any)?.routeTo || ""),
                  }, promptTemplates.APT_LIFE_IMAGE_V1.template_text))}
                >
                  GPT 열기
                </button>
              </div>
            </div>
          </section>

          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>제작</span>
                <h2>최종 글 만들기</h2>
              </div>
              <span className={finalReady ? styles.goodPill : styles.statusMuted}>{finalReady ? "✓ 자료 준비 완료" : "조사자료 준비 필요"}</span>
            </div>

            <div className={styles.titlePreview}>
              <span>제목</span>
              <strong>{workspace.name} 얼마일까?</strong>
            </div>

            <div className={styles.requestGrid}>
              <div className={styles.inlineButtons}>
                <button className={styles.copyButton} onClick={() => copyText(buildThumbnailPrompt(snapshot, promptTemplates.APT_THUMBNAIL_V1.template_text), "썸네일 요청서")}>썸네일 요청서 복사</button>
                <button className={styles.secondaryButton} onClick={() => openInChatGPT(buildThumbnailPrompt(snapshot, promptTemplates.APT_THUMBNAIL_V1.template_text))}>GPT 열기</button>
              </div>
              <div className={styles.inlineButtons}>
                <button
                  className={styles.primaryButton}
                  disabled={!finalReady}
                  onClick={() => copyText(buildFinalArticlePrompt(
                    snapshot,
                    structures,
                    {
                      title: article.kick_title,
                      summary: article.kick_summary,
                      walkingVerified: Boolean((article.kick_snapshot as any)?.walkingVerified),
                      walkingMinutes: (article.kick_snapshot as any)?.walkingMinutes ?? null,
                      walkingDistanceM: (article.kick_snapshot as any)?.walkingDistanceM ?? null,
                      routeFrom: String((article.kick_snapshot as any)?.routeFrom || ""),
                      routeTo: String((article.kick_snapshot as any)?.routeTo || ""),
                    },
                    article.structure_mode !== "exclude",
                    promptTemplates.APT_FINAL_ARTICLE_V1.template_text
                  ), "최종 원고 요청서")}
                >
                  최종 원고 요청서 복사
                </button>
                <button
                  className={styles.secondaryButton}
                  disabled={!finalReady}
                  onClick={() => openInChatGPT(buildFinalArticlePrompt(
                    snapshot,
                    structures,
                    {
                      title: article.kick_title,
                      summary: article.kick_summary,
                      walkingVerified: Boolean((article.kick_snapshot as any)?.walkingVerified),
                      walkingMinutes: (article.kick_snapshot as any)?.walkingMinutes ?? null,
                      walkingDistanceM: (article.kick_snapshot as any)?.walkingDistanceM ?? null,
                      routeFrom: String((article.kick_snapshot as any)?.routeFrom || ""),
                      routeTo: String((article.kick_snapshot as any)?.routeTo || ""),
                    },
                    article.structure_mode !== "exclude",
                    promptTemplates.APT_FINAL_ARTICLE_V1.template_text
                  ))}
                >
                  GPT 열기
                </button>
              </div>
            </div>

            <div className={styles.pasteBox}>
              <label>GPT 최종 원고 붙여넣기 · 응답 코드블록의 복사 버튼으로 글 전체를 복사하세요</label>
              <textarea
                className={styles.articleArea}
                value={finalRaw}
                onChange={(event) => {
                  setFinalRaw(event.target.value);
                  setNaverApplied(false);
                  setPublishAuditVisible(false);
                  setNaverCopyMessage("");
                }}
                placeholder="최종 원고를 붙여넣으세요."
              />
              <button className={styles.smallButton} disabled={!finalRaw.trim()} onClick={saveFinalArticle}>원고 저장</button>
            </div>

            {finalRaw.trim() ? (
              <div className={styles.naverPanel}>
                <div className={styles.naverPanelHead}>
                  <div>
                    <span className={styles.stepLabel}>NAVER FINAL COPY</span>
                    <h3>네이버 최종편집 · 발행 전 검사</h3>
                    <p>옛 작업실로 이동하지 않고 여기서 바로 서식 적용 → 복사 → 검사까지 끝냅니다.</p>
                  </div>
                  <span className={naverApplied ? styles.goodPill : styles.statusMuted}>{naverApplied ? "✓ 서식 적용됨" : "서식 적용 전"}</span>
                </div>

                <div className={styles.naverToolBar}>
                  <button className={styles.secondaryButton} onClick={applyNaverFormatting}>네이버 서식 적용</button>
                  <button className={styles.primaryButton} disabled={!naverApplied} onClick={copyNaverRichText}>네이버용 복사</button>
                  <button className={styles.copyButton} onClick={() => setPublishAuditVisible(true)}>발행 전 검사</button>
                </div>
                {naverCopyMessage ? <p className={styles.naverMessage}>{naverCopyMessage}</p> : null}

                {naverApplied ? (
                  <div className={styles.naverPreview}>
                    <div className={styles.naverPreviewLabel}>네이버 서식 미리보기</div>
                    {naverBlocks.map((block, index) => (
                      <div
                        key={block.type + "-" + index}
                        className={
                          block.type === "title" ? styles.naverTitle :
                          block.type === "subheading" ? styles.naverSubheading :
                          block.type === "emphasis" ? styles.naverEmphasis :
                          block.type === "image" ? styles.naverImageMarker :
                          block.type === "tags" ? styles.naverTags :
                          block.type === "card" ? styles.naverCard :
                          styles.naverBody
                        }
                      >
                        {block.text.split("\n").map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < block.text.split("\n").length - 1 ? <br /> : null}</span>)}
                      </div>
                    ))}
                  </div>
                ) : null}

                {publishAuditVisible && publishAudit ? (
                  <div className={styles.auditPanel}>
                    <div className={styles.auditHead}>
                      <div>
                        <strong>발행 전 자동 검사</strong>
                        <span>현재 단지·평형 가격·이미지 자리·생활 킥·출처를 확인합니다.</span>
                      </div>
                      <b>{publishAudit.checks.filter((item) => item.status === "warning").length
                        ? "확인 " + publishAudit.checks.filter((item) => item.status === "warning").length + "건"
                        : "✓ 주요 항목 통과"}</b>
                    </div>
                    <div className={styles.auditList}>
                      {publishAudit.checks.map((check, index) => (
                        <div
                          key={check.label + index}
                          className={check.status === "warning" ? styles.auditWarning : check.status === "review" ? styles.auditReview : styles.auditPass}
                        >
                          <b>{check.status === "warning" ? "!" : check.status === "review" ? "·" : "✓"} {check.label}</b>
                          <span>{check.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={styles.publishBox}>
                  <div>
                    <strong>발행 준비</strong>
                    <span>{naverApplied ? "네이버용 복사가 준비됐습니다. 검사 후 발행 완료 처리하세요." : "먼저 네이버 서식을 적용해주세요."}</span>
                  </div>
                  <div className={styles.publishActions}>
                    <button className={styles.copyButton} onClick={() => copyText(finalRaw, "최종 원고")}>원문 복사</button>
                    <button className={styles.publishButton} disabled={busy === "publish" || !naverApplied} onClick={publishArticle}>
                      {busy === "publish" ? "처리 중…" : "발행 완료"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
