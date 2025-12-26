# 영상 업로드 워크플로우 설계 문서

AX2 Caption 시스템의 영상 업로드 워크플로우 서버 구현 문서입니다.

---

## 📋 요구사항 요약

1. **영상 업로드**: multipart/form-data, 임시 저장, jobId 기준 관리
2. **저장 구조**: `/storage/temp`, `/storage/processed`, 추상화
3. **작업 상태**: `uploaded` → `processing` → `completed` → `deleted`
4. **보관 정책**: 완료 후 7일 보관
5. **자동 삭제**: 스케줄러로 만료된 파일 삭제
6. **구현 방식**: StorageAdapter 인터페이스 + 구현체

---

## 🏗️ 아키텍처

### Storage Adapter 패턴

```
StorageAdapter (인터페이스)
    ├── LocalStorageAdapter (로컬 파일 시스템)
    └── S3StorageAdapter (AWS S3) - 미래 구현
```

**장점:**
- 스토리지 백엔드 교체가 쉬움
- 테스트 용이 (로컬에서 테스트 가능)
- 확장성 (다른 클라우드 스토리지 추가 가능)

---

## 📁 디렉토리 구조

```
/storage
  ├── temp/              # 업로드 직후 임시 저장
  │   └── job_xxx.mp4
  └── processed/          # 자막 생성 완료 후 이동
      └── job_xxx.mp4
```

---

## 🔄 워크플로우

### 1. 영상 업로드

```
클라이언트 → POST /api/v1/videos/upload
    ↓
Multer: multipart/form-data 파싱
    ↓
임시 디렉토리에 저장 (/storage/temp)
    ↓
StorageAdapter.upload() 호출
    ↓
DB에 작업 정보 저장 (status: 'uploaded')
    ↓
jobId 반환
```

### 2. 작업 처리 시작

```
자막 생성 작업 시작
    ↓
startProcessing(jobId) 호출
    ↓
DB 상태 변경: 'uploaded' → 'processing'
```

### 3. 작업 완료

```
자막 생성 완료
    ↓
completeProcessing(jobId) 호출
    ↓
파일 이동: temp/ → processed/
    ↓
expires_at 계산: completed_at + 7일
    ↓
DB 상태 변경: 'processing' → 'completed'
```

### 4. 자동 삭제

```
스케줄러 실행 (매일 새벽 2시)
    ↓
만료된 작업 조회 (expires_at < NOW())
    ↓
파일 삭제 (StorageAdapter.delete())
    ↓
DB 상태 변경: 'completed' → 'deleted'
```

---

## 📊 데이터베이스 스키마

### video_jobs 테이블

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| job_id | VARCHAR(50) | 작업 고유 ID (PK) |
| user_id | VARCHAR(50) | 사용자 ID (FK) |
| title | VARCHAR(255) | 영상 제목 |
| description | TEXT | 설명 |
| file_name | VARCHAR(255) | 원본 파일명 |
| file_size | BIGINT | 파일 크기 (바이트) |
| file_type | VARCHAR(50) | MIME 타입 |
| file_path | VARCHAR(500) | 저장소 내 파일 경로 |
| status | VARCHAR(20) | 상태 (uploaded, processing, completed, failed, deleted) |
| error_message | TEXT | 에러 메시지 |
| created_at | TIMESTAMP | 생성 일시 |
| updated_at | TIMESTAMP | 수정 일시 |
| completed_at | TIMESTAMP | 완료 일시 |
| expires_at | TIMESTAMP | 만료 일시 |
| deleted_at | TIMESTAMP | 삭제 일시 |

### 상태 전이

```
uploaded → processing → completed → deleted
    ↓         ↓
  failed   failed
```

---

## 🔧 API 엔드포인트

### 1. 영상 업로드

```http
POST /api/v1/videos/upload
Content-Type: multipart/form-data

Form Data:
- video: [File]
- title: "영상 제목" (선택)
- description: "설명" (선택)
- jobId: "job_xxx" (선택, 없으면 자동 생성)
```

**응답:**
```json
{
  "success": true,
  "message": "파일이 업로드되었습니다.",
  "data": {
    "jobId": "job_1234567890",
    "fileName": "video.mp4",
    "fileSize": 104857600,
    "fileType": "video/mp4",
    "filePath": "temp/job_1234567890.mp4",
    "status": "uploaded",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### 2. 작업 정보 조회

```http
GET /api/v1/videos/jobs/:jobId
```

**응답:**
```json
{
  "success": true,
  "data": {
    "job_id": "job_1234567890",
    "title": "영상 제목",
    "file_name": "video.mp4",
    "file_size": 104857600,
    "status": "completed",
    "file_path": "processed/job_1234567890.mp4",
    "created_at": "2025-01-15T10:30:00Z",
    "completed_at": "2025-01-15T10:35:00Z",
    "expires_at": "2025-01-22T10:35:00Z"
  }
}
```

### 3. 파일 다운로드 URL

```http
GET /api/v1/videos/jobs/:jobId/download
```

**응답:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/storage/processed/job_1234567890.mp4",
    "expiresIn": 3600,
    "fileName": "video.mp4"
  }
}
```

