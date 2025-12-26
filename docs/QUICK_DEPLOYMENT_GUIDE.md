# 빠른 배포 가이드 (6단계)

이 가이드는 코드가 모두 준비된 상태에서 실제 서버에 배포하는 방법을 안내합니다.

## 전제 조건

- ✅ MySQL/MariaDB 설치됨
- ✅ Node.js 16+ 설치됨
- ✅ 서버 접근 권한 (sudo)
- ✅ 코드가 `/data/lx2/ax2-caption-api` 또는 원하는 경로에 있음

---

## 1단계: 데이터베이스 초기화 (5분)

```bash
# MySQL/MariaDB 접속
mysql -u root -p

# 또는 원격 서버인 경우
mysql -h your-db-host -u root -p
```

```sql
-- 데이터베이스 생성 및 초기화
source /path/to/ax2-api/db-init.sql;

-- 또는 직접 실행
mysql -u root -p < /path/to/ax2-api/db-init.sql
```

```sql
-- 마이그레이션 실행 (size, retry_count 필드 추가)
USE ax2_caption;
source /path/to/ax2-api/db-migration-add-fields.sql;

-- 또는 직접 실행
mysql -u root -p ax2_caption < /path/to/ax2-api/db-migration-add-fields.sql
```

**확인**:
```bash
mysql -u root -p -e "USE ax2_caption; SHOW TABLES;"
# video_jobs, job_results 테이블이 보여야 함

mysql -u root -p -e "USE ax2_caption; DESCRIBE video_jobs;"
# size, retry_count 컬럼이 보여야 함
```

---

## 2단계: 환경변수 설정 (3분)

```bash
cd /path/to/ax2-api
cp env.example .env
nano .env  # 또는 vi, vim
```

**`.env` 파일 내용** (예시):
```bash
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ax2
DB_PASS=your_secure_password_here
DB_NAME=ax2_caption

# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Configuration (최소 32자, 랜덤 생성 권장)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# CORS Configuration
ALLOWED_ORIGINS=https://lx2.kr,https://www.lx2.kr

# Storage Paths (절대 경로 권장)
UPLOADS_DIR=/data/lx2/ax2-caption-storage/uploads
RESULTS_DIR=/data/lx2/ax2-caption-storage/results

# Logging
LOG_DIR=/var/log/ax2-caption
LOG_LEVEL=INFO
```

**디렉토리 생성**:
```bash
mkdir -p /data/lx2/ax2-caption-storage/{uploads,results}
mkdir -p /var/log/ax2-caption
chown -R ax2:ax2 /data/lx2/ax2-caption-storage
chown -R ax2:ax2 /var/log/ax2-caption
```

---

## 3단계: 의존성 설치 (2분)

```bash
cd /path/to/ax2-api
npm install --production
```

**확인**:
```bash
npm list --depth=0
# express, mysql2, multer, jsonwebtoken 등이 보여야 함
```

---

## 4단계: systemd 서비스 설정 (5분)

### 4-1. 서비스 파일 수정

```bash
# systemd 파일 경로 확인
cd /path/to/ax2-api/systemd

# 경로가 다르면 수정 필요
nano ax2-caption-api.service
# WorkingDirectory, ExecStart 경로 확인

nano ax2-caption-worker.service
# WorkingDirectory, ExecStart 경로 확인
```

**수정 예시** (`ax2-caption-api.service`):
```ini
[Service]
WorkingDirectory=/data/lx2/ax2-caption-api  # 실제 경로로 변경
ExecStart=/usr/bin/node /data/lx2/ax2-caption-api/server.js  # 실제 경로로 변경
```

### 4-2. 서비스 설치

```bash
# 서비스 파일 복사
sudo cp ax2-api/systemd/ax2-caption-api.service /etc/systemd/system/
sudo cp ax2-api/systemd/ax2-caption-worker.service /etc/systemd/system/

# systemd 재로드
sudo systemctl daemon-reload

# 서비스 활성화 (재부팅 시 자동 시작)
sudo systemctl enable ax2-caption-api
sudo systemctl enable ax2-caption-worker

# 서비스 시작
sudo systemctl start ax2-caption-api
sudo systemctl start ax2-caption-worker
```

### 4-3. 상태 확인

```bash
# 서비스 상태 확인
sudo systemctl status ax2-caption-api
sudo systemctl status ax2-caption-worker

# 로그 확인
sudo journalctl -u ax2-caption-api -f
sudo journalctl -u ax2-caption-worker -f
```

