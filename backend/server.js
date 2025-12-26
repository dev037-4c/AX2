/**
 * AX2 Caption API Server
 * 프로덕션 레디 통합 서버
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 라우트
const authRoutes = require('./routes/auth-routes');
const videoRoutes = require('./routes/video-routes');
const jobRoutes = require('./routes/job-routes');
const creditRoutes = require('./routes/credit-routes');

// 미들웨어
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { authenticateToken } = require('./middleware/auth');
const logger = require('./utils/logger');

// 스케줄러
const { startScheduler } = require('./scheduler/cleanup-scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 보안 미들웨어
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS 설정
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100, // 최대 100 요청
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
    }
});
app.use('/api/', limiter);

// Body Parser
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙 (프로덕션에서는 별도 서버 권장)
if (NODE_ENV === 'development') {
    app.use('/storage', express.static('storage'));
}

// 요청 로깅
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.userId || 'anonymous'
    });
    next();
});

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: process.env.APP_VERSION || '1.0.0'
    });
});

// API 라우트
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/credits', creditRoutes);

// 404 핸들러
app.use(notFoundHandler);

// 에러 핸들러 (마지막에 위치)
app.use(errorHandler);

// 서버 시작
const server = app.listen(PORT, () => {
    logger.info('서버 시작', {
        port: PORT,
        environment: NODE_ENV,
        version: process.env.APP_VERSION || '1.0.0'
    });
    
    console.log(`=================================`);
    console.log(`AX2 Caption API Server`);
    console.log(`서버가 시작되었습니다.`);
    console.log(`포트: ${PORT}`);
    console.log(`환경: ${NODE_ENV}`);
    console.log(`=================================`);
    console.log(`\nAPI 엔드포인트:`);
    console.log(`  POST   /api/v1/auth/signup          - 회원가입`);
    console.log(`  POST   /api/v1/auth/login           - 로그인`);
    console.log(`  POST   /api/v1/auth/refresh         - 토큰 갱신`);
    console.log(`  GET    /api/v1/auth/me              - 사용자 정보`);
    console.log(`  POST   /api/v1/videos/upload        - 영상 업로드`);
    console.log(`  GET    /api/v1/videos/jobs/:jobId   - 작업 정보`);
    console.log(`  POST   /api/v1/jobs                 - 작업 생성`);
    console.log(`  GET    /api/v1/jobs                 - 작업 목록`);
    console.log(`  GET    /api/v1/jobs/:jobId          - 작업 조회`);
    console.log(`  POST   /api/v1/jobs/:jobId/cancel   - 작업 취소`);
    console.log(`  GET    /api/v1/credits/balance      - 크레딧 잔액`);
    console.log(`  POST   /api/v1/credits/calculate    - 크레딧 계산`);
    console.log(`  GET    /api/v1/credits/history      - 사용 내역`);
    console.log(`  GET    /health                      - 헬스 체크`);
    console.log(`\n=================================\n`);
    
    // 스케줄러 시작
    startScheduler();
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM 신호 수신, 서버 종료 중...');
    server.close(() => {
        logger.info('서버 종료 완료');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT 신호 수신, 서버 종료 중...');
    server.close(() => {
        logger.info('서버 종료 완료');
        process.exit(0);
    });
});

module.exports = app;



