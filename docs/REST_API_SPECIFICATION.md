# AX2 Caption REST API 명세서

본 문서는 AX2 Caption 시스템의 프론트엔드 화면 흐름에 맞춘 REST API 명세서입니다.

**Base URL**: `https://api.ax2caption.com/v1`

**인증 방식**: JWT Bearer Token (대부분의 API에서 필요)

---

## 목차

1. [인증/사용자](#1-인증사용자)
2. [영상 업로드/파일 처리](#2-영상-업로드파일-처리)
3. [자막 생성 작업(Job)](#3-자막-생성-작업job)
4. [자막 데이터](#4-자막-데이터)
5. [크레딧/결제](#5-크레딧결제)
6. [마이페이지](#6-마이페이지)
7. [공통 응답 형식](#공통-응답-형식)

---

## 1. 인증/사용자

### 1.1 회원가입

**API 목적**: 이메일 기반 사용자 회원가입

**URL**: `POST /auth/signup`

**Method**: `POST`

**인증 필요 여부**: ❌ 불필요

**Request**

**Header**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "홍길동"
}
```

**Response**

**성공 (201 Created)**:
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "userId": "user_1234567890",
    "email": "user@example.com",
    "name": "홍길동",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

**실패 (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "이메일 형식이 올바르지 않습니다.",
    "details": {
      "field": "email",
      "reason": "invalid_format"
    }
  }
}
```

**실패 (409 Conflict)**:
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "이미 등록된 이메일입니다."
  }
}
```

---

### 1.2 이메일 로그인

**API 목적**: 이메일/비밀번호로 로그인하여 JWT 토큰 발급

**URL**: `POST /auth/login`

**Method**: `POST`

**인증 필요 여부**: ❌ 불필요

**Request**

**Header**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "userId": "user_1234567890",
      "email": "user@example.com",
      "name": "홍길동",
      "picture": "https://example.com/profile.jpg",
      "provider": "email"
    }
  }
}
```

**실패 (401 Unauthorized)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "이메일 또는 비밀번호가 올바르지 않습니다."
  }
}
```

---

### 1.3 소셜 로그인 (Google/Kakao/Naver)

**API 목적**: 소셜 로그인 토큰을 검증하고 사용자 정보를 가져와 JWT 발급

**URL**: `POST /auth/social/{provider}`

**Method**: `POST`

**인증 필요 여부**: ❌ 불필요

**Path Parameters**:
- `provider`: `google`, `kakao`, `naver`

**Request**

**Header**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "token": "social_provider_access_token",
  "providerId": "1234567890"
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "userId": "user_1234567890",
      "email": "user@example.com",
      "name": "홍길동",
      "picture": "https://example.com/profile.jpg",
      "provider": "google"
    }
  }
}
```

**실패 (401 Unauthorized)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_SOCIAL_TOKEN",
    "message": "소셜 로그인 토큰이 유효하지 않습니다."
  }
}
```

---

### 1.4 토큰 갱신

**API 목적**: Refresh Token으로 새로운 Access Token 발급

**URL**: `POST /auth/refresh`

**Method**: `POST`

**인증 필요 여부**: ❌ 불필요 (Refresh Token 필요)

**Request**

**Header**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**실패 (401 Unauthorized)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh Token이 유효하지 않거나 만료되었습니다."
  }
}
```

---

### 1.5 로그아웃

**API 목적**: 사용자 로그아웃 및 Refresh Token 무효화

**URL**: `POST /auth/logout`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```

---

### 1.6 현재 사용자 정보 조회

**API 목적**: 현재 로그인한 사용자 정보 조회

**URL**: `GET /auth/me`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": "user_1234567890",
    "email": "user@example.com",
    "name": "홍길동",
    "picture": "https://example.com/profile.jpg",
    "provider": "email",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### 1.7 사용자 정보 수정

**API 목적**: 사용자 프로필 정보 수정

**URL**: `PUT /auth/me`

**Method**: `PUT`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "name": "홍길동",
  "picture": "https://example.com/new-profile.jpg"
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "프로필이 수정되었습니다.",
  "data": {
    "userId": "user_1234567890",
    "email": "user@example.com",
    "name": "홍길동",
    "picture": "https://example.com/new-profile.jpg",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

---

### 1.8 비밀번호 변경

**API 목적**: 사용자 비밀번호 변경

**URL**: `PUT /auth/password`

**Method**: `PUT`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "비밀번호가 변경되었습니다."
}
```

