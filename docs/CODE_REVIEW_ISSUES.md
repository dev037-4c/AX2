# 코드 리뷰 및 수정 사항

**작성일**: 2025년 1월

---

## 🔍 발견된 문제점 및 수정

### 1. CORS 설정 오류 ✅ 수정됨

**문제**: `split` 함수가 호출되지 않음
```javascript
// 잘못된 코드
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split;

// 수정된 코드
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
```

**위치**: `ax2-api/server.js:247`

---

### 2. 에러 처리 일관성 ✅ 수정됨

**문제**: 일부 API에서 `next(error)` 대신 직접 `res.status().json()` 사용

**수정된 파일**:
- `GET /api/jobs/:id` - `next(error)` 사용
- `GET /api/jobs/:id/subtitle` - `next(error)` 사용
- `GET /api/storage` - `next(error)` 사용
- `DELETE /api/storage/:id` - `next(error)` 사용

**이점**: 전역 에러 핸들러가 모든 에러를 일관되게 처리

---

### 3. 로깅 개선 ✅ 수정됨

**문제**: `console.error` 대신 `logger.error` 사용 필요

**수정**: 모든 에러 로깅을 `logger.error`로 변경하고 `requestId` 포함

---

## ✅ 확인 완료된 항목

### 1. 의존성 패키지
- [x] 모든 필수 패키지 포함 (`package.json`)
- [x] `express-rate-limit`, `helmet`, `jsonwebtoken` 포함

### 2. 미들웨어 연결
- [x] `requestLogger` 적용
- [x] `guestTokenMiddleware` 적용
- [x] `ipApiLimiter` 적용
- [x] `authenticateToken` 적용
- [x] `errorHandler` 적용 (모든 라우트 이후)

### 3. API 엔드포인트
- [x] `POST /api/videos/upload` - 업로드
- [x] `GET /api/jobs/:id` - Job 상태 조회
- [x] `GET /api/jobs/:id/subtitle` - 자막 다운로드
- [x] `POST /api/jobs/:id/retry` - 재시도
- [x] `POST /api/jobs/:id/reprocess` - 재처리
- [x] `GET /api/storage` - 작업 목록
- [x] `DELETE /api/storage/:id` - 작업 삭제

### 4. 함수 정의
- [x] `generateMockSubtitles()` - 정의됨
- [x] `convertToSRT()` - 정의됨
- [x] `convertToVTT()` - 정의됨
- [x] `cleanupExpiredJobs()` - 정의됨
- [x] `startScheduler()` - 정의됨

### 5. DB 연결
- [x] `db.js` - 연결 풀 설정
- [x] 환경변수 기반 설정

### 6. 파일 검증
- [x] 확장자 검증
- [x] MIME 타입 검증
- [x] 파일명 정제

---

## ⚠️ 주의 사항

### 1. 게스트 토큰 저장소
**현재**: 메모리 (Map)
**권장**: Redis (프로덕션 환경)

**파일**: `ax2-api/middleware/guest-token.js:10`
```javascript
// 현재: 메모리 저장
const guestTokens = new Map();

// 권장: Redis 사용
// const redis = require('redis');
// const client = redis.createClient();
```

### 2. 업로드 쿼터 계산
**현재**: DB에서 `SUM(size)` 계산
**주의**: `size` 필드가 NULL일 수 있음

**해결**: 마이그레이션 실행 필요
```sql
ALTER TABLE video_jobs ADD COLUMN size BIGINT NULL;
```

### 3. 재시도 횟수 필드
**현재**: `retry_count` 필드 사용
**주의**: 필드가 없으면 기본값 0 사용

**해결**: 마이그레이션 실행 필요
```sql
ALTER TABLE video_jobs ADD COLUMN retry_count INT DEFAULT 0;
```

---

## 🧪 테스트 체크리스트

### 백엔드 API 테스트
- [ ] `POST /api/videos/upload` - 파일 업로드
- [ ] `GET /api/jobs/:id` - Job 상태 조회
- [ ] `GET /api/jobs/:id/subtitle` - 자막 다운로드
- [ ] `POST /api/jobs/:id/retry` - 재시도
- [ ] `GET /api/storage` - 작업 목록
- [ ] `DELETE /api/storage/:id` - 작업 삭제

### 보안 테스트
- [ ] Rate Limit 동작 확인
- [ ] 게스트 토큰 발급 확인
- [ ] 권한 체크 동작 확인
- [ ] 파일 검증 동작 확인

### 워커 테스트
- [ ] 워커 프로세스 시작 확인
- [ ] Job 처리 확인
- [ ] 동시 처리 제한 확인

---

## 📋 즉시 해야 할 작업

### 1. DB 마이그레이션 실행
```bash
mysql -u ax2 -p ax2_caption < ax2-api/db-migration-add-fields.sql
```

### 2. 서버 재시작
```bash
sudo systemctl restart ax2-caption-api
```

### 3. 기능 테스트
```bash
# Health check
curl http://localhost:3000/api/health

# 업로드 테스트
curl -X POST -F "video=@test.mp4" http://localhost:3000/api/videos/upload
```

---

## ✅ 최종 확인

### 코드 품질
- [x] 모든 import 정상
- [x] 모든 함수 정의됨
- [x] 에러 처리 일관성
- [x] 로깅 개선

### 기능 완성도
- [x] 업로드 API
- [x] Job 처리
- [x] 다운로드 API
- [x] 재시도/재처리
- [x] 만료 삭제

### 보안
- [x] 인증/권한
- [x] Rate Limit
- [x] 파일 검증
- [x] 쿼터 제한

---

**작성일**: 2025년 1월


