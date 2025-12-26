# 운영 가이드 (Production Operations)

**작성일**: 2025년 1월

---

## 📋 목차

1. [에러 처리 및 로깅](#1-에러-처리-및-로깅)
2. [파일 업로드 검증](#2-파일-업로드-검증)
3. [보안 설정](#3-보안-설정)
4. [모니터링 스크립트](#4-모니터링-스크립트)
5. [Apache 설정 점검](#5-apache-설정-점검)
6. [워커 프로세스 분리](#6-워커-프로세스-분리)
7. [장애 대응](#7-장애-대응)

---

## 1. 에러 처리 및 로깅

### 1.1 표준화된 에러 코드

모든 API는 다음 형식으로 에러를 반환합니다:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 메시지",
    "requestId": "uuid-request-id"
  }
}
```

### 1.2 에러 코드 목록

| HTTP 상태 | 에러 코드 | 설명 |
|----------|----------|------|
| 400 | `VALIDATION_ERROR` | 입력 검증 실패 |
| 400 | `INVALID_INPUT` | 유효하지 않은 입력 |
| 400 | `NO_FILE` | 파일이 업로드되지 않음 |
| 400 | `FILE_TOO_LARGE` | 파일 크기 초과 |
| 400 | `INVALID_FILE_TYPE` | 지원하지 않는 파일 형식 |
| 401 | `UNAUTHORIZED` | 인증 필요 |
| 401 | `INVALID_TOKEN` | 유효하지 않은 토큰 |
| 401 | `TOKEN_EXPIRED` | 토큰 만료 |
| 403 | `FORBIDDEN` | 접근 거부 |
| 404 | `NOT_FOUND` | 리소스를 찾을 수 없음 |
| 409 | `DUPLICATE_ENTRY` | 중복된 항목 |
| 423 | `ACCOUNT_LOCKED` | 계정 잠금 |
| 429 | `RATE_LIMIT_EXCEEDED` | 요청 한도 초과 |
| 500 | `SERVER_ERROR` | 서버 오류 |
| 500 | `DATABASE_ERROR` | 데이터베이스 오류 |

### 1.3 로깅 시스템

#### 로그 파일 위치
- 일반 로그: `ax2-api/logs/app.log`
- 에러 로그: `ax2-api/logs/error.log`
- 접근 로그: `ax2-api/logs/access.log`

#### 로그 형식
```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "level": "INFO",
  "requestId": "uuid",
  "userId": "user_id",
  "ip": "127.0.0.1",
  "message": "로그 메시지",
  "metadata": {}
}
```

#### 주요 이벤트 로깅
- `UPLOAD_SUCCESS`: 파일 업로드 성공
- `UPLOAD_FAILED`: 파일 업로드 실패
- `JOB_STARTED`: 작업 시작
- `JOB_COMPLETED`: 작업 완료
- `JOB_FAILED`: 작업 실패
- `DOWNLOAD_REQUESTED`: 다운로드 요청
- `DELETE_MANUAL`: 수동 삭제
- `DELETE_AUTO`: 자동 삭제 (만료)

### 1.4 request_id

모든 요청에 고유한 `request_id`가 생성되어 로그에 기록됩니다. 장애 추적 시 이 ID로 관련 로그를 검색할 수 있습니다.

---

## 2. 파일 업로드 검증

### 2.1 이중 검증

파일 업로드는 다음 두 가지를 모두 검증합니다:

1. **확장자 검증**: `.mp4`, `.mov`, `.avi`, `.wmv`, `.mkv`
2. **MIME 타입 검증**: 실제 파일 형식 확인

### 2.2 파일명 정제

- 원본 파일명은 DB에만 저장
- 실제 저장 파일명은 UUID 사용 (보안)
- 위험한 문자 제거 (`../`, `\`, `:` 등)

### 2.3 파일 크기 제한

- 최대 크기: 2GB
- 환경변수로 조정 가능

---

## 3. 보안 설정

### 3.1 보안 헤더

Helmet 미들웨어를 통해 다음 헤더가 자동 설정됩니다:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

### 3.2 CORS 설정

환경변수 `ALLOWED_ORIGINS`로 허용된 Origin을 설정:

```env
ALLOWED_ORIGINS=https://lx2.kr,http://localhost:3000
```

### 3.3 Rate Limiting

- 업로드: 15분당 10회
- 일반 API: 15분당 100회

---

## 4. 모니터링 스크립트

### 4.1 디스크 용량 모니터링

```bash
# 기본 실행 (경고: 80%, 위험: 90%)
./scripts/check-disk-usage.sh

# 커스텀 임계값
./scripts/check-disk-usage.sh 75 85
```

#### 환경변수
- `MONITOR_PATH`: 모니터링할 경로 (기본: `/data/lx2/ax2-caption-storage`)
- `LOG_FILE`: 로그 파일 경로
- `SLACK_WEBHOOK_URL`: 슬랙 알림 웹훅 URL
- `ADMIN_EMAIL`: 관리자 이메일 (위험 레벨 시)

#### cron 설정 예시
```bash
# 매시간 실행
0 * * * * /path/to/scripts/check-disk-usage.sh
```

### 4.2 Apache 설정 점검

```bash
./scripts/check-apache-config.sh
```

#### 확인 항목
- 업로드 크기 제한 (`LimitRequestBody`)
- 타임아웃 설정 (`Timeout`, `ProxyTimeout`)
- SSL 인증서 만료일
- 프록시 설정 (`/api` 프록시)
- 보안 헤더 설정

#### cron 설정 예시
```bash
# 매일 오전 9시 실행
0 9 * * * /path/to/scripts/check-apache-config.sh
```

---

## 5. Apache 설정 점검

### 5.1 필수 설정 확인

#### 업로드 크기 제한
```apache
# /etc/apache2/apache2.conf 또는 VirtualHost
LimitRequestBody 2147483648  # 2GB
```

#### 타임아웃 설정
```apache
Timeout 600  # 10분
ProxyTimeout 600  # 프록시 타임아웃
```

#### 프록시 설정
```apache
<Location /api>
    ProxyPass http://127.0.0.1:3000/api
    ProxyPassReverse http://127.0.0.1:3000/api
    ProxyTimeout 600
</Location>
```

### 5.2 보안 헤더 설정

```apache
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
</IfModule>
```

---

## 6. 워커 프로세스 분리

### 6.1 현재 구조

현재는 API 서버에서 직접 작업 처리를 수행합니다. 대용량 처리 시 서버가 블로킹될 수 있습니다.

### 6.2 권장 구조

```
┌─────────────┐
│  API Server │  ← 요청 처리만
└──────┬──────┘
       │ Job 큐에 추가
       ▼
┌─────────────┐
│  Job Queue  │  ← Redis/RabbitMQ
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Worker    │  ← 별도 프로세스로 작업 처리
└─────────────┘
```

### 6.3 구현 예시

#### worker.js (별도 프로세스)
```javascript
const db = require('./db');
const { processJob } = require('./workers/job-processor');

// 큐에서 Job 가져와서 처리
async function processQueue() {
    const jobs = await db.execute(
        `SELECT * FROM video_jobs 
         WHERE status = 'queued' 
         ORDER BY created_at ASC 
         LIMIT 1`
    );
    
    for (const job of jobs) {
        await processJob(job.id);
    }
}

// 주기적으로 실행
setInterval(processQueue, 5000);
```

#### systemd 서비스 예시
```ini
[Unit]
Description=AX2 Caption Job Worker
After=network.target

[Service]
Type=simple
User=ax2
WorkingDirectory=/data/lx2/ax2-caption-api
ExecStart=/usr/bin/node worker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## 7. 장애 대응

### 7.1 로그 확인 순서

1. **에러 로그 확인**
   ```bash
   tail -f ax2-api/logs/error.log
   ```

2. **request_id로 검색**
   ```bash
   grep "request-id-here" ax2-api/logs/*.log
   ```

3. **최근 에러 확인**
   ```bash
   tail -100 ax2-api/logs/error.log | jq .
   ```

### 7.2 일반적인 문제 해결

#### 업로드 실패
- 디스크 용량 확인: `./scripts/check-disk-usage.sh`
- 파일 크기 제한 확인: Apache `LimitRequestBody`
- 타임아웃 확인: Apache `Timeout`, `ProxyTimeout`

#### 작업 처리 실패
- DB 연결 확인: `mysql -u ax2 -p ax2_caption`
- 로그 확인: `tail -f ax2-api/logs/app.log`
- 워커 프로세스 확인: `systemctl status ax2-caption-worker`

#### 인증 오류
- JWT_SECRET 확인: `.env` 파일
- 토큰 만료 확인: 로그에서 `TOKEN_EXPIRED` 검색

### 7.3 알림 설정

#### 슬랙 웹훅 설정
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

#### 이메일 알림 설정
```bash
export ADMIN_EMAIL="admin@example.com"
```

---

## 8. 체크리스트

### 배포 전
- [ ] 환경변수 설정 (`.env`)
- [ ] 로그 디렉토리 생성 (`ax2-api/logs`)
- [ ] 디스크 용량 확인
- [ ] Apache 설정 점검
- [ ] SSL 인증서 확인

### 운영 중
- [ ] 디스크 용량 모니터링 (매시간)
- [ ] Apache 설정 점검 (매일)
- [ ] 로그 로테이션 설정
- [ ] 백업 확인 (매일)

### 장애 시
- [ ] 에러 로그 확인
- [ ] request_id로 추적
- [ ] 관련 시스템 확인 (DB, 디스크, 네트워크)
- [ ] 알림 전송

---

**작성일**: 2025년 1월


