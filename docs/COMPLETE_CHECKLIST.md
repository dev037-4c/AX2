# 완전한 구현 체크리스트 (회사 운영 기준)

**작성일**: 2025년 1월

---

## 📋 사용자 흐름별 구현 체크리스트

### 흐름: 업로드 → 처리 → 확인 → 다운로드 → 관리

---

## ✅ 1. 업로드 (index.html)

### 화면
- [x] `index.html` - 업로드 페이지
- [x] 드래그 앤 드롭 UI
- [x] 파일 선택 버튼
- [x] 진행률 표시

### API
- [x] `POST /api/videos/upload`
- [x] 파일 검증 (확장자 + MIME)
- [x] 파일 크기 제한 (2GB)
- [x] Rate Limit (15분당 10회)
- [x] 업로드 쿼터 체크

### DB
- [x] `video_jobs` 테이블
- [x] `id`, `user_id`, `title`, `original_name`, `video_path`
- [x] `size` (마이그레이션 필요)
- [x] `status = 'queued'`

### 연결
- [x] `js/api-upload.js` → `POST /api/videos/upload`
- [x] 응답 → `jobId` 저장
- [x] 다음 단계로 이동

---

## ✅ 2. 작업 처리 (백그라운드)

### API
- [x] `simulateJobProcessing()` - Mock 처리
- [x] 상태 전환: `queued` → `processing` → `completed`
- [x] 진행률 업데이트 (`progress`)
- [x] 에러 처리 (`error_message`)
- [x] 워커 프로세스 (`worker.js`)
- [x] 동시 처리 제한 (3개)

### DB
- [x] `video_jobs.status` 업데이트
- [x] `video_jobs.progress` 업데이트
- [x] `video_jobs.error_message` 저장
- [x] `video_jobs.completed_at` 저장
- [x] `video_jobs.expires_at` 계산 (7일 후)
- [x] `job_results` 테이블에 결과 저장

### 연결
- [x] 업로드 성공 → `simulateJobProcessing()` 자동 시작
- [x] 워커 프로세스가 주기적으로 Job 처리

---

## ✅ 3. 결과 확인 (edit.html)

### 화면
- [x] `html/edit.html` - 편집 페이지
- [x] 영상 미리보기
- [x] 자막 표시
- [x] 언어 선택

### API
- [x] `GET /api/jobs/:id` - Job 상태 조회
- [x] `GET /api/jobs/:id/subtitles` - 자막 데이터 조회

### DB
- [x] `video_jobs` 조회
- [x] `job_results` 조회
- [x] 자막 JSON 파일 읽기

### 연결
- [x] URL 파라미터 `?id={jobId}` → Job 조회
- [x] 상태가 `completed`면 자막 표시
- [x] 상태가 `processing`이면 진행률 표시

---

## ✅ 4. 다운로드 (edit.html, storage.html)

### 화면
- [x] 다운로드 버튼 (SRT, VTT, JSON)
- [x] 형식 선택

### API
- [x] `GET /api/jobs/:id/subtitle?format=srt|vtt|json&lang=ko`
- [x] 권한 체크 (소유자만)
- [x] 형식별 변환

### DB
- [x] `video_jobs` 권한 확인
- [x] `job_results` 파일 경로 조회

### 연결
- [x] 다운로드 버튼 클릭 → API 호출
- [x] 파일 다운로드

---

## ✅ 5. 저장소 관리 (storage.html)

### 화면
- [x] `html/storage.html` - 저장소 페이지
- [x] 작업 목록 표시
- [x] 필터링 (전체/처리중/완료/만료예정)
- [x] 검색 기능
- [x] 삭제 버튼

### API
- [x] `GET /api/storage?status=all&search=검색어`
- [x] `DELETE /api/storage/:id`
- [x] `POST /api/jobs/:id/retry` - 재시도
- [x] `POST /api/jobs/:id/reprocess` - 재처리

### DB
- [x] `video_jobs` 목록 조회
- [x] 사용자별 필터링
- [x] 상태별 필터링
- [x] 검색 (제목, 파일명)

### 연결
- [x] `js/mypage.js` → `GET /api/storage`
- [x] 목록 렌더링
- [x] 삭제 버튼 → `DELETE /api/storage/:id`
- [ ] **재시도 버튼** → `POST /api/jobs/:id/retry` (UI 추가 필요)
- [ ] **에러 메시지 표시** (UI 추가 필요)
- [ ] **만료일 표시** (UI 추가 필요)

---

## ✅ 6. 만료 삭제 (자동)

### 백그라운드
- [x] `cleanupExpiredJobs()` - 만료 Job 정리
- [x] 스케줄러 (1시간마다)
- [x] 파일 삭제
- [x] DB 상태 업데이트

### 검증
- [x] `scripts/verify-cleanup.sh` - 검증 스크립트
- [x] 만료되었지만 삭제되지 않은 Job 확인
- [x] 삭제 상태이지만 파일이 남아있는 Job 확인

### 연결
- [x] 서버 시작 시 스케줄러 자동 시작
- [x] 1시간마다 자동 실행

---

## ✅ 7. 인증/권한

### 화면
- [x] `html/login.html` - 로그인 페이지
- [x] `html/signup.html` - 회원가입 페이지

### API
- [x] `POST /api/v1/auth/login` - 로그인
- [x] `POST /api/v1/auth/signup` - 회원가입
- [x] `POST /api/v1/auth/refresh` - 토큰 갱신
- [x] `GET /api/v1/auth/me` - 사용자 정보

### 연결
- [x] 로그인 → JWT 토큰 저장
- [x] 모든 API 호출 시 토큰 자동 포함
- [x] 권한 체크 (소유자만 접근)

---

## 🚨 즉시 추가 필요 항목

### 1. DB 마이그레이션
- [ ] `retry_count` 필드 추가
- [ ] `size` 필드 추가

### 2. UI 개선
- [ ] 에러 메시지 표시 (`storage.html`)
- [ ] 재시도 버튼 (`storage.html`)
- [ ] 만료일 표시 (`storage.html`)
- [ ] 쿼터 초과 에러 메시지 (`index.html`)

### 3. 서버 설정
- [x] 업로드 쿼터 미들웨어 적용
- [x] 재시도/재처리 라우트 연결
- [x] 파일 크기 저장

---

## 📊 완료도

### 완료 (✅)
- 업로드 API: 100%
- 작업 처리: 100%
- 저장소 목록: 100%
- 다운로드: 100%
- 만료 삭제: 100%
- 인증/권한: 100%
- 재시도/재처리: 100%
- 업로드 쿼터: 100%

### 추가 필요 (⚠️)
- DB 마이그레이션: 0%
- UI 개선: 0%
- 정책 문서: 0%

---

## 🎯 다음 액션

### 즉시 (오늘)
1. DB 마이그레이션 실행
2. 서버 재시작
3. 기능 테스트

### 이번 주
4. UI 개선 (에러 메시지, 재시도 버튼, 만료일)
5. 정책 문서 작성

### 나중에
6. 실제 STT/번역 엔진
7. 결제/크레딧 시스템

---

**작성일**: 2025년 1월


