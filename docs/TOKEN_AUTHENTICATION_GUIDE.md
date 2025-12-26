# JWT 토큰 기반 인증 시스템 가이드

**구현 일자**: 2025년 1월

---

## 📋 개요

AX2 Caption에 JWT 토큰 기반 인증 시스템을 구현했습니다.

### 주요 특징
- ✅ Access Token (1시간) + Refresh Token (7일)
- ✅ 자동 토큰 갱신
- ✅ 사용자별 작업 분리
- ✅ 비로그인 사용자 지원 (선택적 인증)

---

## 🔧 구현 내용

### 1. 백엔드 (ax2-api)

#### `ax2-api/middleware/auth.js`
- `authenticateToken`: 선택적 인증 미들웨어
- `requireAuth`: 필수 인증 미들웨어
- `generateToken`: Access Token 생성
- `generateRefreshToken`: Refresh Token 생성
- `verifyRefreshToken`: Refresh Token 검증

#### `ax2-api/server.js` 수정
- 모든 API에 `authenticateToken` 미들웨어 적용
- 사용자별 작업 필터링 (로그인 사용자는 자신의 작업만 조회)
- 비로그인 사용자는 `user_id IS NULL`인 작업만 조회

### 2. 프론트엔드

#### `js/token-manager.js` (신규)
- 토큰 저장/조회
- 토큰 만료 확인
- 자동 토큰 갱신
- API 요청 헤더에 토큰 자동 추가

#### `js/auth-api.js` (신규)
- `loginWithEmail()`: 이메일 로그인
- `signupWithEmail()`: 회원가입
- `refreshToken()`: 토큰 갱신
- `getCurrentUser()`: 사용자 정보 조회
- `logout()`: 로그아웃

#### API 호출 파일 수정
- `js/api-upload.js`: 토큰 헤더 추가
- `js/job-api.js`: 토큰 헤더 추가
- `js/mypage.js`: 토큰 헤더 추가

---

## 🔐 보안 기능

### 1. 토큰 저장
- Access Token: LocalStorage (`ax2_access_token`)
- Refresh Token: LocalStorage (`ax2_refresh_token`)
- 만료 시간: LocalStorage (`ax2_token_expiry`)

### 2. 자동 토큰 갱신
- 만료 5분 전 자동 갱신
- 401 에러 시 자동 갱신 후 재시도
- Refresh Token 만료 시 자동 로그아웃

### 3. 사용자별 데이터 분리
- 로그인 사용자: 자신의 작업만 조회 가능
- 비로그인 사용자: `user_id IS NULL`인 작업만 조회 가능

---

## 📝 사용 방법

### 프론트엔드에서 사용

#### 1. 로그인
```javascript
// 이메일 로그인
const result = await window.AuthAPI.loginWithEmail(email, password);
if (result.success) {
    // 로그인 성공
    // 토큰은 자동으로 저장됨
    console.log('사용자:', result.data);
} else {
    // 로그인 실패
    console.error('오류:', result.error);
}
```

#### 2. API 호출 (자동 토큰 포함)
```javascript
// 방법 1: TokenManager 사용
const options = {};
window.TokenManager.addAuthHeader(options);
const response = await fetch('/api/videos/upload', options);

// 방법 2: authenticatedFetch 사용 (자동 갱신 포함)
const response = await window.TokenManager.authenticatedFetch('/api/jobs/123');
```

#### 3. 토큰 갱신
```javascript
const refreshed = await window.AuthAPI.refreshToken();
if (refreshed.success) {
    console.log('토큰 갱신 성공');
}
```

#### 4. 로그아웃
```javascript
window.AuthAPI.logout();
```

---

## 🔄 API 엔드포인트

### 인증 API (backend 서버)
- `POST /api/v1/auth/signup` - 회원가입
- `POST /api/v1/auth/login` - 로그인
- `POST /api/v1/auth/refresh` - 토큰 갱신
- `GET /api/v1/auth/me` - 사용자 정보 조회

