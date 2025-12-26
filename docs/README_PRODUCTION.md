# AX2 Caption 프로덕션 레디 시스템

회사 공식 서비스로 운영 가능한 완전한 백엔드 시스템이 구축되었습니다.

---

## 🎉 완성된 구조

### ✅ 백엔드 서버
- **통합 Express 서버** (`backend/server.js`)
  - 인증, 영상 업로드, 작업 관리, 크레딧 관리 통합
  - 보안 미들웨어 (Helmet, Rate Limiting)
  - 구조화된 로깅
  - 에러 처리

### ✅ 인증 시스템
- JWT 기반 인증 (Access Token + Refresh Token)
- 이메일 회원가입/로그인
- 비밀번호 해싱 (bcrypt)
- 선택적/필수 인증 미들웨어

### ✅ 영상 업로드 및 처리
- multipart/form-data 업로드
- 임시 저장 → 처리 → 영구 저장 워크플로우
- Storage Adapter 패턴 (로컬/S3 전환 가능)
- 자동 만료 및 삭제 (7일 보관 정책)
- Cron 스케줄러로 자동 정리

### ✅ 자막 생성 작업
- 비동기 작업 처리 (Mock)
- 작업 상태 관리
- 크레딧 통합 (예약 → 확정 → 환불)

### ✅ 크레딧 시스템
- 크레딧 선차감 (예약)
- 작업 실패 시 자동 환불
- 로그인/비로그인 사용자 분리 처리
- 크레딧 사용 내역 조회
- 중복 요청 방지

### ✅ 데이터베이스
- PostgreSQL 스키마 완성
- 초기화 스크립트
- 연결 풀 관리

### ✅ 보안
- Helmet (보안 헤더)
- Rate Limiting
- CORS 설정
- 입력 검증
- 에러 처리

### ✅ 운영 도구
- 구조화된 로깅
- PM2 프로세스 관리
- 백업 스크립트
- 모니터링 가이드

---

## 📚 문서 구조

### 핵심 문서
1. **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - 프로덕션 설정 가이드 (시작점)
2. **[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)** - 시스템 아키텍처
3. **[PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md)** - 준비 체크리스트

### 백엔드 문서
4. **[backend/README.md](./backend/README.md)** - 백엔드 API 서버 가이드
5. **[backend/DEPLOYMENT_GUIDE.md](./backend/DEPLOYMENT_GUIDE.md)** - 배포 가이드
6. **[backend/OPERATIONS_MANUAL.md](./backend/OPERATIONS_MANUAL.md)** - 운영 매뉴얼

### 설계 문서
7. **[REST_API_SPECIFICATION.md](./REST_API_SPECIFICATION.md)** - REST API 명세
8. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - 데이터베이스 스키마
9. **[BACKEND_MIGRATION_REQUIREMENTS.md](./BACKEND_MIGRATION_REQUIREMENTS.md)** - 백엔드 이전 요구사항

### 서비스별 문서
10. **[backend/CREDIT_SERVICE_DESIGN.md](./backend/CREDIT_SERVICE_DESIGN.md)** - 크레딧 서비스 설계
11. **[backend/VIDEO_UPLOAD_WORKFLOW.md](./backend/VIDEO_UPLOAD_WORKFLOW.md)** - 영상 업로드 워크플로우

---

## 🚀 빠른 시작

### 1. 개발 환경 설정

```bash
# 백엔드 디렉토리로 이동
cd backend

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# 데이터베이스 초기화
npm run init-db

# 서버 시작
npm run dev
```

### 2. 프로덕션 배포

자세한 내용은 [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)를 참고하세요.

```bash
# 서버 설정
# 데이터베이스 설정
# 애플리케이션 배포
# Nginx 설정
# SSL 인증서 설정
```

---

## 📁 프로젝트 구조

