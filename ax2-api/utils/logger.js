/**
 * 로깅 유틸리티
 * request_id 포함 구조화된 로깅
 */

const fs = require('fs');
const path = require('path');

// 로그 디렉토리
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 로그 파일 경로
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');
const ACCESS_LOG_FILE = path.join(LOG_DIR, 'access.log');

/**
 * 로그 레벨
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

/**
 * 로그 포맷팅
 */
function formatLog(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const requestId = metadata.requestId || '-';
    const userId = metadata.userId || '-';
    const ip = metadata.ip || '-';
    
    // 개인정보 제거 (이메일, 토큰 등)
    const sanitizedMetadata = { ...metadata };
    if (sanitizedMetadata.email) {
        sanitizedMetadata.email = sanitizedMetadata.email.replace(/(.{2}).*(@.*)/, '$1***$2');
    }
    if (sanitizedMetadata.token) {
        sanitizedMetadata.token = '***';
    }
    if (sanitizedMetadata.password) {
        sanitizedMetadata.password = '***';
    }
    if (sanitizedMetadata.originalName) {
        // 파일명 일부만 표시
        const name = sanitizedMetadata.originalName;
        if (name.length > 20) {
            sanitizedMetadata.originalName = name.substring(0, 10) + '...' + name.substring(name.length - 10);
        }
    }
    
    const logEntry = {
        timestamp,
        level,
        requestId,
        userId,
        ip,
        message,
        ...sanitizedMetadata
    };
    
    return JSON.stringify(logEntry);
}

/**
 * 로그 파일에 쓰기
 */
function writeLog(file, logEntry) {
    try {
        fs.appendFileSync(file, logEntry + '\n', 'utf8');
    } catch (error) {
        console.error('로그 파일 쓰기 오류:', error);
    }
}

/**
 * 로그 레벨 확인
 */
function shouldLog(level) {
    return LOG_LEVELS[level] >= CURRENT_LOG_LEVEL;
}

/**
 * 로그 함수들
 */
const logger = {
    debug(message, metadata = {}) {
        if (shouldLog('DEBUG')) {
            const logEntry = formatLog('DEBUG', message, metadata);
            console.debug(logEntry);
            writeLog(LOG_FILE, logEntry);
        }
    },
    
    info(message, metadata = {}) {
        if (shouldLog('INFO')) {
            const logEntry = formatLog('INFO', message, metadata);
            console.info(logEntry);
            writeLog(LOG_FILE, logEntry);
        }
    },
    
    warn(message, metadata = {}) {
        if (shouldLog('WARN')) {
            const logEntry = formatLog('WARN', message, metadata);
            console.warn(logEntry);
            writeLog(LOG_FILE, logEntry);
            writeLog(ERROR_LOG_FILE, logEntry);
        }
    },
    
    error(message, metadata = {}) {
        if (shouldLog('ERROR')) {
            const logEntry = formatLog('ERROR', message, metadata);
            console.error(logEntry);
            writeLog(LOG_FILE, logEntry);
            writeLog(ERROR_LOG_FILE, logEntry);
        }
    },
    
    /**
     * 요청 로그 (access log)
     */
    access(req, res, responseTime) {
        const requestId = req.requestId || '-';
        const userId = req.user?.userId || '-';
        const ip = req.ip || req.connection.remoteAddress || '-';
        const method = req.method;
        const url = req.originalUrl || req.url;
        const statusCode = res.statusCode;
        const userAgent = req.get('user-agent') || '-';
        
        const logEntry = formatLog('INFO', `${method} ${url} ${statusCode}`, {
            requestId,
            userId,
            ip,
            method,
            url,
            statusCode,
            responseTime: `${responseTime}ms`,
            userAgent
        });
        
        writeLog(ACCESS_LOG_FILE, logEntry);
    },
    
    /**
     * 주요 이벤트 로깅
     */
    logEvent(eventType, metadata = {}) {
        const eventMessages = {
            UPLOAD_SUCCESS: '파일 업로드 성공',
            UPLOAD_FAILED: '파일 업로드 실패',
            JOB_STARTED: '작업 시작',
            JOB_COMPLETED: '작업 완료',
            JOB_FAILED: '작업 실패',
            DOWNLOAD_REQUESTED: '다운로드 요청',
            DELETE_MANUAL: '수동 삭제',
            DELETE_AUTO: '자동 삭제 (만료)',
            TOKEN_REFRESHED: '토큰 갱신',
            LOGIN_SUCCESS: '로그인 성공',
            LOGIN_FAILED: '로그인 실패'
        };
        
        const message = eventMessages[eventType] || eventType;
        this.info(message, {
            ...metadata,
            eventType
        });
    }
};

module.exports = logger;


