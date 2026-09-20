# Paramma 블로거 작업 상태

업데이트: 2026-09-20

## 완료 단계 1
범위: 이미지 00/01/02 요청서 표시 및 개별 복사 버튼

상태: 완료 확인

- 00 썸네일 요청서 생성 및 화면 표시
- 01 본문 이미지 01 요청서 생성 및 화면 표시
- 02 본문 이미지 02 요청서 생성 및 화면 표시
- 각 슬롯별 `요청서 복사 + ChatGPT`, `복사만` 버튼
- 개별 복사 로직: `copyImagePrompt(slotId, openChat)`
- 실제 프로덕션 렌더링에서 00/01/02 슬롯 및 버튼 문구 확인

## 단계 2
범위: 이미지 00/01/02 업로드 → 미리보기 → 교체 + 복사만 클립보드 검증

코드상 확인:
- 00/01/02 각 슬롯에 파일 입력 존재
- 업로드는 `handleUpload(slotId, event)`에 연결
- 등록 후 `images[slotId]` 미리보기 표시
- 이미지가 있으면 `이미지 교체` UI로 전환
- 교체 실패 시 기존 이미지 상태를 제거하지 않는 보존 로직 존재
- `복사만`은 `navigator.clipboard.writeText(meta.prompt)` 호출

실제 브라우저 상호작용:
- 미확인
- 자동화 Chromium이 production, localhost, file:// 모두 `ERR_BLOCKED_BY_ADMINISTRATOR`로 차단
- 우회하지 않음

## 현재 단계 3
범위: 본문 + 이미지 00/01/02 저장·복원

### 실제 파일
대상: `app/paramma-bulk/page.tsx`

### 코드 확인 결과
본문/작업상태:
- 저장 키: `paramma-publish-queue-v1`
- `statuses`, `selectedId`, `works`를 localStorage에 저장
- 초기 진입 시 같은 키에서 복원
- `works` 안에 본문(`body`), 본문 검수 상태(`bodyConfirmed`), 슬롯 상태와 요청서가 포함
- `hydrated` 가드가 있어 초기 빈 상태가 복원 데이터보다 먼저 localStorage를 덮어쓰지 않도록 구성

이미지:
- DB: `paramma-blogger-images-v1`
- object store: `images`
- 키: `topic-{topicId}/slot-{slotId}`
- 업로드 이미지는 Blob + width + height + updatedAt 형태로 IndexedDB 저장
- 선택 글 변경/재진입 시 00/01/02/03을 IndexedDB에서 다시 읽어 object URL로 미리보기 복원
- 이미지가 있으면 슬롯 상태를 `registered`로 동기화
- 이미지 Blob은 localStorage JSON에 넣지 않아 기존 저장 데이터 크기 구조를 유지

정적 실행 확인:
- 실제 GitHub 파일을 대상으로 저장/복원 경로 존재 여부를 스크립트 검사
- 본문 localStorage 저장·복원: 통과
- 00/01/02 IndexedDB 저장·복원 경로: 통과
- 복원 시 슬롯 `registered` 동기화: 통과
- 이미지 Blob이 localStorage에 섞이지 않음: 통과

### 브라우저 실행 검증
상태: 미확인

시도:
- production URL: 관리자 정책 차단
- localhost 로컬 서버: 관리자 정책 차단
- file:// 로컬 파일: 관리자 정책 차단

따라서 아래 실제 동작은 실행 확인하지 못함:
- 테스트 본문 + 이미지 00/01/02 등록 후 새로고침 복원
- 같은 브라우저 종료 후 재실행 복원

### 이번 단계 코드 변경
- 없음
- 코드 확인에서 저장·복원 구조의 명확한 결함은 발견하지 못함
- 기존 운영 데이터 및 저장 키/DB 이름 변경 없음

### 사용자 직접 확인 절차
1. 1번 글에 테스트 본문을 넣고 00/01/02 이미지를 등록한 뒤 각 슬롯이 `등록 완료`인지 확인
2. 페이지 새로고침 후 본문, 00/01/02 미리보기, `등록 완료` 상태가 그대로인지 확인
3. 같은 브라우저에서 탭을 닫고 다시 `/paramma-bulk`를 열어 동일하게 복원되는지 확인

## 다음 작업
- 위 브라우저 저장·복원 E2E 확인 결과 반영
- 선택 이미지 03 저장·복원/포함 조건 검증
- 최종 검수·ZIP 검증
