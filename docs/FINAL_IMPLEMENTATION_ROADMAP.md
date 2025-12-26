# 최종 구현 로드맵 (회사 운영 기준)

**작성일**: 2025년 1월

---

## 📋 사용자 흐름 기반 구현 체크리스트

### 사용자 시나리오
**업로드** → **작업 처리** → **결과 확인** → **다운로드** → **저장소 관리**

---

## ✅ 1단계: 업로드 API + DB 저장

### 백엔드 API
- [x] `POST /api/videos/upload` - 파일 업로드
- [x] 파일 검증 (확장자 + MIME 타입 이중 체크)
- [x] 파일명 정제 (UUID 사용, 원본명은 DB만)
- [x] DB에 Job 생성 (`video_jobs` 테이블)
- [x] `user_id` 저장 (로그인/비로그인 구분)
- [x] Rate Limit (15분당 10회)
- [ ] **업로드 쿼터 미들웨어 적용** (추가 필요)
- [ ] **파일 크기(`size`) DB 저장** (추가 필요)

### 프론트엔드
- [x] `js/api-upload.js` - 업로드 API 호출
- [x] 업로드 진행률 표시
- [x] 에러 처리
- [ ] **쿼터 초과 에러 메시지 표시** (추가 필요)

### DB 테이블
- [x] `video_jobs` 테이블
- [ ] **`size` 필드 추가** (마이그레이션 필요)
- [ ] **`retry_count` 필드 추가** (마이그레이션 필요)

### 보안
- [x] 파일 크기 제한 (2GB)
- [x] 파일 타입 검증
- [x] 업로드 경로 직접 접근 차단
- [x] 업로드 쿼터 미들웨어 생성 (`upload-quota.js`)
- [ ] **쿼터 미들웨어 적용** (서버에 연결 필요)

---

## ✅ 2단계: 작업 처리 (Mock → 실제)

### 백엔드 API
- [x] `simulateJobProcessing()` - Mock 처리
- [x] 상태 전환: `queued` → `processing` → `completed`
- [x] 진행률 업데이트 (`progress`)
- [x] 에러 메시지 저장 (`error_message`)
- [x] 워커 프로세스 분리 (`worker.js`)
- [x] 동시 처리 제한 (기본 3개)
- [x] 재시도 API (`POST /api/jobs/:id/retry`)
- [x] 재처리 API (`POST /api/jobs/:id/reprocess`)
- [ ] **재시도 라우트 서버에 연결** (추가 필요)
- [ ] **실제 STT/번역 엔진 연동** (나중에)

### 프론트엔드
- [x] `js/job-api.js` - Job 상태 조회
- [x] 폴링 (주기적 상태 확인)
- [x] 진행률 표시
- [ ] **에러 메시지 UI 표시** (추가 필요)
- [ ] **재시도 버튼 UI** (추가 필요)

### DB 테이블
- [x] `video_jobs.status` - 작업 상태
- [x] `video_jobs.progress` - 진행률 (0-100)
- [x] `video_jobs.error_message` - 에러 메시지
- [x] `video_jobs.retry_count` - 재시도 횟수 (마이그레이션 필요)

---

## ✅ 3단계: 저장소 목록/다운로드

### 백엔드 API
- [x] `GET /api/storage` - 작업 목록 조회
- [x] 사용자별 필터링 (소유자만)
- [x] 상태별 필터링 (`all`, `processing`, `completed`, `expiring`)
- [x] 검색 기능
- [x] `GET /api/jobs/:id/subtitle` - 자막 다운로드
- [x] **권한 체크 강화** (소유자만 다운로드)
- [x] 형식별 다운로드 (SRT, VTT, JSON)
- [x] `DELETE /api/storage/:id` - 작업 삭제

### 프론트엔드
- [x] `html/storage.html` - 저장소 페이지
- [x] `js/mypage.js` - 작업 목록 표시
- [x] 필터링/검색 UI
- [x] 다운로드 버튼
- [ ] **만료일(`expires_at`) 표시** (추가 필요)
- [ ] **에러 메시지 표시** (추가 필요)
- [ ] **재시도 버튼** (추가 필요)

### DB 테이블
- [x] `job_results` - 자막 결과 파일 메타
- [x] `video_jobs.expires_at` - 만료일

---