**실패 (401 Unauthorized)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "현재 비밀번호가 올바르지 않습니다."
  }
}
```

---

### 1.9 회원 탈퇴

**API 목적**: 사용자 계정 삭제

**URL**: `DELETE /auth/me`

**Method**: `DELETE`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "회원 탈퇴가 완료되었습니다."
}
```

---

## 2. 영상 업로드/파일 처리

### 2.1 파일 업로드 (멀티파트)

**API 목적**: 영상 파일 업로드 (멀티파트 업로드 지원)

**URL**: `POST /videos/upload`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요 (비로그인 사용자도 가능하지만 제한적)

**Request**

**Header**:
```
Authorization: Bearer {accessToken} (선택사항)
Content-Type: multipart/form-data
```

**Body** (Form Data):
```
file: [File]
title: "강의 영상" (선택사항)
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "파일 업로드가 완료되었습니다.",
  "data": {
    "videoId": "video_1234567890",
    "fileName": "lecture.mp4",
    "fileSize": 104857600,
    "fileType": "video/mp4",
    "duration": 3600,
    "uploadUrl": "https://storage.example.com/videos/video_1234567890.mp4",
    "thumbnailUrl": "https://storage.example.com/thumbnails/video_1234567890.jpg",
    "uploadedAt": "2025-01-15T10:30:00Z"
  }
}
```

**실패 (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "파일 크기는 2GB를 초과할 수 없습니다."
  }
}
```

**실패 (415 Unsupported Media Type)**:
```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "지원하지 않는 파일 형식입니다. (MP4, MOV, AVI, WEBM만 지원)"
  }
}
```

---

### 2.2 업로드 진행률 조회

**API 목적**: 파일 업로드 진행률 조회

**URL**: `GET /videos/{videoId}/upload-progress`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "videoId": "video_1234567890",
    "progress": 75,
    "status": "uploading",
    "uploadedBytes": 78643200,
    "totalBytes": 104857600
  }
}
```

---

### 2.3 비디오 목록 조회

**API 목적**: 사용자별 업로드된 비디오 목록 조회

**URL**: `GET /videos`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Query Parameters**:
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20, 최대: 100)
- `sort`: 정렬 기준 (`createdAt`, `title`, `duration`) (기본값: `createdAt`)
- `order`: 정렬 순서 (`asc`, `desc`) (기본값: `desc`)
- `status`: 상태 필터 (`all`, `processing`, `completed`, `failed`) (기본값: `all`)
- `search`: 검색어 (제목, 파일명)

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "videoId": "video_1234567890",
        "title": "강의 영상",
        "fileName": "lecture.mp4",
        "fileSize": 104857600,
        "duration": 3600,
        "thumbnailUrl": "https://storage.example.com/thumbnails/video_1234567890.jpg",
        "status": "completed",
        "hasSubtitles": true,
        "createdAt": "2025-01-15T10:30:00Z",
        "expiresAt": "2025-01-15T12:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 2.4 비디오 상세 조회

**API 목적**: 특정 비디오의 상세 정보 조회

**URL**: `GET /videos/{videoId}`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "videoId": "video_1234567890",
    "title": "강의 영상",
    "fileName": "lecture.mp4",
    "fileSize": 104857600,
    "fileType": "video/mp4",
    "duration": 3600,
    "uploadUrl": "https://storage.example.com/videos/video_1234567890.mp4",
    "thumbnailUrl": "https://storage.example.com/thumbnails/video_1234567890.jpg",
    "status": "completed",
    "hasSubtitles": true,
    "originalLanguage": "ko",
    "translatedLanguages": ["en", "ja"],
    "createdAt": "2025-01-15T10:30:00Z",
    "expiresAt": "2025-01-15T12:30:00Z"
  }
}
```

**실패 (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "VIDEO_NOT_FOUND",
    "message": "비디오를 찾을 수 없습니다."
  }
}
```

---

### 2.5 비디오 삭제

**API 목적**: 비디오 및 관련 데이터 삭제

**URL**: `DELETE /videos/{videoId}`

**Method**: `DELETE`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "비디오가 삭제되었습니다."
}
```

**실패 (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "VIDEO_NOT_FOUND",
    "message": "비디오를 찾을 수 없습니다."
  }
}
```

---

### 2.6 비디오 다운로드 URL 생성

**API 목적**: 비디오 다운로드를 위한 임시 URL 생성