---

## 🗂️ Storage Adapter 사용법

### LocalStorageAdapter

```javascript
const LocalStorageAdapter = require('./storage/local-storage-adapter');

const storage = new LocalStorageAdapter('./storage');

// 파일 업로드
await storage.upload('/tmp/video.mp4', 'temp/job_123.mp4');

// 파일 이동
await storage.move('temp/job_123.mp4', 'processed/job_123.mp4');

// 파일 삭제
await storage.delete('processed/job_123.mp4');
```

### S3StorageAdapter (미래)

```javascript
const S3StorageAdapter = require('./storage/s3-storage-adapter');

const storage = new S3StorageAdapter({
    bucket: 'ax2-caption-videos',
    region: 'ap-northeast-2'
});

// 동일한 인터페이스 사용
await storage.upload('/tmp/video.mp4', 'temp/job_123.mp4');
```

---

## ⏰ 스케줄러 설정

### 자동 실행

```javascript
const { startScheduler } = require('./scheduler/cleanup-scheduler');

// 서버 시작 시 스케줄러 시작
startScheduler();
```

### 수동 실행 (테스트)

```javascript
const { runManually } = require('./scheduler/cleanup-scheduler');

// 수동으로 실행
await runManually();
```

### 실행 주기

- **프로덕션**: 매일 새벽 2시
- **개발**: 매시간 (테스트용)

---

## 🔒 보안 고려사항

### 1. 파일 업로드 제한
- 최대 파일 크기: 2GB
- 허용된 파일 형식: MP4, MOV, AVI, WEBM
- Multer의 `fileFilter`로 검증

### 2. 파일명 보안
- jobId 기반 파일명 사용 (예측 불가능)
- 원본 파일명은 DB에만 저장

### 3. 접근 제어
- 사용자별 파일 접근 권한 확인
- 삭제된 파일 접근 차단

---

## 📈 성능 최적화

### 1. 인덱스
- `user_id`: 사용자별 작업 조회
- `status`: 상태별 필터링
- `expires_at`: 만료된 파일 조회

### 2. 배치 처리
- 만료된 파일 삭제를 배치로 처리
- 트랜잭션으로 일괄 처리

### 3. 비동기 처리
- 파일 업로드는 비동기
- 스케줄러는 백그라운드 실행

---

## 🧪 테스트

### 단위 테스트 예제

```javascript
// StorageAdapter 테스트
describe('LocalStorageAdapter', () => {
    test('파일 업로드', async () => {
        const storage = new LocalStorageAdapter('./test-storage');
        const path = await storage.upload('/tmp/test.mp4', 'temp/test.mp4');
        expect(path).toBe('temp/test.mp4');
    });
    
    test('파일 이동', async () => {
        const storage = new LocalStorageAdapter('./test-storage');
        await storage.move('temp/test.mp4', 'processed/test.mp4');
        const exists = await storage.exists('processed/test.mp4');
        expect(exists).toBe(true);
    });
});
```

---

## 🚀 배포 시 주의사항

### 1. 디렉토리 권한
```bash
chmod 755 storage
chmod 755 storage/temp
chmod 755 storage/processed
```

### 2. 디스크 공간 모니터링
- 정기적으로 디스크 사용량 확인
- 만료된 파일이 제대로 삭제되는지 확인

### 3. S3 전환 시
- 환경 변수로 StorageAdapter 선택
- 마이그레이션 스크립트 작성
- 점진적 전환 (새 파일만 S3 사용)

---

## 📝 환경 변수

```bash
# Storage 설정
STORAGE_TYPE=local  # local 또는 s3
STORAGE_BASE_PATH=./storage

# S3 설정 (S3 사용 시)
AWS_S3_BUCKET=ax2-caption-videos
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

---

## 🔄 마이그레이션 가이드

### Local → S3 전환

1. **S3StorageAdapter 구현 완료**
2. **환경 변수 변경**: `STORAGE_TYPE=s3`
3. **기존 파일 마이그레이션** (선택사항)
4. **새 파일만 S3 사용** (점진적 전환)

---

**작성일**: 2025년 1월