## ✅ 4단계: 7일 만료 삭제

### 백엔드
- [x] `cleanupExpiredJobs()` - 만료 Job 정리
- [x] 스케줄러 (1시간마다 실행)
- [x] 파일 삭제 (업로드 + 결과)
- [x] DB 상태 업데이트 (`deleted`)
- [x] **검증 스크립트** (`scripts/verify-cleanup.sh`)

### 검증
- [x] 만료되었지만 삭제되지 않은 Job 확인
- [x] 삭제 상태이지만 파일이 남아있는 Job 확인
- [x] 로그 기록

---

## ✅ 5단계: 인증/권한 (회사 운영 필수)

### 백엔드
- [x] JWT 토큰 인증
- [x] `authenticateToken` 미들웨어
- [x] 사용자별 데이터 분리
- [x] 다운로드 권한 체크
- [x] 삭제 권한 체크

### 프론트엔드
- [x] `js/token-manager.js` - 토큰 관리
- [x] `js/auth-api.js` - 인증 API
- [x] API 호출 시 토큰 자동 포함

---

## 🚨 즉시 추가해야 할 항목

### 1. DB 마이그레이션
```sql
-- 실행 필요
ALTER TABLE video_jobs 
ADD COLUMN retry_count INT DEFAULT 0 AFTER error_message,
ADD COLUMN size BIGINT NULL AFTER video_path;
```

### 2. 서버 설정 연결
- [ ] 업로드 쿼터 미들웨어 적용 (`server.js`)
- [ ] 재시도/재처리 라우트 연결 (`server.js`)
- [ ] 업로드 시 파일 크기 저장

### 3. UI 개선
- [ ] 에러 메시지 표시 (`storage.html`, `mypage.js`)
- [ ] 재시도 버튼 (`storage.html`, `mypage.js`)
- [ ] 만료일 표시 (`storage.html`, `mypage.js`)
- [ ] 쿼터 초과 에러 메시지 (`index.html`)

---

## 📊 우선순위별 작업 순서

### 즉시 (이번 주)
1. ✅ 업로드 API + DB 저장
2. ✅ 작업 처리 (Mock)
3. ✅ 저장소 목록/다운로드
4. ✅ 7일 만료 삭제
5. ✅ 인증/권한
6. ⚠️ **DB 마이그레이션 실행**
7. ⚠️ **서버 설정 연결** (쿼터, 재시도)
8. ⚠️ **UI 개선** (에러 메시지, 재시도 버튼)

### 다음 주
9. 사용자별 업로드 쿼터 적용
10. IP별 Rate Limit 강화
11. 정책 문서 작성

### 나중에
12. 실제 STT/번역 엔진 연동
13. 결제/크레딧 시스템
14. 관리자 페이지
15. S3 스토리지 교체

---

## 📝 필수 문서 3개

### 1. 운영 가이드 ✅
- [x] `docs/PRODUCTION_OPERATIONS.md`
- [x] 배포/재시작/로그/장애 확인

### 2. 정책 문서 (추가 필요)
- [ ] `docs/TERMS_OF_SERVICE.md` - 이용약관
- [ ] `docs/PRIVACY_POLICY.md` - 개인정보 처리방침
- [ ] 보관기간 7일, 삭제 정책 명시

### 3. SLA/문의 흐름 (추가 필요)
- [ ] `docs/SUPPORT_GUIDE.md` - 문의 접수 → 확인 → 처리

---

## ✅ 최종 체크리스트 요약

### 완료된 항목 (✅)
- [x] 업로드 API
- [x] 작업 처리 (Mock)
- [x] 저장소 목록/다운로드
- [x] 만료 삭제
- [x] 인증/권한
- [x] Rate Limit
- [x] 파일 검증
- [x] 워커 분리
- [x] 모니터링 스크립트
- [x] 재시도/재처리 API
- [x] 업로드 쿼터 미들웨어

### 즉시 추가 필요 (⚠️)
- [ ] DB 마이그레이션 실행
- [ ] 서버 설정 연결 (쿼터, 재시도)
- [ ] UI 개선 (에러 메시지, 재시도 버튼, 만료일)

### 나중에 (📅)
- [ ] 정책 문서
- [ ] 문의 가이드
- [ ] 실제 STT/번역 엔진

---

**작성일**: 2025년 1월