**URL**: `POST /videos/{videoId}/download-url`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://storage.example.com/videos/video_1234567890.mp4?token=...",
    "expiresIn": 3600
  }
}
```

---

## 3. 자막 생성 작업(Job)

### 3.1 작업 생성

**API 목적**: 자막 생성 작업 생성 및 큐에 추가

**URL**: `POST /jobs`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "videoId": "video_1234567890",
  "originalLanguage": "auto",
  "targetLanguages": ["en", "ja"],
  "speakers": 1
}
```

**Response**

**성공 (201 Created)**:
```json
{
  "success": true,
  "message": "작업이 생성되었습니다.",
  "data": {
    "jobId": "job_1234567890",
    "videoId": "video_1234567890",
    "status": "pending",
    "originalLanguage": "auto",
    "targetLanguages": ["en", "ja"],
    "requiredCredits": 600,
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

**실패 (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "크레딧이 부족합니다.",
    "details": {
      "required": 600,
      "balance": 300
    }
  }
}
```

---

### 3.2 작업 목록 조회

**API 목적**: 사용자별 작업 목록 조회

**URL**: `GET /jobs`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Query Parameters**:
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `status`: 상태 필터 (`all`, `pending`, `processing`, `completed`, `failed`) (기본값: `all`)
- `videoId`: 비디오 ID로 필터링

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "jobId": "job_1234567890",
        "videoId": "video_1234567890",
        "videoTitle": "강의 영상",
        "status": "processing",
        "progress": 65,
        "originalLanguage": "ko",
        "targetLanguages": ["en", "ja"],
        "requiredCredits": 600,
        "createdAt": "2025-01-15T10:30:00Z",
        "completedAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

---

### 3.3 작업 상세 조회

**API 목적**: 특정 작업의 상세 정보 및 진행률 조회

**URL**: `GET /jobs/{jobId}`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `jobId`: 작업 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890",
    "videoId": "video_1234567890",
    "status": "processing",
    "progress": 65,
    "currentStep": "translation",
    "steps": {
      "upload": { "status": "completed", "progress": 100 },
      "speechRecognition": { "status": "completed", "progress": 100 },
      "translation": { "status": "processing", "progress": 65 },
      "saving": { "status": "pending", "progress": 0 }
    },
    "originalLanguage": "ko",
    "detectedLanguage": "ko",
    "targetLanguages": ["en", "ja"],
    "requiredCredits": 600,
    "createdAt": "2025-01-15T10:30:00Z",
    "startedAt": "2025-01-15T10:30:05Z",
    "completedAt": null,
    "error": null
  }
}
```

**실패 (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "작업을 찾을 수 없습니다."
  }
}
```

---

### 3.4 작업 취소

**API 목적**: 진행 중인 작업 취소 및 크레딧 환불

**URL**: `POST /jobs/{jobId}/cancel`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `jobId`: 작업 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "작업이 취소되었습니다.",
  "data": {
    "jobId": "job_1234567890",
    "status": "cancelled",
    "refundedCredits": 600
  }
}
```

**실패 (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "JOB_CANNOT_BE_CANCELLED",
    "message": "완료되었거나 취소할 수 없는 작업입니다."
  }
}
```

---

## 4. 자막 데이터

### 4.1 자막 조회

**API 목적**: 비디오의 자막 데이터 조회

**URL**: `GET /videos/{videoId}/subtitles`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Query Parameters**:
- `language`: 언어 코드 (기본값: 원본 언어)
- `format`: 반환 형식 (`json`, `srt`, `vtt`, `ass`) (기본값: `json`)

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)** - JSON 형식:
```json
{
  "success": true,
  "data": {
    "videoId": "video_1234567890",
    "language": "ko",
    "subtitles": [
      {
        "id": 1,
        "startTime": 0.0,
        "endTime": 3.5,
        "text": "안녕하세요, 오늘 강의를 시작하겠습니다.",
        "speaker": 1
      },
      {
        "id": 2,
        "startTime": 3.5,
        "endTime": 7.2,
        "text": "오늘은 AI 기술에 대해 알아보겠습니다.",
        "speaker": 1
      }
    ],
    "speakers": [
      {
        "id": 1,
        "name": "Speaker 1"
      }
    ]
  }
}
```

**성공 (200 OK)** - SRT 형식:
```
1
00:00:00,000 --> 00:00:03,500
안녕하세요, 오늘 강의를 시작하겠습니다.

2
00:00:03,500 --> 00:00:07,200
오늘은 AI 기술에 대해 알아보겠습니다.
```

---

### 4.2 자막 수정

**API 목적**: 자막 텍스트 및 시간 정보 수정

