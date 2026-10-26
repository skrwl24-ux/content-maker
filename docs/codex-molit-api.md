# Codex에서 국토부 아파트 매매 실거래 API 사용하기

## 현재 구조

- 운영 사이트의 기존 데이터 수집: lib/apartment-server.ts → 국토부 아파트 매매 실거래 API → Supabase.
- Codex용 새 기능: scripts/molit-trades.mjs → 같은 공식 매매 API를 직접 읽기 전용 조회. 운영 DB를 변경하지 않습니다.
- 미포함: 전세·월세 API, 네이버부동산 현재 호가, 네이버지도 실제 도보 경로.

## 설정

1. Codex 작업 저장소로 skrwl24-ux/content-maker를 선택합니다.
2. Codex의 해당 작업 환경에 DATA_GO_KR_SERVICE_KEY를 Secret/비밀 환경변수로 등록합니다. Vercel에 이미 있는 환경변수는 Codex로 자동 전달되지 않습니다. 인증키를 채팅에 붙여넣거나 GitHub 파일에 저장하지 마세요.
3. Codex 작업 환경에서 외부 네트워크(apis.data.go.kr) 접근을 허용해야 합니다.
4. node --test tests/molit-trades.test.mjs 로 테스트합니다.

## 사용 예

~~~bash
# 수원 장안구 2026년 10월 매매 실거래
node scripts/molit-trades.mjs --region 41111 --month 202610 --limit 100

# 특정 아파트의 전용면적 정확히 일치하는 매매 계약
node scripts/molit-trades.mjs --region 41111 --month 202610 --name '화서역파크푸르지오' --area 59.78

# 동명단지 방지: 법정동·지번도 함께 대조
node scripts/molit-trades.mjs --region 41111 --month 202610 --name '단지명' --dong '정자동' --jibun '10'
~~~

- 결과는 JSON이며 금액 amountTenThousandKrw는 만원 단위입니다.
- contractDate 계약일, floor 층, exclusiveAreaSqm 전용면적(㎡), cancelled 계약 해제표시, cancellationDay 원문 해제일입니다.
- matchingCount는 필터 일치 건수, returnedCount는 출력 건수입니다. truncated=true인 응답을 월간 전체 거래량으로 해석하지 마세요.
- 동일 단지명만으로 다른 지번·단지를 합치지 마세요. 월별 계약과 정정·해제 사실을 별도로 확인하세요.
- 전세·월세, 매물 호가, 도보 거리 등은 다른 데이터 소스에서 확인할 때까지 needs_check로 표시합니다.

## 출처

국토교통부 공식 API 엔드포인트: https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade (인증키 없이 표시).
실거래 공개시스템: https://rt.molit.go.kr/.
