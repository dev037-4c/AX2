# AX2 Caption 보안 취약점 검사 보고서

**검사 일자**: 2025년 1월  
**검사 범위**: ax2-api 서버, 스크립트, 프론트엔드 API 호출

---

## 🔴 심각 (Critical)

### 1. 인증/인가 부재
**위치**: `ax2-api/server.js` 전체  
**위험도**: 🔴 Critical  
**설명**: 모든 API 엔드포인트에 인증/인가가 없어 누구나 접근 가능

**영향**:
- 임의 사용자의 작업 조회/삭제 가능
- 무제한 파일 업로드 가능
- 서버 리소스 고갈 가능

**권장 조치**:
```javascript
// JWT 미들웨어 추가
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
};

// 모든 API에 적용
app.post('/api/videos/upload', authenticate, upload.single('video'), ...);
app.get('/api/jobs/:id', authenticate, ...);
app.delete('/api/storage/:id', authenticate, ...);
```

---

### 2. CORS 모든 Origin 허용
**위치**: `ax2-api/server.js:181`  
**위험도**: 🔴 Critical  
**설명**: `app.use(cors())`로 모든 origin에서 접근 가능

**영향**:
- CSRF 공격 가능
- 악의적인 사이트에서 API 호출 가능

**권장 조치**:
```javascript
const cors = require('cors');

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://lx2.kr'],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### 3. Rate Limiting 부재
**위치**: `ax2-api/server.js` 전체  
**위험도**: 🔴 Critical  
**설명**: API 요청 제한이 없어 DDoS 공격에 취약

**영향**:
- 서버 리소스 고갈
- 서비스 중단

**권장 조치**:
```javascript
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 10, // 최대 10회
    message: '너무 많은 업로드 요청이 있습니다. 잠시 후 다시 시도하세요.'
});

app.post('/api/videos/upload', uploadLimiter, upload.single('video'), ...);
```

---

## 🟠 높음 (High)

### 4. 파일 업로드 검증 부족
**위치**: `ax2-api/server.js:215-222`  
**위험도**: 🟠 High  
**설명**: MIME 타입만 검증하고 실제 파일 내용은 검증하지 않음

**영향**:
- 악성 파일 업로드 가능
- 파일 확장자 조작 가능

**권장 조치**:
```javascript
const fileFilter = function (req, file, cb) {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
    const allowedExts = ['.mp4', '.mov', '.avi', '.wmv'];
    
    // 확장자 검증
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
        return cb(new Error('지원하지 않는 파일 확장자입니다.'));
    }
    
    // MIME 타입 검증
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('지원하지 않는 파일 형식입니다.'));
    }
    
    cb(null, true);
};
```

---

### 5. Path Traversal 취약점
**위치**: `ax2-api/server.js:378, 446, 658, 719`  
**위험도**: 🟠 High  
**설명**: `jobId`를 파일 경로에 직접 사용하지만 추가 검증 없음

**영향**:
- 임의 파일 읽기/삭제 가능
- 시스템 파일 접근 가능

**권장 조치**:
```javascript
// jobId 검증 함수
function validateJobId(jobId) {
    // UUID 형식 검증 (36자, 하이픈 포함)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
        throw new Error('유효하지 않은 Job ID입니다.');
    }
    // 경로 조작 문자 검증
    if (jobId.includes('..') || jobId.includes('/') || jobId.includes('\\')) {
        throw new Error('유효하지 않은 Job ID입니다.');
    }
    return jobId;
}

// 사용 예시
const jobId = validateJobId(req.params.id);
const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
```

---

### 6. SQL Injection 잠재 위험
**위치**: `ax2-api/server.js:548`  
**위험도**: 🟠 High  
**설명**: 동적 쿼리 구성 시 문자열 연결 사용

**현재 코드**:
```javascript
const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
```

**영향**:
- SQL Injection 공격 가능 (현재는 안전하지만 위험)

**권장 조치**:
```javascript
// 안전한 쿼리 빌더 사용 또는 하드코딩된 조건만 사용
// status는 ENUM이므로 하드코딩된 값만 허용
const allowedStatuses = ['all', 'processing', 'completed', 'expiring'];
if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
}
```

---

### 7. 에러 메시지 정보 노출
**위치**: `ax2-api/server.js:286, 399, 506, 610, 680`  
**위험도**: 🟠 High  
**설명**: 내부 에러 메시지가 클라이언트에 노출됨

**영향**:
- 시스템 구조 파악 가능
- 디버깅 정보 노출

**권장 조치**:
```javascript
// 프로덕션 환경에서는 상세 에러 숨기기
const isProduction = process.env.NODE_ENV === 'production';