**정상 작동 확인**:
- 상태가 `active (running)`이어야 함
- 로그에 "서버 시작 완료", "워커 프로세스 시작" 메시지가 보여야 함
- 에러가 없어야 함

---

## 5단계: 모니터링 설정 (3분)

### 5-1. 스크립트 권한 설정

```bash
chmod +x scripts/check-disk-usage.sh
chmod +x scripts/monitor-services.sh
chmod +x scripts/check-db.sh
```

### 5-2. Cron 설정

```bash
crontab -e
```

**추가할 내용**:
```cron
# 디스크 사용률 모니터링 (5분마다)
*/5 * * * * /path/to/scripts/check-disk-usage.sh >> /var/log/ax2-caption/disk-monitor.log 2>&1

# 서비스 모니터링 (5분마다)
*/5 * * * * /path/to/scripts/monitor-services.sh >> /var/log/ax2-caption/service-monitor.log 2>&1

# DB 백업 (매일 새벽 2시)
0 2 * * * /path/to/scripts/backup-db.sh >> /var/log/ax2-caption/backup.log 2>&1
```

**알림 설정 (선택사항)**:
```bash
# .env 또는 환경변수에 추가
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export ADMIN_EMAIL="admin@example.com"
```

---

## 6단계: 테스트 (5분)

### 6-1. Health Check

```bash
curl http://localhost:3000/api/health
```

**예상 응답**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "production",
  "version": "1.0.0"
}
```

### 6-2. 업로드 테스트

```bash
# 작은 테스트 파일 업로드
curl -X POST \
  -F "video=@test.mp4" \
  http://localhost:3000/api/videos/upload
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid-here",
    "filename": "video-1234567890-123456789.mp4",
    "originalName": "test.mp4",
    "size": 1234567,
    "mimetype": "video/mp4"
  }
}
```

### 6-3. Job 상태 확인

```bash
# 위에서 받은 jobId 사용
curl http://localhost:3000/api/jobs/{jobId}
```

### 6-4. Storage 목록 확인

```bash
curl http://localhost:3000/api/storage
```

### 6-5. 자막 다운로드 테스트

```bash
# Job이 completed 상태가 될 때까지 대기 (약 5초)
curl "http://localhost:3000/api/jobs/{jobId}/subtitle?format=srt&lang=ko" -o subtitle.srt
```

---

## 문제 해결

### 서비스가 시작되지 않음

```bash
# 로그 확인
sudo journalctl -u ax2-caption-api -n 50

# 일반적인 원인:
# 1. DB 연결 실패 → .env의 DB 설정 확인
# 2. 포트 충돌 → PORT 환경변수 확인
# 3. 권한 문제 → 파일 소유자 확인 (chown)
# 4. 경로 오류 → WorkingDirectory, ExecStart 경로 확인
```

### DB 연결 실패

```bash
# DB 확인 스크립트 실행
./scripts/check-db.sh

# 수동 확인
mysql -u ax2 -p -e "USE ax2_caption; SHOW TABLES;"
```

### 파일 업로드 실패

```bash
# 디렉토리 권한 확인
ls -la /data/lx2/ax2-caption-storage/uploads
# ax2 사용자가 쓰기 권한이 있어야 함

# 디스크 공간 확인
df -h /data/lx2/ax2-caption-storage
```

---

## 배포 완료 확인 체크리스트

- [ ] DB 테이블 생성됨 (`video_jobs`, `job_results`)
- [ ] 마이그레이션 완료 (`size`, `retry_count` 컬럼 존재)
- [ ] `.env` 파일 설정 완료
- [ ] API 서비스 실행 중 (`systemctl status ax2-caption-api`)
- [ ] 워커 서비스 실행 중 (`systemctl status ax2-caption-worker`)
- [ ] Health check 성공 (`curl /api/health`)
- [ ] 업로드 테스트 성공
- [ ] Job 처리 확인 (queued → processing → completed)
- [ ] 자막 다운로드 성공
- [ ] Cron 모니터링 설정 완료

---

## 다음 단계

1. **프로덕션 환경 설정**
   - Apache/Nginx 리버스 프록시 설정
   - SSL 인증서 설정
   - 방화벽 규칙 설정

2. **모니터링 강화**
   - 로그 집계 도구 (ELK, Grafana 등)
   - APM 도구 (New Relic, Datadog 등)

3. **백업 자동화**
   - DB 백업 스케줄 확인
   - 백업 파일 검증

4. **알림 설정**
   - 슬랙/이메일 알림 테스트
   - 장애 대응 프로세스 문서화

---

**작성일**: 2024년
**예상 소요 시간**: 약 30분


