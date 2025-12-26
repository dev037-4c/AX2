/**
 * 설정 파일
 * 환경 변수 기반 설정 관리
 */

require('dotenv').config();

const config = {
    // 서버 설정
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
    },

    // 데이터베이스 설정
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'ax2_caption',
        max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    },

    // JWT 설정
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },

    // 파일 업로드 설정
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024, // 2GB
        allowedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
        tempPath: process.env.TEMP_PATH || './storage/temp',
        processedPath: process.env.PROCESSED_PATH || './storage/processed'
    },

    // 스토리지 설정
    storage: {
        type: process.env.STORAGE_TYPE || 'local', // local, s3
        basePath: process.env.STORAGE_BASE_PATH || './storage',
        // S3 설정 (S3 사용 시)
        s3: {
            bucket: process.env.AWS_S3_BUCKET,
            region: process.env.AWS_REGION || 'ap-northeast-2',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    },

    // 크레딧 설정
    credits: {
        creditPerMinute: parseInt(process.env.CREDIT_PER_MINUTE) || 10,
        translationCreditPerMinute: parseInt(process.env.TRANSLATION_CREDIT_PER_MINUTE) || 5,
        reservationExpiryMinutes: parseInt(process.env.RESERVATION_EXPIRY_MINUTES) || 30
    },

    // 보관 정책
    retention: {
        defaultDays: parseInt(process.env.RETENTION_DAYS) || 7,
        cleanupSchedule: process.env.CLEANUP_SCHEDULE || '0 2 * * *' // 매일 새벽 2시
    },

    // CORS 설정
    cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*']
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },

    // 로깅 설정
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || './logs'
    }
};

// 프로덕션 환경 검증
if (config.server.env === 'production') {
    const requiredEnvVars = [
        'DB_HOST',
        'DB_USER',
        'DB_PASSWORD',
        'DB_NAME',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
    ];

    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
        console.error('❌ 필수 환경 변수가 설정되지 않았습니다:', missing.join(', '));
        console.error('프로덕션 환경에서는 모든 필수 환경 변수를 설정해야 합니다.');
        process.exit(1);
    }
}

module.exports = config;



