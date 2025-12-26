# 최종 배포 가이드 (회사 운영 기준)

**작성일**: 2025년 1월

---

## 🚀 즉시 적용 방법 (lx2-web02 서버 기준)

### 1. 서비스 등록 (systemd 2개 서비스)

```bash
# API 서버 등록
sudo cp ax2-api/systemd/ax2-caption-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ax2-caption-api
sudo systemctl start ax2-caption-api

# 워커 등록
sudo cp ax2-api/systemd/ax2-caption-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ax2-caption-worker
sudo systemctl start ax2-caption-worker

# 상태 확인
sudo systemctl status ax2-caption-api --no-pager
sudo systemctl status ax2-caption-worker --no-pager
```

### 2. Rate Limit 적용 확인

**이미 적용됨**:
- 비로그인: 15분당 3회 (IP 기반)
- 로그인: 15분당 10회 (사용자 ID 기반)
- 일반 API: 15분당 200회 (IP 기반)

**파일**: `ax2-api/middleware/rate-limit-ip.js`

### 3. 게스트 토큰 시스템

**이미 적용됨**:
- 비로그인 사용자에게 게스트 토큰 자동 발급
- 게스트 토큰 기반 업로드 제한 (최대 3회)
- 24시간 만료

**파일**: `ax2-api/middleware/guest-token.js`

### 4. cron 작업 등록

```bash
crontab -e

# 다음 내용 추가:
# 디스크 용량 모니터링 (매시간)
0 * * * * /data/lx2/ax2-caption/scripts/check-disk-usage.sh >> /var/log/ax2-caption/disk-usage.log 2>&1

# 만료 삭제 검증 (매일 오전 2시)
0 2 * * * /data/lx2/ax2-caption/scripts/verify-cleanup.sh >> /var/log/ax2-caption/cleanup-verify.log 2>&1

# DB 백업 (매일 오전 3시)
0 3 * * * /data/lx2/ax2-caption/scripts/backup-db.sh >> /var/log/ax2-caption/backup.log 2>&1

# 서비스 모니터링 (5분마다)
*/5 * * * * /data/lx2/ax2-caption/scripts/monitor-services.sh >> /var/log/ax2-caption/service-monitor.log 2>&1

# Apache 설정 점검 (매일 오전 9시)
0 9 * * * /data/lx2/ax2-caption/scripts/check-apache-config.sh >> /var/log/ax2-caption/apache-check.log 2>&1
```

---

## ✅ 회사 운영 필수 7가지 완료 상태

### 1. 인증/권한 ✅
- [x] JWT 토큰 인증
- [x] 게스트 토큰 시스템
- [x] 소유자만 접근 가능

### 2. 업로드 남용 방지 ✅
- [x] IP별 Rate Limit
- [x] 비로그인 더 강한 제한
- [x] 파일 이중 검증

### 3. 워커 분리 ✅
- [x] API 서버 (요청 처리)
- [x] 워커 프로세스 (작업 처리)
- [x] systemd 2개 서비스

### 4. 진행률 제공 ✅
- [x] progress 필드 (0-100)
- [x] 상태 전환 표시

### 5. 만료 삭제 검증 ✅
- [x] 자동 삭제 스케줄러
- [x] 검증 스크립트
- [x] 디스크 모니터링

### 6. 백업/롤백 ✅
- [x] DB 백업 스크립트
- [x] Git 기반 롤백

### 7. 운영 정책 ✅
- [x] 이용약관
- [x] 개인정보 처리방침
- [x] 고객 지원 가이드

---

## 📋 최종 체크리스트

### 서버 설정
- [ ] systemd 서비스 등록 (API + 워커)
- [ ] cron 작업 등록
- [ ] 환경변수 설정 (`.env`)

### 기능 테스트
- [ ] 업로드 테스트
- [ ] 게스트 토큰 테스트
- [ ] Rate Limit 테스트
- [ ] 재시도 API 테스트

### 모니터링
- [ ] 디스크 용량 확인
- [ ] 서비스 상태 확인
- [ ] 로그 확인

---

**작성일**: 2025년 1월


