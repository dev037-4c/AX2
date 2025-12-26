# 회사 운영 필수 7가지 (최종 체크리스트)

**작성일**: 2025년 1월

---

## ✅ 1. 인증/권한 (무조건)

### 구현 상태
- [x] JWT 토큰 인증
- [x] 로그인 사용자만 작업 생성 가능
- [x] 작업(jobId)은 소유자만 조회/다운로드/삭제 가능
- [x] 게스트 토큰 시스템 (비로그인 사용자 제한)

### 파일
- `ax2-api/middleware/auth.js` - 인증 미들웨어
- `ax2-api/middleware/guest-token.js` - 게스트 토큰
- `js/token-manager.js` - 토큰 관리

### 적용 방법
```bash
# 서버 재시작
sudo systemctl restart ax2-caption-api
```

---

## ✅ 2. 업로드 남용 방지 (무조건)

### 구현 상태
- [x] IP당 업로드 횟수/분 제한 (Rate Limit)
- [x] 비로그인 업로드 용량/횟수 더 강하게 제한
  - 비로그인: 15분당 3회, 100MB/일
  - 로그인: 15분당 10회, 1GB/월 (무료), 10GB/월 (유료)
- [x] 파일 확장자 + MIME 타입 이중 검증

### 파일
- `ax2-api/middleware/rate-limit-ip.js` - IP별 Rate Limit
- `ax2-api/middleware/upload-quota.js` - 업로드 쿼터
- `ax2-api/middleware/file-validator.js` - 파일 검증

### 적용 방법
```bash
# 서버 재시작
sudo systemctl restart ax2-caption-api
```

---

## ✅ 3. 워커 분리 (강력 권장)

### 구현 상태
- [x] API 서버: 요청 처리만 (`server.js`)
- [x] 워커: STT/번역/자막 생성 작업 처리 (`worker.js`)
- [x] systemd 서비스 2개 분리

### 파일
- `ax2-api/server.js` - API 서버
- `ax2-api/worker.js` - 워커 프로세스
- `ax2-api/systemd/ax2-caption-api.service` - API 서비스
- `ax2-api/systemd/ax2-caption-worker.service` - 워커 서비스

### 적용 방법
```bash
# 서비스 등록
sudo cp ax2-api/systemd/ax2-caption-api.service /etc/systemd/system/
sudo cp ax2-api/systemd/ax2-caption-worker.service /etc/systemd/system/

# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable ax2-caption-api
sudo systemctl enable ax2-caption-worker
sudo systemctl start ax2-caption-api
sudo systemctl start ax2-caption-worker

# 상태 확인
sudo systemctl status ax2-caption-api
sudo systemctl status ax2-caption-worker
```

---

## ✅ 4. 진행률(progress) 제공

### 구현 상태
- [x] `video_jobs.progress` 필드 (0-100)
- [x] 상태 전환: `queued` → `processing` → `completed`
- [x] API에서 진행률 반환
- [x] 프론트엔드에서 진행률 표시

### 파일
- `ax2-api/server.js` - 진행률 업데이트
- `js/job-api.js` - 진행률 조회
- `html/edit.html` - 진행률 표시

---

## ✅ 5. 만료 삭제 "검증 + 모니터링"

### 구현 상태
- [x] 7일 삭제 스케줄러 (`cleanupExpiredJobs`)
- [x] 실제 파일까지 삭제 확인
- [x] 디스크 80% 알림 (`scripts/check-disk-usage.sh`)
- [x] 삭제 로그 남기기

### 파일
- `ax2-api/server.js` - 삭제 스케줄러
- `scripts/verify-cleanup.sh` - 삭제 검증
- `scripts/check-disk-usage.sh` - 디스크 모니터링

### 적용 방법
```bash
# 검증 스크립트 실행
./scripts/verify-cleanup.sh

# cron 등록 (매일 오전 2시)
0 2 * * * /path/to/scripts/verify-cleanup.sh >> /var/log/ax2-caption/cleanup-verify.log 2>&1
```

