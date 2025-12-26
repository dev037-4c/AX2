# AX2 Caption - 최소 백엔드 API

영상 업로드만 처리하는 간단한 백엔드 서버입니다.

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 서버 실행
npm run start:simple

# 또는 직접 실행
node server-simple.js
```

## API 엔드포인트

### POST /api/videos/upload

영상 파일을 업로드합니다.

**요청**:
- Content-Type: `multipart/form-data`
- 필드명: `video`
- 최대 파일 크기: 2GB
- 지원 형식: mp4, avi, mov, mkv, webm, flv, wmv, m4v

**예시 (JavaScript fetch)**:
```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/videos/upload', {
    method: 'POST',
    body: formData
});

const result = await response.json();
console.log(result.data.jobId); // 업로드된 파일의 jobId
```

**성공 응답** (200):
```json
{
    "success": true,
    "message": "영상이 업로드되었습니다.",
    "data": {
        "jobId": "job_1234567890_abc123",
        "filename": "job_1234567890_abc123.mp4",
        "originalName": "my-video.mp4",
        "size": 1048576,
        "uploadedAt": "2025-01-01T00:00:00.000Z"
    }
}
```

**에러 응답** (400/500):
```json
{
    "success": false,
    "error": {
        "code": "NO_FILE",
        "message": "영상 파일이 업로드되지 않았습니다."
    }
}
```

### GET /health

서버 상태 확인

**응답**:
```json
{
    "success": true,
    "message": "Server is running",
    "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 파일 저장 위치

업로드된 파일은 `backend/uploads/` 디렉토리에 저장됩니다.

파일명 형식: `job_{timestamp}_{random}.{확장자}`

## 환경 변수

- `PORT`: 서버 포트 (기본값: 3000)

```bash
PORT=3000 node server-simple.js
```

## 프론트엔드 연동

서버는 루트 디렉토리의 정적 파일을 자동으로 서빙합니다.

프론트엔드에서 업로드 예시:

```javascript
// HTML
<input type="file" id="videoInput" accept="video/*">

// JavaScript
document.getElementById('videoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('video', file);

    try {
        const response = await fetch('/api/videos/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('업로드 성공!', result.data.jobId);
        } else {
            console.error('업로드 실패:', result.error.message);
        }
    } catch (error) {
        console.error('업로드 오류:', error);
    }
});
```
