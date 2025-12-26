# 영상 업로드 워크플로우 사용 가이드

## 📦 설치

```bash
cd backend
npm install
```

필요한 패키지:
- `multer`: 파일 업로드 처리
- `node-cron`: 스케줄러
- `pg`: PostgreSQL 클라이언트

## 🗄️ 데이터베이스 설정

### 1. PostgreSQL 데이터베이스 생성

```sql
CREATE DATABASE ax2_caption;
```

### 2. 스키마 생성

```bash
psql -U postgres -d ax2_caption -f db/schema.sql
```

또는 Node.js로 실행:

```javascript
const db = require('./db');
const fs = require('fs');
const sql = fs.readFileSync('./db/schema.sql', 'utf8');
await db.query(sql);
```

## 🔧 환경 변수 설정

`.env` 파일 생성:

```bash
# 데이터베이스
DB_USER=postgres
DB_HOST=localhost
DB_NAME=ax2_caption
DB_PASSWORD=your_password
DB_PORT=5432

# 서버
PORT=3000
NODE_ENV=development

# Storage (선택)
STORAGE_TYPE=local
STORAGE_BASE_PATH=./storage
```

## 🚀 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 📤 API 사용 예제

### 1. 영상 업로드

```bash
curl -X POST http://localhost:3000/api/v1/videos/upload \
  -F "video=@/path/to/video.mp4" \
  -F "title=테스트 영상" \
  -F "description=테스트용 영상입니다"
```

**JavaScript 예제:**

```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);
formData.append('title', '테스트 영상');
formData.append('description', '테스트용 영상입니다');

const response = await fetch('http://localhost:3000/api/v1/videos/upload', {
    method: 'POST',
    body: formData
});

const result = await response.json();
console.log('업로드 완료:', result.data.jobId);
```

### 2. 작업 정보 조회

```bash
curl http://localhost:3000/api/v1/videos/jobs/job_1234567890
```

### 3. 다운로드 URL 생성

```bash
curl http://localhost:3000/api/v1/videos/jobs/job_1234567890/download
```

## 🔄 작업 상태 전이

### 프로그래밍 방식

```javascript
const videoUpload = require('./api/video-upload');
const db = require('./db');

// 1. 업로드 완료 후
// status: 'uploaded'

// 2. 작업 처리 시작
await videoUpload.startProcessing(db, jobId);
// status: 'processing'

// 3. 작업 완료
await videoUpload.completeProcessing(db, jobId);
// status: 'completed'
// expires_at: completed_at + 7일

// 4. 작업 실패
await videoUpload.failProcessing(db, jobId, '에러 메시지');
// status: 'failed'

// 5. 자동 삭제 (스케줄러)
// status: 'deleted'
```

## ⏰ 스케줄러

### 자동 실행

서버 시작 시 자동으로 스케줄러가 시작됩니다.

- **프로덕션**: 매일 새벽 2시
- **개발**: 매시간 (테스트용)

### 수동 실행

```javascript
const { runManually } = require('./scheduler/cleanup-scheduler');

// 수동으로 만료된 파일 정리
await runManually();
```

## 📁 파일 구조

업로드 후 파일 구조:

```
/storage
  /temp
    job_1234567890.mp4  (업로드 직후)
  /processed
    job_1234567890.mp4  (작업 완료 후)
```

## 🔍 모니터링

### 만료 예정 파일 조회

```sql
SELECT job_id, file_name, expires_at 
FROM video_jobs 
WHERE status = 'completed' 
AND expires_at < NOW() + INTERVAL '1 day'
ORDER BY expires_at;
```

### 디스크 사용량 확인

```bash
du -sh storage/temp storage/processed
```

## 🛠️ 문제 해결

### 1. 업로드 실패

- 파일 크기 확인 (최대 2GB)
- 파일 형식 확인 (MP4, MOV, AVI, WEBM)
- 디스크 공간 확인

### 2. 파일 삭제 안 됨

- 스케줄러 로그 확인
- `expires_at` 값 확인
- 파일 권한 확인

### 3. 데이터베이스 연결 오류

- PostgreSQL 서비스 실행 확인
- 환경 변수 확인
- 연결 풀 설정 확인

## 🔐 보안 체크리스트

- [ ] 파일 크기 제한 (2GB)
- [ ] 파일 형식 검증
- [ ] 사용자 인증 (선택사항)
- [ ] 파일명 보안 (jobId 사용)
- [ ] 디렉토리 권한 설정

## 📊 성능 최적화

1. **파일 업로드**: 스트리밍 업로드 고려
2. **배치 삭제**: 여러 파일을 한 번에 삭제
3. **인덱스**: 데이터베이스 인덱스 최적화
4. **캐싱**: 파일 메타데이터 캐싱

---

**작성일**: 2025년 1월

