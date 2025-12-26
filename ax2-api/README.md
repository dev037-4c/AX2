# AX2 Caption API Server

## 설치 및 실행

### 1. 의존성 설치
```bash
cd ax2-api
npm install
```

### 2. 환경변수 설정
`.env` 파일을 생성하고 다음 내용을 입력:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ax2
DB_PASS=your_secure_password_here
DB_NAME=ax2_caption
PORT=3000
UPLOADS_DIR=./uploads
RESULTS_DIR=./results
```

### 3. 데이터베이스 초기화
MySQL/MariaDB에 접속하여 `db-init.sql` 실행:
```bash
mysql -u root -p < db-init.sql
```

또는 DBeaver에서 `db-init.sql` 파일을 실행

### 4. 서버 실행
```bash
npm start
```

개발 모드 (nodemon):
```bash
npm run dev
```

## API 엔드포인트

- `POST /api/videos/upload` - 영상 업로드
- `GET /api/jobs/:id` - Job 상태 조회
- `GET /api/jobs/:id/subtitle?format=srt|vtt|json&lang=ko` - 자막 다운로드
- `GET /api/storage?status=all|processing|completed|expiring&search=검색어` - 작업 목록 조회
- `DELETE /api/storage/:id` - 작업 삭제

## 자동 만료 정리

- 서버 시작 시 즉시 실행
- 이후 1시간마다 자동 실행
- `completed_at` 기준 7일 후 `expires_at` 계산
- 만료된 Job의 파일과 자막 결과 자동 삭제
- `status`를 `deleted`로 변경