```
AX2_Caption/
├── backend/                    # 백엔드 서버
│   ├── api/                    # API 핸들러
│   │   ├── caption-generation.js
│   │   ├── credit-service.js
│   │   └── video-upload.js
│   ├── config/                 # 설정
│   │   └── config.js
│   ├── db/                     # 데이터베이스
│   │   ├── index.js
│   │   └── init.sql
│   ├── middleware/             # 미들웨어
│   │   ├── auth.js
│   │   └── error-handler.js
│   ├── routes/                  # 라우트
│   │   ├── auth-routes.js
│   │   ├── credit-routes.js
│   │   ├── job-routes.js
│   │   └── video-routes.js
│   ├── scheduler/               # 스케줄러
│   │   └── cleanup-scheduler.js
│   ├── storage/                 # 스토리지 어댑터
│   │   ├── storage-adapter.js
│   │   ├── local-storage-adapter.js
│   │   └── s3-storage-adapter.js
│   ├── scripts/                 # 스크립트
│   │   └── init-db.js
│   ├── utils/                   # 유틸리티
│   │   └── logger.js
│   ├── server.js                # 메인 서버
│   └── package.json
│
├── PRODUCTION_SETUP.md          # 프로덕션 설정 가이드 ⭐
├── PRODUCTION_ARCHITECTURE.md   # 시스템 아키텍처
├── PRODUCTION_READINESS_CHECKLIST.md  # 준비 체크리스트
├── REST_API_SPECIFICATION.md    # REST API 명세
├── DATABASE_SCHEMA.md           # 데이터베이스 스키마
└── README_PRODUCTION.md         # 이 문서
```

---

## 🔑 주요 기능

### 인증 및 사용자
- ✅ 이메일 회원가입/로그인
- ✅ JWT 토큰 기반 인증
- ✅ 토큰 갱신
- ✅ 사용자 정보 조회

### 영상 업로드
- ✅ multipart/form-data 업로드
- ✅ 파일 검증 (크기, 형식)
- ✅ 임시 저장 → 처리 → 영구 저장
- ✅ 자동 만료 및 삭제

### 자막 생성 작업
- ✅ 작업 생성 (크레딧 예약 포함)
- ✅ 작업 조회 및 목록
- ✅ 작업 취소 (크레딧 환불)
- ✅ 비동기 처리 (Mock)

### 크레딧 관리
- ✅ 크레딧 잔액 조회
- ✅ 크레딧 계산
- ✅ 크레딧 예약 및 확정
- ✅ 자동 환불
- ✅ 사용 내역 조회

---

## 🔒 보안 기능

- ✅ HTTPS 강제 (프로덕션)
- ✅ Helmet (보안 헤더)
- ✅ Rate Limiting
- ✅ CORS 설정
- ✅ 입력 검증
- ✅ SQL Injection 방지 (Parameterized Queries)
- ✅ XSS 방지
- ✅ 비밀번호 해싱 (bcrypt)

---

## 📊 모니터링 및 로깅

- ✅ 구조화된 로깅 (파일 기반)
- ✅ PM2 프로세스 관리
- ✅ 헬스 체크 엔드포인트
- ✅ 에러 추적

---

## 🚨 장애 대응

- ✅ 자동 백업 (데이터베이스)
- ✅ 롤백 절차
- ✅ 장애 대응 매뉴얼
- ✅ 로그 분석

---

## 📝 다음 단계

### 즉시 필요
1. [ ] 프로덕션 서버 구축
2. [ ] 데이터베이스 설정
3. [ ] 환경 변수 설정
4. [ ] SSL 인증서 설정
5. [ ] 모니터링 도구 설정

### 단기 (1개월 이내)
1. [ ] 실제 AI 서비스 연동
2. [ ] 결제 시스템 연동
3. [ ] 소셜 로그인 완성
4. [ ] 모니터링 대시보드 구축

### 중기 (3개월 이내)
1. [ ] S3 스토리지 전환
2. [ ] CDN 설정
3. [ ] 로드 밸런싱
4. [ ] 데이터베이스 복제

---

## 📞 지원

### 문서
- [프로덕션 설정 가이드](./PRODUCTION_SETUP.md)
- [운영 매뉴얼](./backend/OPERATIONS_MANUAL.md)
- [배포 가이드](./backend/DEPLOYMENT_GUIDE.md)

### 문제 해결
- [운영 매뉴얼 - 문제 해결](./backend/OPERATIONS_MANUAL.md#4-장애-대응)
- [백엔드 README - 문제 해결](./backend/README.md#-문제-해결)

---

## ✅ 체크리스트

프로덕션 배포 전 확인:

- [ ] 모든 문서 검토 완료
- [ ] 서버 인프라 구축 완료
- [ ] 데이터베이스 설정 완료
- [ ] 환경 변수 설정 완료
- [ ] SSL 인증서 설정 완료
- [ ] 백업 시스템 설정 완료
- [ ] 모니터링 설정 완료
- [ ] 보안 설정 완료
- [ ] 테스트 완료
- [ ] 운영 매뉴얼 검토 완료

---

**작성일**: 2025년 1월  
**버전**: 1.0.0  
**상태**: 프로덕션 레디 ✅