catch (error) {
    console.error('업로드 오류:', error);
    res.status(500).json({
        success: false,
        error: {
            code: 'UPLOAD_ERROR',
            message: isProduction 
                ? '파일 업로드 중 오류가 발생했습니다.' 
                : error.message
        }
    });
}
```

---

## 🟡 중간 (Medium)

### 8. 파일 직접 접근 가능
**위치**: `ax2-api/server.js:227`  
**위험도**: 🟡 Medium  
**설명**: 정적 파일 서빙으로 업로드 파일 직접 접근 가능

**영향**:
- 인증 없이 파일 다운로드 가능
- 민감한 파일 노출

**권장 조치**:
```javascript
// 업로드 디렉토리는 정적 파일 서빙에서 제외
app.use(express.static(frontendPath, {
    // uploads, results 디렉토리 제외
}));

// 파일 다운로드는 인증된 API로만 제공
app.get('/api/files/:jobId', authenticate, async (req, res) => {
    // 인증 및 권한 확인 후 파일 제공
});
```

---

### 9. 환경변수 기본값에 민감한 정보
**위치**: `ax2-api/db.js:7`  
**위험도**: 🟡 Medium  
**설명**: DB 비밀번호 기본값이 빈 문자열

**영향**:
- 환경변수 미설정 시 보안 취약

**권장 조치**:
```javascript
const password = process.env.DB_PASS;
if (!password) {
    throw new Error('DB_PASS 환경변수가 설정되지 않았습니다.');
}
```

---

### 10. 스크립트 명령어 주입 가능성
**위치**: `scripts/check-db.sh:63, 69, 76`  
**위험도**: 🟡 Medium  
**설명**: 사용자 입력을 직접 명령어에 사용

**영향**:
- 명령어 주입 공격 가능

**권장 조치**:
```bash
# 입력 검증 추가
if [[ ! "$db_user" =~ ^[a-zA-Z0-9_]+$ ]]; then
    echo "❌ 유효하지 않은 사용자명입니다."
    exit 1
fi

# 또는 파라미터화된 쿼리 사용
mysql -u "$db_user" -p"$db_pass" -e "SELECT 1;" 2>/dev/null
```

---

### 11. 파일 크기 제한만 있고 개수 제한 없음
**위치**: `ax2-api/server.js:212-213`  
**위험도**: 🟡 Medium  
**설명**: 파일 크기는 제한하지만 업로드 개수 제한 없음

**영향**:
- 디스크 공간 고갈 가능

**권장 조치**:
```javascript
// 사용자별 업로드 개수 제한 (인증 추가 후)
// 또는 전체 시스템 업로드 개수 제한
```

---

## 🟢 낮음 (Low)

### 12. Health 엔드포인트 정보 노출
**위치**: `ax2-api/server.js:235-243`  
**위험도**: 🟢 Low  
**설명**: 서버 정보가 노출됨

**영향**:
- 공격자에게 정보 제공

**권장 조치**:
```javascript
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
        // uptime, environment 등은 제거하거나 인증 후에만 제공
    });
});
```

---

### 13. 로그에 민감한 정보 포함 가능
**위치**: `ax2-api/server.js` 전체  
**위험도**: 🟢 Low  
**설명**: 파일 경로 등이 로그에 기록됨

**영향**:
- 로그 유출 시 정보 노출

**권장 조치**:
```javascript
// 민감한 정보는 마스킹
console.log('파일 삭제 완료:', path.basename(job.video_path));
```

---

## 📋 우선순위별 수정 체크리스트

### 즉시 수정 (Critical)
- [ ] 인증/인가 미들웨어 추가
- [ ] CORS 설정 제한
- [ ] Rate Limiting 추가

### 이번 주 수정 (High)
- [ ] 파일 업로드 검증 강화
- [ ] Path Traversal 방어
- [ ] SQL Injection 방어 강화
- [ ] 에러 메시지 정보 노출 방지

### 다음 주 수정 (Medium)
- [ ] 파일 직접 접근 차단
- [ ] 환경변수 검증 강화
- [ ] 스크립트 보안 강화

### 선택 사항 (Low)
- [ ] Health 엔드포인트 정보 최소화
- [ ] 로그 보안 강화

---

## 🔧 보안 강화 패키지 권장

```json
{
  "dependencies": {
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "express-validator": "^7.0.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1"
  }
}
```

---

## 📝 보안 모범 사례

1. **모든 입력 검증**: 클라이언트와 서버 양쪽에서 검증
2. **최소 권한 원칙**: 필요한 권한만 부여
3. **방어적 프로그래밍**: 항상 최악의 경우를 가정
4. **정기적인 보안 업데이트**: 의존성 패키지 업데이트
5. **보안 로깅**: 모든 보안 이벤트 기록
6. **HTTPS 강제**: 모든 통신 암호화
7. **정기적인 보안 감사**: 주기적인 취약점 검사

---

**작성일**: 2025년 1월  
**다음 검사 예정일**: 수정 완료 후 재검사


