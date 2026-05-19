## 목표
업로드한 `ESG_지표관리_관리방법_템플릿.xlsx`를 기준으로 **지표별 실적 입력 페이지**를 재구성합니다. 현재는 한 지표에 단일 값(numeric/text)만 저장 가능하지만, 템플릿은 지표마다 고유한 **다중 표(행×열)** 구조 + **첨부파일** + **정성 서술**을 요구하므로 데이터 모델과 UI를 함께 확장합니다.

## 템플릿 분석 요약
- **지표목록 시트** (37개 지표): 코드, ESG영역(E/S/G), 지표명, 담당부서, 관리주기, 관리유형(계량/비계량/제외), 입력방식(표 입력 / 파일 업로드 / 활동내용 작성 / 제외), 증빙자료, 근거법령, 작성내용 가이드.
- **계량_입력양식 시트**: 지표별로 표 1~N개. 각 표는 `표번호 / 표제목 / 행번호 / 열1..열12` 로 정의된 고유 셀 구조 (예: E-2는 표2개 — 온실가스 5개년 표 + 저공해차 차종×연도 표).
- **비계량_관리방식 시트**: 파일 업로드 중심, 정성 서술 + 증빙.
- **제외지표**: 제외 사유만 표시.

## 데이터 모델 변경 (마이그레이션)
기존 `indicator_values`는 단순 시계열용으로 유지하되, 템플릿 기반 입력을 위해 4개 테이블 신설:

1. `indicator_tables` — 지표별 표 정의
   - indicator_id, table_no, title, description, sort_order
2. `indicator_table_cells_schema` — 표의 행/열 정의 (시드된 셀 좌표)
   - table_id, row_no, col_no, row_label, col_label, is_input(bool), is_header(bool), data_type(number|text|percent)
3. `indicator_table_values` — 실제 입력값 (연도별)
   - table_id, period_year, row_no, col_no, numeric_value, text_value, updated_by, updated_at
   - UNIQUE(table_id, period_year, row_no, col_no)
4. `indicator_attachments` — 증빙/비계량 파일
   - indicator_id, period_year, period_quarter, file_name, storage_path, mime_type, size, note, uploaded_by
   - + Supabase Storage bucket `indicator-files` (private, RLS)

기존 `indicators` 테이블에 컬럼 추가:
- `department`, `cycle` (예: "연 1회"/"분기"/"매월"), `input_method` (table|file|narrative|table_file|excluded), `evidence_required` (text), `guideline_ref` (이미 있음), `writing_guide` (text, 작성내용), `excluded_reason` (text)

RLS:
- 읽기: 인증 사용자 전체 (기존 정책 동일)
- 쓰기: editor/admin
- attachments: 동일 정책 + Storage 정책 (editor/admin upload, authenticated read)
- 실시간: `indicator_table_values`, `indicator_attachments` 에 realtime publication 추가

## 시드 데이터 자동 적재
업로드한 엑셀을 그대로 SQL 시드로 변환:
- `지표목록` → `indicator_categories` (E/S/G 영역별) + `indicators`(37행) UPSERT
- `계량_입력양식` → `indicator_tables` + `indicator_table_cells_schema` UPSERT (코드 기준)
- `비계량_관리방식` → `indicators.input_method='file'` 또는 `narrative`로 마킹

엑셀 → SQL 변환은 Node 스크립트로 한 번 실행해 `supabase/migrations/...seed_from_template.sql` 생성 후 마이그레이션 적용. (사용자 측 추가 작업 없음)

## 페이지 구성
### A. `/indicators` (목록) — 개선
- 영역 필터(E/S/G) + 관리유형(계량/비계량/제외) + 담당부서 + 관리주기 + 검색
- 각 행: 코드 · 지표명 · 담당부서 · 주기 · 최근 입력 연도 · 진행상태 배지

### B. `/indicators/$id` (지표별 실적 입력) — 핵심 재설계
탭 또는 섹션으로 구성:

1. **헤더**: 코드, 지표명, 영역, 담당부서, 관리주기, 입력방식, 근거법령, 작성 가이드(접기/펼치기)
2. **연도 선택기** (상단): 입력 대상 연도 (2021~현재+1), 필요 시 분기
3. **표 입력 영역** (계량 지표)
   - 지표에 정의된 표마다 카드 1개
   - 시드된 행/열 라벨 그대로 렌더링 → 입력 가능한 셀만 `<Input>` 표시
   - 비고/계산행(합계, 증감률)은 자동 계산 표시 (가능한 경우)
   - 저장 = 셀 단위 upsert → 실시간으로 다른 사용자 화면에 반영
4. **첨부파일 영역**
   - 드래그&드롭 업로더 (PDF/이미지/문서)
   - 연도/분기 태그, 메모
   - 목록(다운로드, 삭제[admin])
5. **정성 서술 영역** (비계량/혼합 지표)
   - 작성내용 가이드 표시 + 리치 텍스트 또는 Textarea
   - 연도/분기별 버전 저장
6. **제외 지표**: 입력 UI 숨기고 제외사유만 표시

### C. `/admin/indicators` — 개선
- 표 구조(스키마) 편집 UI: 표 추가/삭제, 행·열 라벨 수정, 입력 가능 셀 토글
- 활성/비활성 토글, 담당부서/주기 편집

### D. `/upload` (엑셀 일괄) — 개선
- 본 템플릿(.xlsx) 그대로 업로드 시 자동 매핑:
  - 지표목록 시트 → 마스터 동기화 (admin only)
  - 계량_입력양식 시트 → 표 스키마 동기화
  - 데이터 채워진 셀이 있으면 `indicator_table_values`로 upsert
- 템플릿 다운로드 버튼 제공 (현재 시드 기반 재생성)

### E. `/dashboard` — 보강
- 영역별/부서별 입력 완료율 (해당 연도 기준 셀 채움율)
- 최근 업데이트 피드 (실시간)

## 실시간
- `indicator_table_values`, `indicator_attachments`, `indicator_tables` Realtime publication
- 지표 상세 페이지에서 해당 indicator_id 필터로 채널 구독 → 다른 사람이 셀 저장하면 즉시 갱신

## 기술 메모
- 표 렌더링: `indicator_table_cells_schema` 를 (row_no, col_no)로 sparse matrix화 후 `<Table>` 컴포넌트로 그리기
- 셀 저장: debounced onBlur upsert + 낙관적 업데이트
- Storage 버킷 `indicator-files` 생성, RLS 정책 (editor/admin write, authenticated read, admin delete)
- xlsx 파서는 이미 설치된 `xlsx` 패키지 사용 (클라이언트 측 파싱)

## MVP 범위 (이번 작업)
- 마이그레이션: 신규 4개 테이블 + `indicators` 컬럼 확장 + Storage bucket + RLS + Realtime
- 시드: 업로드한 엑셀 기반 37개 지표 + 표 스키마 자동 적재
- `/indicators/$id` 전면 재구성 (표 입력 + 첨부 + 정성 서술)
- `/indicators` 필터 개선
- 엑셀 업로드 화면 본 템플릿 호환

## 추후 확장 (이번 작업 제외)
- 표 스키마 GUI 편집 (admin)
- 자동 계산식(합계/증감률) 엔진
- 변경 이력 비교 뷰
- 보고서(PDF) 출력