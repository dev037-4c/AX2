/**
 * 로거 유틸리티
 * 구조화된 로깅 시스템
 */

const fs = require('fs').promises;
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const isDevelopment = process.env.NODE_ENV === 'development';

// 로그 레벨
const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

// 로그 디렉토리 생성
async function ensureLogDirectory() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
        console.error('로그 디렉토리 생성 실패:', error);
    }
}

// 로그 파일 경로
function getLogFilePath(level) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(LOG_DIR, `${date}-${level.toLowerCase()}.log`);
}

// 로그 형식
function formatLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
        timestamp,
        level,
        message,
        ...data
    }) + '\n';
}

// 파일에 로그 쓰기 (비동기)
async function writeToFile(level, message, data) {
    try {
        const logFile = getLogFilePath(level);
        const logEntry = formatLog(level, message, data);
        await fs.appendFile(logFile, logEntry, 'utf8');
    } catch (error) {
        console.error('로그 파일 쓰기 실패:', error);
    }
}

const logger = {
    /**
     * DEBUG 레벨 로그
     */
    debug(message, data = {}) {
        if (isDevelopment) {
            console.debug(`[DEBUG] ${message}`, data);
        }
        writeToFile(LogLevel.DEBUG, message, data);
    },

    /**
     * INFO 레벨 로그
     */
    info(message, data = {}) {
        console.log(`[INFO] ${message}`, data);
        writeToFile(LogLevel.INFO, message, data);
    },

    /**
     * WARN 레벨 로그
     */
    warn(message, data = {}) {
        console.warn(`[WARN] ${message}`, data);
        writeToFile(LogLevel.WARN, message, data);
    },

    /**
     * ERROR 레벨 로그
     */
    error(message, data = {}) {
        console.error(`[ERROR] ${message}`, data);
        writeToFile(LogLevel.ERROR, message, data);
    }
};

// 초기화
ensureLogDirectory();

module.exports = logger;



