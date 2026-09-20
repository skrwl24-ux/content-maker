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

## 단계 3
범위: 본문 + 이미지 00/01/02 저장·복원

코드 확인:
- 본문/상태는 localStorage `paramma-publish-queue-v1`
- 이미지 Blob은 IndexedDB `paramma-blogger-images-v1` / `images`
- 키는 `topic-{topicId}/slot-{slotId}`
- 재진입 시 이미지 Blob을 읽어 미리보기 object URL 복원
- 이미지가 있으면 슬롯 상태를 `registered`로 동기화
- `hydrated` 가드로 초기 빈 상태의 덮어쓰기 방지

실제 브라우저 저장·복원 E2E:
- 미확인
- production/local/file 모두 동일 관리자 정책 차단
- 우회하지 않음

## 현재 단계 4
범위: 선택 이미지 03 + ZIP

### 실제 프로젝트 코드 확인
대상: `app/paramma-bulk/page.tsx`

확인 결과:
- 필수 슬롯: `00`, `01`, `02`
- `bodyReady = 본문 비어있지 않음 && bodyConfirmed`
- `missingRequired`가 있으면 `canZip = false`
- 선택 이미지 03 활성화 상태에서 03 이미지가 없으면 `optionalMissing = true`로 ZIP 차단
- 03 비활성화 시 `toggleOptional03()`은 `optional03`만 변경하며 IndexedDB 이미지 삭제를 호출하지 않음
- 03 비활성화 상태에서는 ZIP `includeSlots`가 00/01/02만 포함해 기존 03 이미지를 ZIP에서 제외
- ZIP 생성 전 각 이미지 Blob의 8바이트 PNG 시그니처 검사
- ZIP 이미지 이름: `00_thumbnail.png`, `01_body.png`, `02_body.png`, 선택 시 `03_body.png`
- `final_post.txt`를 동일한 글별 폴더에 이미지와 함께 저장

### 로컬 실행 검증
브라우저를 사용하지 않고 실제 JSZip으로 프로젝트 ZIP 계약을 실행 검증함.
사용 JSZip: 로컬 설치본
테스트 PNG: 실제 PNG 시그니처를 가진 테스트 이미지

테스트 결과:
1. 본문 없음 + 00/01/02 있음 → ZIP 조건 차단: 통과
2. 본문 있음 + 필수 02 없음 → ZIP 조건 차단: 통과
3. 03 활성화 + 03 없음 → ZIP 조건 차단: 통과
4. 03 비활성화 + 기존 03 데이터 존재 → ZIP 생성 허용, 03 데이터 자체는 보존: 통과
5. 03 비활성 ZIP 생성 → 00/01/02만 포함: 통과
6. 03 활성 ZIP 생성 → 00/01/02/03 포함: 통과
7. ZIP 내부 모든 .png 파일의 실제 PNG 시그니처 확인: 통과
8. PNG가 아닌 데이터가 이미지 슬롯에 들어오면 ZIP 전 시그니처 검사에서 차단: 통과
9. `final_post.txt`가 이미지들과 같은 글별 폴더에 포함: 통과
10. 테스트 본문 내용이 `final_post.txt`에 그대로 들어감: 통과

테스트 ZIP 예시 폴더:
`01_9월인데_모기가_왜_이렇게_많지_가을_모기가_사라지지_않는_이유/`

03 비활성 ZIP:
- 00_thumbnail.png
- 01_body.png
- 02_body.png
- final_post.txt
- article_request.txt
- image_prompts.txt
- project.json

03 활성 ZIP:
- 00_thumbnail.png
- 01_body.png
- 02_body.png
- 03_body.png
- final_post.txt
- article_request.txt
- image_prompts.txt
- project.json

### 이번 단계 코드 변경
- 없음
- 요구 조건과 다른 명확한 결함을 발견하지 못함
- 기존 운영 데이터, localStorage 키, IndexedDB 이름 및 키 구조 변경 없음

### 미확인
- 실제 프로덕션 UI에서 버튼 클릭 → 브라우저 다운로드까지의 E2E
- 실제 IndexedDB 운영 데이터로 생성한 ZIP
사유: 브라우저 정책 차단. 재시도/우회하지 않음.

## 다음 작업
- 필요 시 사용자의 실제 브라우저에서 저장·복원/다운로드 E2E 확인 결과 반영
- 그 외 Paramma 작업 흐름 개선은 별도 작은 단계로 진행


## 1번 주제 실전 완주 확인
범위: 기능 추가 없이 실제 운영 흐름 확인
대상: 1번 · 9월인데 모기가 왜 이렇게 많지? 가을 모기가 사라지지 않는 이유

보존 원칙:
- 테스트 때문에 본문/이미지/주제 상태를 임의 변경하지 않음
- 기존 localStorage `paramma-publish-queue-v1` 및 IndexedDB `paramma-blogger-images-v1` 데이터를 초기화/마이그레이션하지 않음
- 사용자의 실제 브라우저 저장값은 도구에서 직접 읽을 수 없으므로 현재 내용 자체는 미확인
- 기능 코드는 변경하지 않음

실전 확인 상태:
1. 본문 요청서 ChatGPT에서 열기 → **실제 통과**
   - 사용자가 실제 브라우저에서 새 ChatGPT 채팅 입력창에 해당 본문 요청서가 자동 입력되는 것을 확인함
2. 작성 결과 입력·저장 → **실제 통과**
   - 사용자가 1번 주제 완성 본문을 입력한 뒤 페이지를 새로고침했고, 본문이 그대로 남아있는 것을 확인함
3. 본문 확정 → **미확인**
4. 이미지 00 등록 → **미확인**
5. 이미지 01 등록 → **미확인**
6. 이미지 02 등록 → **미확인**
7. ZIP 다운로드 및 내용 확인 → **미확인**

현재 배포:
- production READY
- 기능 변경 없이 실전 확인 진행 중
