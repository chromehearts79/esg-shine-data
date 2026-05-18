# ESG 가이드라인 지표관리 — 기획 문서

## 1. 서비스 PRD

**서비스명**: ESG 가이드라인 지표관리
**목적**: ESG 담당부서가 계량/비계량 지표를 한곳에서 입력·관리하고, 조직 구성원이 실시간으로 동일한 데이터를 조회할 수 있도록 한다.
**핵심 가치**:
- 단일 진실 공급원(Single Source of Truth) — 엑셀 파일 난립 방지
- 실시간 공유 — 입력 즉시 다른 사용자도 최신 데이터 확인
- 입력 편의성 — 폼 입력 + 엑셀 업로드 동시 지원

**성공 지표(KPI 후보)**:
- 주간 지표 입력 건수
- 지표 커버리지(전체 가이드라인 대비 입력 완료율)
- 엑셀 업로드 성공률

## 2. 핵심 사용자 여정

1. 담당자가 로그인
2. 지표 목록 페이지에서 담당 지표(계량/비계량) 선택
3. 입력 방식 선택
   - (A) 폼으로 직접 입력 (값, 단위, 기간, 출처, 비고)
   - (B) 엑셀 템플릿 다운로드 → 작성 → 업로드 → 매핑 검증 → 일괄 저장
4. 저장 즉시 대시보드/조회 페이지에 반영
5. 조회자(다른 부서원)는 동일 페이지에서 실시간 갱신된 값 확인
6. 변경 이력 추적 가능

## 3. 페이지 목록

- `/login` 로그인
- `/` 대시보드 (지표 진행률, 최근 입력, 카테고리별 요약)
- `/indicators` 지표 목록 (필터: 카테고리/E·S·G/계량·비계량/연도)
- `/indicators/$id` 지표 상세 — 시계열 값, 입력 폼, 변경 이력
- `/upload` 엑셀 업로드 — 템플릿 다운로드, 파일 업로드, 매핑/검증 미리보기
- `/admin/indicators` 지표 마스터 관리 (관리자) — 지표 정의 CRUD
- `/admin/users` 사용자/권한 관리 (관리자)
- `/audit` 변경 이력/감사 로그

## 4. 데이터 모델

**indicator_categories**
- id, code, name, esg_type(E|S|G), description

**indicators** (지표 마스터)
- id, category_id, code (예: E-1-1), name, type (`quantitative` | `qualitative`), unit, description, guideline_ref, is_active

**indicator_values** (실제 입력 데이터)
- id, indicator_id, period_year, period_quarter (nullable), numeric_value (nullable), text_value (nullable), source, note, status (`draft`|`submitted`|`approved`), created_by, created_at, updated_at

**uploads** (엑셀 업로드 기록)
- id, file_path, uploaded_by, status, row_count, error_count, created_at

**audit_logs**
- id, entity_type, entity_id, action, diff(jsonb), user_id, created_at

**user_roles** (별도 테이블, 권한)
- id, user_id, role (`admin` | `editor` | `viewer`)

## 5. 인증/권한 구조

- 인증: Lovable Cloud 이메일/비밀번호 (필요 시 SSO 확장)
- 역할(별도 `user_roles` 테이블, app_role enum):
  - `admin`: 지표 마스터 정의, 사용자/권한 관리, 모든 데이터 CRUD
  - `editor`: 담당 지표 입력/수정, 엑셀 업로드
  - `viewer`: 조회만
- RLS 정책: `has_role()` SECURITY DEFINER 함수 사용
  - viewer: SELECT 가능
  - editor: 본인이 담당하는 카테고리 INSERT/UPDATE
  - admin: 전체
- 실시간: Supabase Realtime 채널로 `indicator_values` 구독 → 다른 사용자 화면 즉시 갱신

## 6. MVP vs 추후 확장

**MVP**
- 로그인 + 역할(admin/editor/viewer)
- 지표 마스터(시드 데이터로 시작)
- 지표 목록 / 상세 / 값 입력 폼
- 엑셀 템플릿 다운로드 + 업로드 → 검증 → 일괄 저장
- 실시간 반영 (Realtime 구독)
- 기본 대시보드 (입력 건수, 카테고리별 진행률)

**추후 확장**
- 승인 워크플로우 (draft → submitted → approved)
- 변경 이력 UI 및 롤백
- 자동 리포트 PDF/엑셀 다운로드
- 외부 ESG 공시 표준(GRI, SASB, K-ESG) 매핑
- 알림(메일/슬랙) — 입력 마감 임박
- 다국어, 부서별 KPI, 외부 데이터 연동 API
- 첨부파일(증빙) 업로드

## 7. 추가로 답이 필요한 질문

1. **지표 정의 출처**: 사용할 ESG 가이드라인이 정해져 있나요? (예: K-ESG, GRI, 사내 자체 지표) 초기 시드 지표 목록(엑셀/문서)이 있으면 공유 부탁드립니다.
2. **입력 주기**: 연 단위인가요, 분기/월 단위까지 필요한가요?
3. **승인 절차**: 입력 → 바로 공개인가요, 아니면 검토자 승인 단계가 필요한가요? (MVP 포함 여부)
4. **사용자 규모/계정 생성**: 자가 가입 허용인가요, 관리자가 초대만 허용인가요? 대략적인 사용자 수는?
5. **엑셀 템플릿**: 기존에 쓰는 양식이 있나요? 있다면 그대로 따라 만들겠습니다.
6. **첨부 증빙**: 지표 값과 함께 증빙 파일(PDF 등) 업로드가 MVP에 필요한가요?
7. **외부 공개**: 조회 전용 공개 페이지(로그인 없이)도 필요한가요?
8. **다국어**: 한국어 단일인지, 영문도 필요한지?

답변 주시면 위 계획을 확정하고 구현 단계로 넘어가겠습니다.