**URL**: `PUT /videos/{videoId}/subtitles`

**Method**: `PUT`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "language": "ko",
  "subtitles": [
    {
      "id": 1,
      "startTime": 0.0,
      "endTime": 3.5,
      "text": "안녕하세요, 오늘 강의를 시작하겠습니다.",
      "speaker": 1
    },
    {
      "id": 2,
      "startTime": 3.5,
      "endTime": 7.2,
      "text": "수정된 텍스트입니다.",
      "speaker": 1
    }
  ]
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "자막이 수정되었습니다.",
  "data": {
    "videoId": "video_1234567890",
    "language": "ko",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

---

### 4.3 자막 세그먼트 분할

**API 목적**: 자막 세그먼트를 두 개로 분할

**URL**: `POST /videos/{videoId}/subtitles/{subtitleId}/split`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID
- `subtitleId`: 자막 세그먼트 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "splitTime": 1.75,
  "text1": "첫 번째 세그먼트 텍스트",
  "text2": "두 번째 세그먼트 텍스트"
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "자막이 분할되었습니다.",
  "data": {
    "originalId": 1,
    "newSubtitles": [
      {
        "id": 1,
        "startTime": 0.0,
        "endTime": 1.75,
        "text": "첫 번째 세그먼트 텍스트"
      },
      {
        "id": 2,
        "startTime": 1.75,
        "endTime": 3.5,
        "text": "두 번째 세그먼트 텍스트"
      }
    ]
  }
}
```

---

### 4.4 자막 세그먼트 병합

**API 목적**: 두 개의 자막 세그먼트를 하나로 병합

**URL**: `POST /videos/{videoId}/subtitles/merge`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "subtitleIds": [1, 2],
  "text": "병합된 텍스트"
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "자막이 병합되었습니다.",
  "data": {
    "mergedId": 1,
    "startTime": 0.0,
    "endTime": 7.2,
    "text": "병합된 텍스트"
  }
}
```

---

### 4.5 자막 파일 다운로드

**API 목적**: 자막 파일을 특정 형식으로 다운로드

**URL**: `GET /videos/{videoId}/subtitles/download`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Path Parameters**:
- `videoId`: 비디오 ID

**Query Parameters**:
- `language`: 언어 코드
- `format`: 파일 형식 (`srt`, `vtt`, `ass`) (기본값: `srt`)

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
- Content-Type: `text/plain` (SRT), `text/vtt` (VTT), `text/ass` (ASS)
- Content-Disposition: `attachment; filename="subtitles.srt"`
- 파일 내용이 직접 반환됨

---

## 5. 크레딧/결제

### 5.1 크레딧 잔액 조회

**API 목적**: 현재 사용자의 크레딧 잔액 조회

**URL**: `GET /credits/balance`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "balance": 1000,
    "freeBalance": 100,
    "totalCharged": 5000
  }
}
```

---

### 5.2 크레딧 계산

**API 목적**: 영상 길이와 번역 언어 수를 기반으로 필요한 크레딧 계산

**URL**: `POST /credits/calculate`

**Method**: `POST`

**인증 필요 여부**: ❌ 불필요

**Request**

**Header**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "durationSeconds": 3600,
  "translationLanguageCount": 2
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "durationMinutes": 60,
    "baseCredits": 600,
    "translationCredits": 600,
    "totalCredits": 1200
  }
}
```

---

### 5.3 크레딧 충전 패키지 목록 조회

**API 목적**: 크레딧 충전 패키지 목록 조회

**URL**: `GET /credits/packages`

**Method**: `GET`

**인증 필요 여부**: ❌ 불필요

**Request**

**Header**:
```
Content-Type: application/json
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "packageId": "package_1",
        "name": "스타터",
        "credits": 1000,
        "bonus": 100,
        "price": 10000,
        "currency": "KRW"
      },
      {
        "packageId": "package_2",
        "name": "프로",
        "credits": 5000,
        "bonus": 500,
        "price": 45000,
        "currency": "KRW"
      }
    ]
  }
}
```

---

### 5.4 결제 요청

**API 목적**: 크레딧 충전을 위한 결제 요청 생성

**URL**: `POST /credits/payment`

