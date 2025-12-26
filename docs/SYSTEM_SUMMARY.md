# AX2 Caption 시스템 정리

**최종 업데이트**: 2025년 1월  
**프로젝트 상태**: 개발/프로덕션 준비 단계

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [기술 스택](#3-기술-스택)
4. [백엔드 아키텍처](#4-백엔드-아키텍처)
5. [데이터베이스](#5-데이터베이스)
6. [API 엔드포인트](#6-api-엔드포인트)
7. [주요 기능](#7-주요-기능)
8. [파일 구조](#8-파일-구조)
9. [배포 및 운영](#9-배포-및-운영)

---

## 1. 시스템 개요

**AX2 Caption**은 AI 기반 자동 자막 생성 웹 서비스입니다.

### 핵심 기능
- **자동 자막 생성**: 영상 업로드 시 AI가 음성을 인식하여 자막 생성
- **다국어 지원**: 100개 이상의 언어로 자막 생성 및 번역
- **자막 편집**: 생성된 자막을 실시간으로 편집 및 수정
- **파일 관리**: 작업 목록 관리, 검색, 다운로드
- **사용자 인증**: 이메일 및 소셜 로그인 (Google, Kakao, Naver)
- **크레딧 시스템**: 시간 기반 크레딧 계산 및 관리

### 서비스 흐름
```
사용자 업로드 → 파일 저장 → Job 생성 → AI 처리 (Mock) → 자막 생성 → 편집/다운로드
```

---

## 2. 프로젝트 구조

```
AX2_Caption/
├── index.html              # 메인 페이지 (영상 업로드)
├── script.js               # 메인 JavaScript
├── styles.css              # 전역 스타일
│
├── html/                   # HTML 페이지들
│   ├── home.html           # 랜딩 페이지
│   ├── login.html          # 로그인
│   ├── signup.html         # 회원가입
│   ├── edit.html           # 자막 편집
│   ├── storage.html        # 작업 목록/저장소
│   └── ...
│
├── js/                     # JavaScript 모듈
│   ├── api-upload.js       # 업로드 API 호출
│   ├── job-api.js          # Job API 호출
│   ├── edit.js             # 자막 편집
│   ├── mypage.js           # 마이페이지
│   ├── auth-state.js       # 인증 상태 관리
│   └── ...
│
├── css/                    # CSS 스타일
│   ├── login.css
│   ├── edit.css
│   └── ...
│
├── ax2-api/                # 최신 DB 기반 API 서버 (MySQL)
│   ├── server.js           # 메인 서버
│   ├── db.js               # DB 연결
│   ├── db-init.sql         # DB 스키마
│   ├── package.json
│   └── README.md
│
├── backend/                # 기존 백엔드 (인증/크레딧 포함, PostgreSQL)
│   ├── server.js           # 메인 서버
│   ├── api-server.js       # API 서버
│   ├── routes/             # 라우트
│   │   ├── auth-routes.js
│   │   ├── video-routes.js
│   │   ├── job-routes.js
│   │   └── credit-routes.js
│   ├── middleware/         # 미들웨어
│   │   ├── auth.js
│   │   └── error-handler.js
│   ├── db/                 # DB 스키마
│   │   ├── schema.sql
│   │   └── init.sql
│   └── package.json
│
└── docs/                   # 문서
    ├── SYSTEM_OVERVIEW.md
    ├── DATABASE_SCHEMA.md
    ├── REST_API_SPECIFICATION.md
    └── ...
```

---

## 3. 기술 스택

### 프론트엔드
- **HTML5**: 시맨틱 마크업
- **CSS3**: 모던 스타일링 (Glass morphism, Gradient)
- **JavaScript (Vanilla)**: 프레임워크 없이 순수 JavaScript
- **Font Awesome**: 아이콘
- **LocalStorage**: 클라이언트 사이드 데이터 저장

### 백엔드 (ax2-api)
- **Node.js**: 런타임
- **Express**: 웹 프레임워크
- **MySQL/MariaDB**: 데이터베이스
- **mysql2**: MySQL 드라이버
- **Multer**: 파일 업로드 처리
- **dotenv**: 환경변수 관리

### 백엔드 (backend)
- **Node.js**: 런타임
- **Express**: 웹 프레임워크
- **PostgreSQL**: 데이터베이스
- **JWT**: 인증 토큰
- **bcrypt**: 비밀번호 해싱
- **Helmet**: 보안 미들웨어
- **express-rate-limit**: Rate limiting

### 외부 서비스
- **Google Identity Services**: Google 로그인
- **Kakao SDK**: Kakao 로그인
- **Naver Login API**: Naver 로그인

---

## 4. 백엔드 아키텍처

### 4.1 ax2-api (최신, DB 기반)

**목적**: 영상 업로드 및 자막 생성 작업 관리 (MySQL 기반)

**주요 특징**:
- MySQL/MariaDB 연동
- 환경변수 기반 설정
- 메모리 기반에서 DB 기반으로 전환 완료
- 자동 만료 정리 스케줄러 (1시간마다)

**서버 실행**:
```bash
cd ax2-api
npm install
cp env.example .env  # 환경변수 설정
mysql -u root -p < db-init.sql  # DB 초기화
npm start
```

### 4.2 backend (기존, 인증/크레딧 포함)

**목적**: 사용자 인증, 크레딧 관리, 작업 관리 (PostgreSQL 기반)

**주요 특징**:
- PostgreSQL 연동
- JWT 기반 인증
- 크레딧 시스템
- 보안 미들웨어 (Helmet, Rate Limiting)
- 계정 잠금 기능

**서버 실행**:
```bash
cd backend
npm install
# .env 파일 설정
npm run init-db  # DB 초기화
npm start
```

### 4.3 통합 방향

현재 두 개의 백엔드가 존재하지만, 프로덕션에서는 하나로 통합 권장:
- `ax2-api`의 DB 기반 구조 + `backend`의 인증/크레딧 기능
- 또는 `backend`에 MySQL 연동 추가

---

## 5. 데이터베이스

### 5.1 ax2-api (MySQL)

#### video_jobs 테이블
```sql
CREATE TABLE video_jobs (
    id            CHAR(36) PRIMARY KEY,
    user_id       BIGINT NULL,
    title         VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    video_path    VARCHAR(500) NOT NULL,
    status        ENUM('uploaded','queued','processing','completed','failed','deleted'),
    progress      INT DEFAULT 0,
    error_message TEXT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at  DATETIME NULL,
    expires_at    DATETIME NULL,
    deleted_at    DATETIME NULL
);
```

#### job_results 테이블
```sql
CREATE TABLE job_results (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id     CHAR(36) NOT NULL,
    format     ENUM('json','srt','vtt','ass') NOT NULL,
    file_path  VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_job_format (job_id, format),
    FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE
);
```

### 5.2 backend (PostgreSQL)

더 복잡한 스키마 포함:
- `users`: 사용자 정보
- `user_sessions`: 세션 관리
- `videos`: 비디오 메타데이터
- `jobs`: 작업 정보
- `subtitles`: 자막 데이터
- `credits`: 크레딧 잔액
- `credit_history`: 크레딧 사용 내역
- `payments`: 결제 정보
- 등등...

자세한 내용은 `docs/DATABASE_SCHEMA.md` 참고

---

## 6. API 엔드포인트

### 6.1 ax2-api 엔드포인트

#### 영상 업로드
```http
POST /api/videos/upload
Content-Type: multipart/form-data

Form Data:
- video: [File]
```

**응답**:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "filename": "video-xxx.mp4",
    "originalName": "original.mp4",
    "size": 104857600,
    "mimetype": "video/mp4"
  }
}
```

#### Job 상태 조회
```http
GET /api/jobs/:id
```

**응답**:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "completed",
    "progress": 100,
    "subtitles": [...],
    "completedAt": "2025-01-15T10:30:00Z",
    "expiresAt": "2025-01-22T10:30:00Z"
  }
}
```

#### 자막 다운로드
```http
GET /api/jobs/:id/subtitle?format=srt|vtt|json&lang=ko
```

#### 작업 목록 조회
```http
GET /api/storage?status=all|processing|completed|expiring&search=검색어&limit=100&offset=0
```

#### 작업 삭제
```http
DELETE /api/storage/:id
```

### 6.2 backend 엔드포인트

#### 인증
- `POST /api/v1/auth/signup` - 회원가입
- `POST /api/v1/auth/login` - 로그인
- `POST /api/v1/auth/refresh` - 토큰 갱신
- `GET /api/v1/auth/me` - 사용자 정보

#### 크레딧
- `GET /api/v1/credits/balance` - 크레딧 잔액
- `POST /api/v1/credits/calculate` - 크레딧 계산
- `GET /api/v1/credits/history` - 사용 내역

#### 작업
- `POST /api/v1/jobs` - 작업 생성
- `GET /api/v1/jobs` - 작업 목록
- `GET /api/v1/jobs/:jobId` - 작업 조회
- `POST /api/v1/jobs/:jobId/cancel` - 작업 취소

자세한 내용은 `docs/REST_API_SPECIFICATION.md` 참고

---

## 7. 주요 기능

### 7.1 영상 업로드 및 처리

1. **업로드**
   - 드래그 앤 드롭 또는 파일 선택
   - 파일 검증 (MP4, MOV, AVI, 최대 2GB)
   - 서버에 파일 저장

2. **Job 생성**
   - UUID 기반 Job ID 생성
   - DB에 Job 레코드 생성 (status: 'queued')
   - 파일 경로 저장

3. **처리 시뮬레이션**
   - queued → processing (즉시)
   - processing → completed (5초 후, Mock)
   - 자막 데이터 생성 (JSON 파일)
   - `expires_at` 계산 (completed_at + 7일)

4. **결과 저장**
   - 자막 JSON 파일 저장 (`results/` 디렉토리)
   - `job_results` 테이블에 메타데이터 저장

### 7.2 자막 편집

- **편집 페이지** (`html/edit.html`)
  - 좌측: 자막 텍스트 편집
  - 우측: 비디오 플레이어
  - 실시간 자막 오버레이
  - 언어별 탭 전환

- **저장**
  - LocalStorage에 저장
  - 서버 동기화 (구현 필요)

### 7.3 작업 관리

- **저장소 페이지** (`html/storage.html`)
  - 작업 목록 표시
  - 필터링 (all, processing, completed, expiring)
  - 검색 기능
  - 삭제 기능

### 7.4 자동 만료 정리

- **스케줄러**: 1시간마다 실행
- **정리 대상**: `expires_at <= NOW()` AND `status = 'completed'`
- **처리 내용**:
  1. 업로드된 파일 삭제
  2. 자막 결과 파일 삭제
  3. `status`를 `'deleted'`로 변경
  4. `deleted_at` 설정

### 7.5 사용자 인증 (backend)

- **이메일 로그인**: 이메일/비밀번호
- **소셜 로그인**: Google, Kakao, Naver
- **JWT 토큰**: Access Token + Refresh Token
- **계정 잠금**: 실패 횟수 제한

### 7.6 크레딧 시스템 (backend)

- **크레딧 계산**: 분당 10 크레딧
- **예약 시스템**: 작업 시작 시 선차감
- **환불 처리**: 작업 실패 시 환불
- **무료 크레딧**: 비로그인 사용자 제공

---

## 8. 파일 구조

### 프론트엔드 핵심 파일

| 파일 | 설명 | 라인 수 |
|------|------|---------|
| `index.html` | 메인 페이지 (업로드) | - |
| `script.js` | 메인 로직 (업로드, 진행률) | ~2,000 |
| `html/edit.html` | 자막 편집 페이지 | - |
| `js/edit.js` | 편집 로직 | ~1,600 |
| `html/storage.html` | 작업 목록 페이지 | - |
| `js/mypage.js` | 저장소 관리 | - |
| `js/api-upload.js` | 업로드 API 호출 | - |
| `js/job-api.js` | Job API 호출 | - |

### 백엔드 핵심 파일

| 파일 | 설명 |
|------|------|
| `ax2-api/server.js` | 메인 API 서버 (MySQL) |
| `ax2-api/db.js` | DB 연결 설정 |
| `ax2-api/db-init.sql` | DB 스키마 |
| `backend/server.js` | 메인 서버 (PostgreSQL, 인증 포함) |
| `backend/routes/*.js` | API 라우트 |
| `backend/middleware/*.js` | 미들웨어 |

---

## 9. 배포 및 운영

### 9.1 개발 환경 실행

#### ax2-api
```bash
cd ax2-api
npm install
cp env.example .env
# .env 파일 편집
mysql -u root -p < db-init.sql
npm start
```

#### backend
```bash
cd backend
npm install
# .env 파일 설정
npm run init-db
npm start
```

### 9.2 프로덕션 배포

#### 권장 아키텍처
```
Nginx (리버스 프록시)
  ↓
Node.js API Server (PM2)
  ↓
MySQL/PostgreSQL
  ↓
파일 스토리지 (로컬 또는 S3)
```

#### 환경변수 설정
- `.env` 파일 또는 systemd Environment
- DB 연결 정보
- 파일 저장 경로
- JWT 시크릿 키 (backend)

#### 스케줄러
- `ax2-api`: 내장 스케줄러 (1시간마다)
- `backend`: `node-cron` 사용 가능

### 9.3 모니터링

- **로그**: console.log → 파일 로깅 (winston 등)
- **에러 추적**: Sentry 연동 권장
- **헬스 체크**: `/health` 엔드포인트

### 9.4 보안

- **HTTPS**: SSL/TLS 인증서 필수
- **Rate Limiting**: express-rate-limit
- **입력 검증**: Multer 파일 검증
- **SQL Injection 방지**: Prepared Statements
- **XSS 방지**: 입력 데이터 이스케이프

---

## 10. 현재 상태 및 향후 계획

### ✅ 완료된 기능
- [x] 프론트엔드 UI/UX
- [x] 영상 업로드 API (ax2-api)
- [x] Job 상태 관리 (DB 기반)
- [x] 자막 다운로드 (SRT, VTT, JSON)
- [x] 작업 목록 조회/삭제
- [x] 자동 만료 정리 스케줄러
- [x] 사용자 인증 시스템 (backend)
- [x] 크레딧 시스템 (backend)

### 🚧 진행 중
- [ ] 두 백엔드 통합
- [ ] 실제 AI 서비스 연동 (STT/번역)
- [ ] 파일 스토리지 S3 연동
- [ ] 실시간 진행률 업데이트 (WebSocket)

### 📋 향후 계획
- [ ] 결제 시스템 연동
- [ ] 모니터링 및 로깅 시스템
- [ ] 성능 최적화
- [ ] 다국어 UI 지원 확대

---

## 11. 참고 문서

- `docs/SYSTEM_OVERVIEW.md` - 시스템 개요
- `docs/DATABASE_SCHEMA.md` - 데이터베이스 스키마
- `docs/REST_API_SPECIFICATION.md` - API 명세서
- `docs/PRODUCTION_ARCHITECTURE.md` - 프로덕션 아키텍처
- `docs/PRODUCTION_SETUP.md` - 프로덕션 설정 가이드
- `ax2-api/README.md` - ax2-api 서버 가이드
- `backend/README.md` - backend 서버 가이드

---

## 12. 주요 설정 파일

### 환경변수 예시 (ax2-api/.env)
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ax2
DB_PASS=your_secure_password
DB_NAME=ax2_caption
PORT=3000
UPLOADS_DIR=./uploads
RESULTS_DIR=./results
```

### 환경변수 예시 (backend/.env)
```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=ax2
DB_PASS=your_secure_password
DB_NAME=ax2_caption
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
```

---

**작성일**: 2025년 1월  
**버전**: 1.0.0


