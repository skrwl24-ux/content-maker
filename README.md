# 콘텐츠 메이커 STEP 6

## 현재 연결 상태

- 전용 Supabase 프로젝트: `content-maker`
- 프로젝트 ref: `ygrgamfvykuyhijogxou`
- 서울 리전
- Anonymous Sign-In: 사용자가 Dashboard에서 활성화 완료
- DB 테이블:
  - `projects`
  - `image_tasks`
  - `review_checks`
- Storage:
  - `content-maker-assets`
- RLS 적용 및 UID 정책 최적화 완료

## STEP 6 변경점

1. 실제 `content-maker` Supabase 프로젝트에 바로 연결
2. 익명 사용자별 프로젝트 저장 / 불러오기
3. 이미지 Storage 업로드
4. OpenAI 키가 없어도 앱 자체는 동작
   - 로컬 안전 분석
   - 템플릿 SVG 이미지
5. OpenAI 키를 Vercel에 추가하면 실제 AI 분석/이미지 생성으로 자동 전환

## 실제 AI를 켜려면

Vercel 프로젝트 Environment Variables에 아래를 추가합니다.

- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL` = `gpt-5.6-luna`
- `OPENAI_IMAGE_MODEL` = `gpt-image-2.5-sunburst`

Supabase URL/Publishable Key는 STEP 6 소스에 공개 클라이언트 설정으로 연결되어 있으며
RLS가 실제 데이터 접근 제어를 담당합니다.

## 실행

```bash
npm install
npm run dev
```

## 배포 전 테스트

1. 새 작업 생성
2. 본문 분석
3. 이미지 한 장 생성
4. 클라우드 저장
5. 새로고침
6. 저장 프로젝트 불러오기
7. ZIP 내보내기


## 2026-09-20 · 집값쓱 오늘 7개 작업판 저장·이어하기

### 이번 수정
- `/apartment-bulk`의 7개 슬롯에 날짜별 고유 작업 ID를 부여합니다.
- 슬롯별로 `작업 시작 / 이어하기 / 작업 중` 상태를 표시합니다.
- 작업 내용은 브라우저 IndexedDB(`jibssuk-apartment-work-v1`)의 `dailyWorks` 저장소에 작업 ID별로 분리 저장합니다.
- 작업별 공통 저장 항목:
  - 주제
  - 자료·근거 메모
  - 본문 또는 본문 초안
  - 이미지 메모
  - 참고 이미지 첨부
  - 진행 상태
- 단지 대량발행 작업은 기존 제작 화면을 그대로 사용하면서 다음 상태를 작업 ID에 함께 저장·복원합니다.
  - 단지 입력값
  - 최근 6개월 월별 데이터
  - 지도 이미지와 지도 표시점
  - 생성된 본문 이미지
  - 선택 단지명
  - 추천 관점 / 본문 주제 모드
  - 네이버 최종 본문
- TOP3·꿀팁·이사체크·비교글·파워글은 이번 단계에서 분석·자동생성 기능을 추가하지 않고, 주제·자료·본문 메모·참고 이미지를 저장하는 준비 화면만 제공합니다.
- 마지막으로 열었던 작업 ID를 날짜별로 기억해 새로고침 후 다시 이어갈 수 있도록 연결했습니다.
- 기존 단지 분석, 자동 주제 다양화, TOP3 분석 로직, 배포 설정은 변경하지 않았습니다.

### 실제 검증
- GitHub main 반영 및 Vercel production 배포 READY 확인.
- 최신 production alias `content-maker-chi.vercel.app`에서 `/apartment-bulk` HTTP 200 응답 확인.
- 초기 7개 작업판에서 `작업 시작` 버튼과 고유 작업 ID 준비 상태가 렌더링되는 것을 확인.
- TypeScript/Next.js production build는 Vercel 배포 성공으로 확인.
- **미확인:** 테스트 작업 2개에 서로 다른 값을 입력한 뒤 작업 전환 → 새로고침 → 재복원하는 실제 브라우저 상호작용 테스트는 실행 환경의 외부 페이지 접근 차단(`ERR_BLOCKED_BY_ADMINISTRATOR`) 때문에 자동화 실행을 완료하지 못함.

### 남은 작업
- 실제 브라우저에서 2개 작업 A/B에 서로 다른 주제·자료·본문을 입력하고, 전환 및 새로고침 후 각각 분리 복원되는지 최종 사용자 동작 검증.
- 이후 단계에서만 TOP3 전용 자료 준비, 주간 기획, 제작완료/발행완료 분리를 검토.