**Method**: `POST`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body**:
```json
{
  "packageId": "package_1",
  "paymentMethod": "card",
  "paymentInfo": {
    "cardNumber": "1234-5678-9012-3456",
    "expiryDate": "12/25",
    "cvv": "123"
  }
}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "message": "결제가 완료되었습니다.",
  "data": {
    "paymentId": "payment_1234567890",
    "packageId": "package_1",
    "credits": 1000,
    "bonus": 100,
    "totalCredits": 1100,
    "amount": 10000,
    "currency": "KRW",
    "paidAt": "2025-01-15T10:30:00Z",
    "newBalance": 2100
  }
}
```

**실패 (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "결제에 실패했습니다.",
    "details": {
      "reason": "insufficient_funds"
    }
  }
}
```

---

### 5.5 크레딧 사용 내역 조회

**API 목적**: 크레딧 사용 내역 조회

**URL**: `GET /credits/history`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Query Parameters**:
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `type`: 타입 필터 (`all`, `charge`, `use`, `refund`) (기본값: `all`)
- `startDate`: 시작 날짜 (ISO 8601)
- `endDate`: 종료 날짜 (ISO 8601)

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "historyId": "history_1234567890",
        "type": "charge",
        "description": "스타터 패키지 충전",
        "amount": 1100,
        "balance": 2100,
        "createdAt": "2025-01-15T10:30:00Z"
      },
      {
        "historyId": "history_1234567891",
        "type": "use",
        "description": "자막 생성 작업 (job_1234567890)",
        "amount": -600,
        "balance": 1500,
        "createdAt": "2025-01-15T11:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

---

## 6. 마이페이지

### 6.1 마이페이지 통계 조회

**API 목적**: 마이페이지에 표시할 통계 정보 조회

**URL**: `GET /mypage/stats`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "creditBalance": 1000,
    "totalVideos": 45,
    "completedVideos": 40,
    "processingVideos": 3,
    "totalDuration": 18000,
    "totalCreditsUsed": 5000,
    "monthlyCreditsUsed": 1200,
    "storageUsed": 2.5,
    "storageTotal": 5.0
  }
}
```

---

### 6.2 작업 목록 조회 (마이페이지용)

**API 목적**: 마이페이지에서 표시할 작업 목록 조회 (필터링 옵션 포함)

**URL**: `GET /mypage/videos`

**Method**: `GET`

**인증 필요 여부**: ✅ 필요

**Query Parameters**:
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `filter`: 필터 (`all`, `processing`, `completed`, `expiring`) (기본값: `all`)
- `search`: 검색어

**Request**

**Header**:
```
Authorization: Bearer {accessToken}
```

**Response**

**성공 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "videoId": "video_1234567890",
        "title": "강의 영상",
        "thumbnailUrl": "https://storage.example.com/thumbnails/video_1234567890.jpg",
        "duration": 3600,
        "status": "completed",
        "hasSubtitles": true,
        "createdAt": "2025-01-15T10:30:00Z",
        "expiresAt": "2025-01-15T12:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

## 공통 응답 형식

### 성공 응답

모든 성공 응답은 다음 형식을 따릅니다:

```json
{
  "success": true,
  "message": "작업이 완료되었습니다.",
  "data": { ... }
}
```

### 실패 응답

모든 실패 응답은 다음 형식을 따릅니다:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "details": { ... }
  }
}
```

### HTTP 상태 코드

- `200 OK`: 요청 성공
- `201 Created`: 리소스 생성 성공
- `400 Bad Request`: 잘못된 요청
- `401 Unauthorized`: 인증 필요 또는 인증 실패
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스를 찾을 수 없음
- `409 Conflict`: 리소스 충돌 (예: 중복 이메일)
- `415 Unsupported Media Type`: 지원하지 않는 미디어 타입
- `429 Too Many Requests`: 요청 한도 초과
- `500 Internal Server Error`: 서버 내부 오류

### 인증 헤더

인증이 필요한 API는 다음 헤더를 포함해야 합니다:

```
Authorization: Bearer {accessToken}
```

### 페이지네이션

페이지네이션이 있는 API는 다음 형식을 따릅니다:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## WebSocket/SSE (실시간 업데이트)

### 작업 진행률 실시간 업데이트

**WebSocket URL**: `wss://api.ax2caption.com/v1/jobs/{jobId}/progress`

**연결 시 인증**: Query parameter로 `token` 전달

**메시지 형식**:
```json
{
  "type": "progress",
  "data": {
    "jobId": "job_1234567890",
    "progress": 65,
    "currentStep": "translation",
    "status": "processing"
  }
}
```

---

**작성일**: 2025년 1월  
**기준 문서**: SYSTEM_OVERVIEW.md, BACKEND_MIGRATION_REQUIREMENTS.md

