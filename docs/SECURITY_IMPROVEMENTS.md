# 보안 개선 사항

회사 서비스 기준(OWASP, 프로덕션 준비 체크리스트)에 따라 부족한 부분을 수정했습니다.

**수정 일자**: 2025년 1월

---

## 수정 완료 사항

### 1. 계정 잠금 메커니즘 (OWASP A07)

**문제**: 로그인 실패 시 계정 잠금 메커니즘 부재로 브루트포스 공격에 취약

**수정 내용**:
- 로그인 실패 5회 시 계정 30분 잠금
- `users` 테이블에 `failed_login_attempts`, `locked_until` 필드 추가
- 로그인 성공 시 실패 횟수 초기화
- 잠금 시간 경과 시 자동 해제

**파일**:
- `backend/db/init.sql`: 데이터베이스 스키마 수정
- `backend/routes/auth-routes.js`: 로그인 로직에 계정 잠금 추가

**보안 로깅**:
- 계정 잠금 시 보안 이벤트 로깅
- 브루트포스 공격 시도 감지 및 로깅

---

### 2. 보안 이벤트 로깅 시스템 (OWASP A09)

**문제**: 보안 관련 이벤트 로깅 부재로 공격 탐지 및 대응 불가

**수정 내용**:
- `security_events` 테이블 추가
- 보안 이벤트 로깅 유틸리티 생성 (`backend/utils/security-logger.js`)
- 다음 이벤트 로깅:
  - 로그인 성공/실패
  - 계정 잠금/해제
  - 무단 접근 시도
  - 브루트포스 공격 시도
  - 토큰 만료/무효
  - 의심스러운 IP 감지

**파일**:
- `backend/db/init.sql`: `security_events` 테이블 추가
- `backend/utils/security-logger.js`: 보안 로깅 유틸리티

**이벤트 카테고리**:
- `authentication`: 인증 관련
- `authorization`: 인가 관련
- `data_access`: 데이터 접근
- `system`: 시스템 이벤트
- `suspicious`: 의심스러운 활동

**심각도 레벨**:
- `low`: 낮음
- `medium`: 중간
- `high`: 높음
- `critical`: 매우 높음

---

### 3. 비밀번호 정책 강화 (OWASP A07)

**문제**: 비밀번호 정책이 약함 (8자만 요구)

**수정 내용**:
- 비밀번호 검증 유틸리티 생성 (`backend/utils/password-validator.js`)
- 강화된 비밀번호 정책:
  - 최소 12자 이상 (최대 128자)
  - 대문자 최소 1개 포함
  - 소문자 최소 1개 포함
  - 숫자 최소 1개 포함
  - 특수문자 최소 1개 포함
  - 일반적인 비밀번호 사용 불가
  - 3개 이상 연속된 동일한 문자 사용 불가

**파일**:
- `backend/utils/password-validator.js`: 비밀번호 검증 유틸리티
- `backend/routes/auth-routes.js`: 회원가입 시 강화된 정책 적용

---

### 4. 리소스 소유자 확인 (OWASP A01)

**문제**: IDOR (Insecure Direct Object Reference) 취약점 - 다른 사용자의 리소스 접근 가능

**수정 내용**:
- 리소스 소유자 확인 미들웨어 생성 (`backend/middleware/resource-owner.js`)
- 비디오/작업 접근 시 소유자 확인
- 무단 접근 시도 시 보안 로깅

**파일**:
- `backend/middleware/resource-owner.js`: 소유자 확인 미들웨어
- `backend/routes/video-routes.js`: 비디오 조회/다운로드에 소유자 확인 추가
- `backend/routes/job-routes.js`: 작업 조회/취소에 소유자 확인 추가

**적용된 엔드포인트**:
- `GET /api/v1/videos/jobs/:jobId` - 비디오 정보 조회
- `GET /api/v1/videos/jobs/:jobId/download` - 비디오 다운로드
- `GET /api/v1/jobs/:jobId` - 작업 조회
- `POST /api/v1/jobs/:jobId/cancel` - 작업 취소
- `GET /api/v1/jobs` - 작업 목록 (로그인 사용자만, 자신의 작업만)

---

### 5. 인증 미들웨어 보안 로깅 강화

**수정 내용**:
- 토큰 만료/무효 시 보안 이벤트 로깅
- 인증 실패 시도 추적

**파일**:
- `backend/middleware/auth.js`: 토큰 검증 시 보안 로깅 추가

---

## 데이터베이스 변경 사항

### users 테이블 추가 필드
```sql
failed_login_attempts INTEGER DEFAULT 0,
locked_until TIMESTAMP,
last_login_at TIMESTAMP,
last_login_ip VARCHAR(45),
```

### security_events 테이블 (신규)
```sql
CREATE TABLE security_events (
    event_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 마이그레이션 필요 사항

기존 데이터베이스에 다음 마이그레이션을 적용해야 합니다:

```sql
-- users 테이블에 필드 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);

-- security_events 테이블 생성
-- (backend/db/init.sql의 security_events 테이블 생성 스크립트 실행)
```

---

## 테스트 권장 사항

1. **계정 잠금 테스트**:
   - 잘못된 비밀번호로 5회 로그인 시도
   - 계정 잠금 확인
   - 30분 후 자동 해제 확인

2. **비밀번호 정책 테스트**:
   - 약한 비밀번호로 회원가입 시도
   - 정책 위반 시 에러 메시지 확인

3. **리소스 소유자 확인 테스트**:
   - 다른 사용자의 비디오 ID로 접근 시도
   - 403 Forbidden 응답 확인
   - 보안 로그에 기록 확인

4. **보안 로깅 테스트**:
   - `security_events` 테이블에 이벤트 기록 확인
   - 로그 파일에 보안 이벤트 기록 확인

---

## 프로덕션 준비 체크리스트 업데이트

다음 항목이 완료되었습니다:

- [x] 계정 잠금 메커니즘 (5회 실패 시)
- [x] 보안 이벤트 로깅
- [x] 강력한 비밀번호 정책 (12자 이상, 복잡도)
- [x] 리소스 소유자 확인 (IDOR 방지)

---

## 참고 문서

- `OWASP_SECURITY_AUDIT.md`: OWASP Top 10 기반 보안 감사 리포트
- `PRODUCTION_READINESS_CHECKLIST.md`: 프로덕션 준비 체크리스트
- `SECURITY_VULNERABILITIES.md`: 보안 취약점 리포트

---

**작성일**: 2025년 1월  
**버전**: 1.0
