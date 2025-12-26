# 보안 취약점 수정 가이드

이 문서는 `SECURITY_AUDIT_REPORT.md`에서 발견된 취약점을 수정하는 단계별 가이드입니다.

---

## 1단계: 보안 패키지 설치

```bash
cd ax2-api
npm install express-rate-limit helmet
```

---

## 2단계: 보안 미들웨어 적용

`ax2-api/server.js` 파일을 수정합니다.

### 2.1 보안 미들웨어 import 추가

```javascript
const security = require('./security-middleware');
```

### 2.2 Helmet 적용 (최상단)

```javascript
// CORS 설정 전에 추가
app.use(security.helmet());
```

### 2.3 CORS 설정 제한

```javascript
// 기존: app.use(cors());
// 변경:
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://lx2.kr', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 2.4 Rate Limiting 적용

```javascript
// 업로드 API에 적용
app.post('/api/videos/upload', security.uploadLimiter, upload.single('video'), async (req, res) => {
    // ...
});

// 다른 API에 적용
app.use('/api', security.apiLimiter);
```

### 2.5 입력 검증 미들웨어 적용

```javascript
// 모든 API 라우트에 적용
app.use('/api', security.validateInput);
```

### 2.6 JobId 검증 추가

```javascript
// GET /api/jobs/:id
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = security.validateJobId(req.params.id);
        // ...
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: error.message }
        });
    }
});
```

### 2.7 에러 핸들링 미들웨어 적용

```javascript
// 기존 에러 핸들링 미들웨어를 security.errorHandler로 교체
app.use(security.errorHandler);
```

---

## 3단계: 파일 업로드 검증 강화

### 3.1 파일 확장자 검증 추가

```javascript
const fileFilter = function (req, file, cb) {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
    const allowedExts = ['.mp4', '.mov', '.avi', '.wmv'];
    
    // 확장자 검증
    try {
        security.validateFileExtension(file.originalname);
    } catch (error) {
        return cb(new Error(error.message));
    }
    
    // MIME 타입 검증
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('지원하지 않는 파일 형식입니다.'));
    }
    
    cb(null, true);
};
```

---

## 4단계: 환경변수 검증 강화

### 4.1 db.js 수정

```javascript
const password = process.env.DB_PASS;
if (!password || password === '') {
    throw new Error('DB_PASS 환경변수가 설정되지 않았습니다. 프로덕션 환경에서는 필수입니다.');
}

const pool = mysql.createPool({
    // ...
    password: password,
    // ...
});
```

---

## 5단계: 파일 직접 접근 차단

### 5.1 정적 파일 서빙 수정

```javascript
// 업로드/결과 디렉토리는 제외
app.use(express.static(frontendPath, {
    // uploads, results 디렉토리 제외
}));

// 파일 다운로드는 API로만 제공 (인증 추가 필요)
app.get('/api/files/:jobId', async (req, res) => {
    // 인증 및 권한 확인 후 파일 제공
    // 현재는 인증 미구현이므로 주석 처리
});
```

---

## 6단계: Health 엔드포인트 정보 최소화

```javascript
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
        // uptime, environment 등은 제거
    });
});
```

---

## 7단계: 환경변수 추가

`.env` 파일에 추가:

```env
# 보안 설정
ALLOWED_ORIGINS=https://lx2.kr,http://localhost:3000
NODE_ENV=production
```

---

## 테스트

수정 후 다음을 테스트하세요:

1. **Rate Limiting**: 같은 IP에서 10회 이상 업로드 시도 → 차단 확인
2. **CORS**: 허용되지 않은 origin에서 요청 → 차단 확인
3. **JobId 검증**: 잘못된 형식의 JobId → 에러 확인
4. **파일 확장자**: 지원하지 않는 확장자 → 에러 확인

---

## 주의사항

- 인증/인가 미들웨어는 별도로 구현 필요 (JWT 등)
- 프로덕션 배포 전 모든 수정사항 적용 필수
- 정기적인 보안 업데이트 필요

---

**작성일**: 2025년 1월


