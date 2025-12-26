# 프론트엔드 보안 수정 사항

**수정 일자**: 2025년 1월  
**목적**: XSS, 인코딩, 입력 검증 취약점 해결

---

## 수정된 파일

### 1. `js/security-utils.js` (강화)
- ✅ `encodeURL()` / `decodeURL()` 함수 추가
- ✅ `validateId()` 함수 추가 (ID 검증)
- ✅ `sanitizeJobId()` 함수 추가 (Job ID 정제)
- ✅ `getURLParam()` / `getSafeURLParam()` 함수 추가
- ✅ `validateInput()` 함수 추가 (위험 패턴 검사)
- ✅ `setSafeHTML()` 함수 추가 (안전한 innerHTML 설정)
- ✅ `buildSafeURL()` 함수 추가 (안전한 URL 생성)

### 2. `js/job-api.js` (수정)
- ✅ `getJobStatus()`: Job ID 검증 및 URL 인코딩 추가
- ✅ `getJobSubtitles()`: 모든 파라미터 검증 및 인코딩 추가

### 3. `js/edit.js` (수정)
- ✅ URL 파라미터 안전하게 가져오기

### 4. `js/mypage.js` (수정)
- ✅ URL 파라미터 안전하게 가져오기
- ✅ URL 생성 시 인코딩 적용

---

## 주요 보안 개선 사항

### 1. XSS 방지
- ✅ 모든 사용자 입력에 `escapeHTML()` 적용
- ✅ HTML 속성 값에 `escapeHTMLAttribute()` 적용
- ✅ URL 파라미터 검증 강화

### 2. 입력 검증
- ✅ Job ID 형식 검증 (UUID 또는 안전한 문자만)
- ✅ 언어 코드 검증 (영문자, 하이픈만)
- ✅ 숫자 파라미터 범위 검증

### 3. URL 인코딩
- ✅ 모든 URL 파라미터 인코딩
- ✅ 안전한 URL 생성 함수 사용

### 4. ID 검증
- ✅ UUID 형식 검증
- ✅ 영숫자, 하이픈, 언더스코어만 허용
- ✅ 경로 조작 문자 차단 (`..`, `/`, `\`)

---

## 사용 방법

### SecurityUtils 사용

```javascript
// HTML 이스케이프
const safeText = SecurityUtils.escapeHTML(userInput);

// HTML 속성 이스케이프
const safeAttr = SecurityUtils.escapeHTMLAttribute(userInput);

// URL 인코딩
const encoded = SecurityUtils.encodeURL(userInput);

// ID 검증
if (SecurityUtils.validateId(id)) {
    // 안전한 ID
}

// Job ID 정제
const cleanId = SecurityUtils.sanitizeJobId(jobId);

// 안전한 URL 파라미터 가져오기
const videoId = SecurityUtils.getSafeURLParam('id');

// 안전한 URL 생성
const url = SecurityUtils.buildSafeURL('edit.html', { id: videoId });
```

---

## 추가 권장 사항

### 1. DOMPurify 라이브러리 사용
신뢰할 수 있는 HTML을 삽입해야 할 경우:
```bash
npm install dompurify
```

```javascript
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(html);
```

### 2. Content Security Policy (CSP)
HTML에 CSP 헤더 추가:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline';">
```

### 3. 모든 innerHTML 사용 검토
- 가능하면 `textContent` 사용
- innerHTML 사용 시 반드시 `escapeHTML()` 적용
- 신뢰할 수 없는 데이터는 절대 innerHTML에 넣지 않기

---

## 체크리스트

- [x] security-utils.js 강화
- [x] job-api.js 입력 검증 추가
- [x] edit.js URL 파라미터 검증
- [x] mypage.js URL 생성 인코딩
- [ ] 모든 HTML 파일에 security-utils.js 포함 확인
- [ ] CSP 헤더 추가
- [ ] DOMPurify 라이브러리 도입 검토

---

**작성일**: 2025년 1월


