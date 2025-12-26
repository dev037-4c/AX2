# 즉시 적용해야 하는 중요 수정 사항

**작성일**: 2025년 1월

---

## 🚨 가장 위험한 항목 (즉시 적용)

### 1. 업로드 제한/타임아웃 설정 ✅

#### Apache 설정
**파일**: `/etc/apache2/sites-available/lx2.kr.conf`

```apache
# 업로드 크기 제한 (2GB)
LimitRequestBody 2147483648

# 타임아웃 설정 (10분)
Timeout 600

# 프록시 타임아웃
<Location /api>
    ProxyPass http://127.0.0.1:3000/api
    ProxyPassReverse http://127.0.0.1:3000/api
    ProxyTimeout 600
</Location>
```

**설정 적용**:
```bash
sudo nano /etc/apache2/sites-available/lx2.kr.conf
# 위 설정 추가 후
sudo systemctl reload apache2
```

#### Node.js 서버 타임아웃 ✅
**파일**: `ax2-api/server.js`

- 서버 타임아웃: 10분 (600초)
- Keep-Alive 타임아웃: 65초
- Headers 타임아웃: 66초

**적용 완료**: 이미 구현됨

---

### 2. 만료 삭제 검증 ✅

#### 검증 스크립트
**파일**: `scripts/verify-cleanup.sh`

**사용법**:
```bash
./scripts/verify-cleanup.sh
```

**확인 항목**:
- 만료되었지만 아직 삭제되지 않은 Job
- 삭제 상태이지만 파일이 남아있는 Job
- 만료 예정 Job (D-3)

**cron 설정**:
```bash
# 매일 오전 2시 실행
0 2 * * * /path/to/scripts/verify-cleanup.sh >> /var/log/ax2-caption/cleanup-verify.log 2>&1
```

---

### 3. Rate Limit + 권한 체크 ✅

#### Rate Limit
**파일**: `ax2-api/security-middleware.js`

- 업로드: 15분당 10회
- 일반 API: 15분당 100회

**적용 완료**: 이미 구현됨

#### 다운로드 권한 체크 강화 ✅
**파일**: `ax2-api/server.js`

**변경 사항**:
- 로그인 사용자: 자신의 작업만 다운로드 가능
- 비로그인 사용자: `user_id IS NULL`인 작업만 다운로드 가능
- 권한 없음 시 404 반환 (보안)
- 다운로드 이벤트 로깅 추가

**적용 완료**: 이미 구현됨

---

## 📋 추가 구현 사항

### 4. 백업 스크립트 ✅

**파일**: `scripts/backup-db.sh`

**사용법**:
```bash
./scripts/backup-db.sh
```

**기능**:
- 데이터베이스 전체 백업
- 압축 (gzip)
- 오래된 백업 자동 삭제 (30일)
- 백업 통계

**cron 설정**:
```bash
# 매일 오전 3시 실행
0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/ax2-caption/backup.log 2>&1
```

---

### 5. 서비스 모니터링 ✅

**파일**: `scripts/monitor-services.sh`

**사용법**:
```bash
./scripts/monitor-services.sh
```

**기능**:
- API 서버 상태 확인
- 워커 프로세스 상태 확인
- 포트 리스닝 확인
- API 헬스 체크
- 자동 재시작 시도
- 알림 전송 (슬랙/이메일)

**cron 설정**:
```bash
# 5분마다 실행
*/5 * * * * /path/to/scripts/monitor-services.sh >> /var/log/ax2-caption/service-monitor.log 2>&1
```

---

## 🔧 즉시 적용 방법

### 1단계: Apache 설정 확인 및 적용

```bash
# Apache 설정 파일 확인
sudo apache2ctl -S

# 설정 파일 편집
sudo nano /etc/apache2/sites-available/lx2.kr.conf

# 예시 설정 복사
sudo cp ax2-api/apache-config/lx2.kr.conf.example /etc/apache2/sites-available/lx2.kr.conf

# Apache 재시작
sudo systemctl reload apache2
```

### 2단계: 검증 스크립트 실행

```bash
# 만료 삭제 검증
./scripts/verify-cleanup.sh

# 서비스 모니터링
./scripts/monitor-services.sh

# 디스크 용량 확인
./scripts/check-disk-usage.sh
```

### 3단계: cron 작업 등록

```bash
# crontab 편집
crontab -e

# 다음 내용 추가:
# 디스크 용량 모니터링 (매시간)
0 * * * * /path/to/scripts/check-disk-usage.sh >> /var/log/ax2-caption/disk-usage.log 2>&1

# 서비스 모니터링 (5분마다)
*/5 * * * * /path/to/scripts/monitor-services.sh >> /var/log/ax2-caption/service-monitor.log 2>&1

# 만료 삭제 검증 (매일 오전 2시)
0 2 * * * /path/to/scripts/verify-cleanup.sh >> /var/log/ax2-caption/cleanup-verify.log 2>&1

# DB 백업 (매일 오전 3시)
0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/ax2-caption/backup.log 2>&1

# Apache 설정 점검 (매일 오전 9시)
0 9 * * * /path/to/scripts/check-apache-config.sh >> /var/log/ax2-caption/apache-check.log 2>&1
```

---

## ✅ 체크리스트

### 즉시 확인
- [ ] Apache 업로드 크기 제한 설정 (`LimitRequestBody`)
- [ ] Apache 타임아웃 설정 (`Timeout`, `ProxyTimeout`)
- [ ] Node.js 서버 타임아웃 설정 (이미 적용됨)
- [ ] 다운로드 권한 체크 (이미 적용됨)
- [ ] Rate Limit 적용 (이미 적용됨)

### 검증
- [ ] 만료 삭제 검증 스크립트 실행
- [ ] 서비스 모니터링 스크립트 실행
- [ ] 디스크 용량 확인

### 자동화
- [ ] cron 작업 등록
- [ ] 알림 설정 (슬랙/이메일)

---

## 📊 모니터링 대시보드 (권장)

다음 명령어로 한 번에 확인:

```bash
# 서비스 상태
systemctl status ax2-caption-api ax2-caption-worker --no-pager

# 디스크 용량
df -h /data/lx2/ax2-caption-storage

# 최근 에러 로그
tail -50 /data/lx2/ax2-caption-api/logs/error.log

# 포트 확인
ss -lntp | grep -E ":80|:443|:3000"
```

---

**작성일**: 2025년 1월