### 비디오/작업 API (ax2-api 서버)
- `POST /api/videos/upload` - 영상 업로드 (인증 선택적)
- `GET /api/jobs/:id` - Job 상태 조회 (인증 선택적)
- `GET /api/jobs/:id/subtitle` - 자막 다운로드 (인증 선택적)
- `GET /api/storage` - 작업 목록 조회 (인증 선택적)
- `DELETE /api/storage/:id` - 작업 삭제 (인증 선택적)

---

## 🔒 보안 고려사항

### 1. 토큰 저장
- ✅ LocalStorage 사용 (XSS 취약점 주의)
- ⚠️ 향후 HttpOnly Cookie로 전환 권장

### 2. 토큰 만료
- Access Token: 1시간
- Refresh Token: 7일
- 만료 5분 전 자동 갱신

### 3. HTTPS 필수
- 프로덕션에서는 반드시 HTTPS 사용
- 토큰이 네트워크를 통해 전송됨

### 4. CORS 설정
- 허용된 Origin에서만 API 호출 가능
- 환경변수 `ALLOWED_ORIGINS` 설정

---

## 📦 환경변수 설정

### ax2-api/.env
```env
# JWT 설정
JWT_SECRET=your-very-secure-secret-key-change-in-production
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-key-change-in-production

# CORS 설정
ALLOWED_ORIGINS=https://lx2.kr,http://localhost:3000
```

### backend/.env
```env
# JWT 설정 (backend 서버와 동일한 값 사용 권장)
JWT_SECRET=your-very-secure-secret-key-change-in-production
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-key-change-in-production
```

---

## 🚀 통합 방법

### 1. HTML 파일에 스크립트 추가

#### index.html
```html
<script src="js/security-utils.js"></script>
<script src="js/token-manager.js"></script>
<script src="js/auth-api.js"></script>
```

#### html/login.html
```html
<script src="../js/security-utils.js"></script>
<script src="../js/token-manager.js"></script>
<script src="../js/auth-api.js"></script>
<script src="../js/login.js"></script>
```

### 2. 로그인 함수 수정

`js/login.js`에서 이메일 로그인 부분을 수정:

```javascript
// 기존 LocalStorage 기반 로그인 대신
async function handleEmailLogin(email, password) {
    const result = await window.AuthAPI.loginWithEmail(email, password);
    
    if (result.success) {
        // 로그인 성공
        if (window.updateLoginButton) {
            window.updateLoginButton();
        }
        // 리디렉션
        window.location.href = 'storage.html';
    } else {
        // 로그인 실패
        alert(result.error.message);
    }
}
```

---

## ✅ 체크리스트

### 백엔드
- [x] JWT 미들웨어 생성
- [x] API에 인증 미들웨어 적용
- [x] 사용자별 데이터 필터링
- [x] package.json에 jsonwebtoken 추가

### 프론트엔드
- [x] token-manager.js 생성
- [x] auth-api.js 생성
- [x] API 호출에 토큰 헤더 추가
- [ ] 로그인 함수에 API 연동
- [ ] HTML 파일에 스크립트 추가

### 보안
- [ ] 환경변수 설정
- [ ] HTTPS 설정
- [ ] CORS 설정
- [ ] 토큰 만료 처리 테스트

---

## 🔍 테스트

### 1. 로그인 테스트
```javascript
// 브라우저 콘솔에서
const result = await window.AuthAPI.loginWithEmail('test@example.com', 'password');
console.log(result);
```

### 2. 토큰 확인
```javascript
// 브라우저 콘솔에서
console.log('Access Token:', window.TokenManager.getAccessToken());
console.log('Token Valid:', window.TokenManager.isTokenValid());
console.log('Expiry Time:', window.TokenManager.getTokenExpiryTime());
```

### 3. API 호출 테스트
```javascript
// 브라우저 콘솔에서
const response = await window.TokenManager.authenticatedFetch('/api/storage');
const result = await response.json();
console.log(result);
```

---

## 📚 참고 문서

- `docs/SECURITY_AUDIT_REPORT.md` - 보안 취약점 검사 보고서
- `docs/FRONTEND_SECURITY_FIXES.md` - 프론트엔드 보안 수정 사항
- `backend/middleware/auth.js` - 백엔드 인증 미들웨어
- `backend/routes/auth-routes.js` - 인증 라우트

---

**작성일**: 2025년 1월