---

## ✅ 6. 백업/롤백

### 구현 상태
- [x] DB 백업 스크립트 (`scripts/backup-db.sh`)
- [x] 일 1회 백업 + 7일 보관
- [x] Git 기반 롤백 스크립트 (`scripts/rollback-deployment.sh`)

### 파일
- `scripts/backup-db.sh` - DB 백업
- `scripts/rollback-deployment.sh` - 배포 롤백

### 적용 방법
```bash
# DB 백업 (수동)
./scripts/backup-db.sh

# cron 등록 (매일 오전 3시)
0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/ax2-caption/backup.log 2>&1

# 배포 롤백 (필요 시)
./scripts/rollback-deployment.sh [버전/커밋]
```

---

## ✅ 7. 운영 정책 고정

### 구현 상태
- [x] 이용약관 (`docs/TERMS_OF_SERVICE.md`)
- [x] 개인정보 처리방침 (`docs/PRIVACY_POLICY.md`)
- [x] 고객 지원 가이드 (`docs/SUPPORT_GUIDE.md`)
- [x] 업로드 파일 처리 목적, 보관기간(7일), 삭제 정책 명시

### 파일
- `docs/TERMS_OF_SERVICE.md` - 이용약관
- `docs/PRIVACY_POLICY.md` - 개인정보 처리방침
- `docs/SUPPORT_GUIDE.md` - 고객 지원 가이드

### 적용 방법
- 웹사이트에 링크 추가
- 회원가입 시 약관 동의 체크박스

---

## 📊 최종 체크리스트

### 완료된 항목 (✅)
- [x] 인증/권한 (JWT + 게스트 토큰)
- [x] 업로드 남용 방지 (IP별 Rate Limit + 쿼터)
- [x] 워커 분리 (API 서버 + 워커 프로세스)
- [x] 진행률 제공
- [x] 만료 삭제 검증 + 모니터링
- [x] 백업/롤백
- [x] 운영 정책 문서

### 적용 필요 (⚠️)
- [ ] 서비스 등록 및 시작
- [ ] cron 작업 등록
- [ ] 정책 문서 웹사이트 연결

---

## 🚀 즉시 적용 방법

### 1. 서비스 등록
```bash
# API 서버
sudo cp ax2-api/systemd/ax2-caption-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ax2-caption-api
sudo systemctl start ax2-caption-api

# 워커
sudo cp ax2-api/systemd/ax2-caption-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ax2-caption-worker
sudo systemctl start ax2-caption-worker
```

### 2. cron 작업 등록
```bash
crontab -e

# 다음 내용 추가:
# 디스크 용량 모니터링 (매시간)
0 * * * * /path/to/scripts/check-disk-usage.sh >> /var/log/ax2-caption/disk-usage.log 2>&1

# 만료 삭제 검증 (매일 오전 2시)
0 2 * * * /path/to/scripts/verify-cleanup.sh >> /var/log/ax2-caption/cleanup-verify.log 2>&1

# DB 백업 (매일 오전 3시)
0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/ax2-caption/backup.log 2>&1

# 서비스 모니터링 (5분마다)
*/5 * * * * /path/to/scripts/monitor-services.sh >> /var/log/ax2-caption/service-monitor.log 2>&1
```

### 3. 정책 문서 연결
- 웹사이트 푸터에 링크 추가
- 회원가입 페이지에 약관 동의 체크박스

---

## ✅ 회사 운영 가능 기준 달성

다음 조건이 모두 만족되면 회사 서비스로 운영 가능:

- ✅ API + DB로 업로드/작업/결과/저장소가 실제 동작
- ✅ 인증/권한이 적용되어 데이터가 섞이지 않음
- ✅ 남용 방지로 디스크/서버가 쉽게 죽지 않음
- ✅ 7일 만료 삭제가 자동으로 실행되고 로그가 남음
- ✅ 서비스 재시작(systemd)과 기본 모니터링(디스크/프로세스)이 있음

---

**작성일**: 2025년 1월


