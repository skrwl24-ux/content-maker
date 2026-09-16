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
