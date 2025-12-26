/**
 * 전역 에러 핸들러
 * 표준화된 에러 응답 및 로깅
 */

const logger = require('../utils/logger');

/**
 * 표준 에러 응답 형식
 */
class AppError extends Error {
    constructor(code, message, statusCode = 400, details = null) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * HTTP 상태 코드별 에러 코드 매핑
 */
const ERROR_CODES = {
    // 400 Bad Request
    VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400 },
    INVALID_INPUT: { code: 'INVALID_INPUT', status: 400 },
    NO_FILE: { code: 'NO_FILE', status: 400 },
    FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', status: 400 },
    INVALID_FILE_TYPE: { code: 'INVALID_FILE_TYPE', status: 400 },
    
    // 401 Unauthorized
    UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
    INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401 },
    TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401 },
    
    // 403 Forbidden
    FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
    ACCESS_DENIED: { code: 'ACCESS_DENIED', status: 403 },
    
    // 404 Not Found
    NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
    JOB_NOT_FOUND: { code: 'JOB_NOT_FOUND', status: 404 },
    
    // 409 Conflict
    DUPLICATE_ENTRY: { code: 'DUPLICATE_ENTRY', status: 409 },
    JOB_ALREADY_EXISTS: { code: 'JOB_ALREADY_EXISTS', status: 409 },
    
    // 423 Locked
    ACCOUNT_LOCKED: { code: 'ACCOUNT_LOCKED', status: 423 },
    
    // 429 Too Many Requests
    RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429 },
    
    // 500 Internal Server Error
    SERVER_ERROR: { code: 'SERVER_ERROR', status: 500 },
    DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500 },
    UPLOAD_ERROR: { code: 'UPLOAD_ERROR', status: 500 },
    PROCESSING_ERROR: { code: 'PROCESSING_ERROR', status: 500 },
};

/**
 * 에러 응답 생성
 */
function createErrorResponse(error, requestId = null) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // AppError인 경우
    if (error.isOperational) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                ...(error.details && { details: error.details }),
                ...(requestId && { requestId })
            }
        };
    }
    
    // Multer 에러 처리
    if (error.name === 'MulterError') {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return {
                success: false,
                error: {
                    code: ERROR_CODES.FILE_TOO_LARGE.code,
                    message: '파일 크기가 제한을 초과합니다.',
                    ...(requestId && { requestId })
                }
            };
        }
        return {
            success: false,
            error: {
                code: ERROR_CODES.UPLOAD_ERROR.code,
                message: error.message || '파일 업로드 중 오류가 발생했습니다.',
                ...(requestId && { requestId })
            }
        };
    }
    
    // 데이터베이스 에러 처리
    if (error.code && error.code.startsWith('ER_')) {
        logger.error('데이터베이스 오류', {
            requestId,
            error: error.message,
            code: error.code,
            sqlState: error.sqlState
        });
        
        return {
            success: false,
            error: {
                code: ERROR_CODES.DATABASE_ERROR.code,
                message: isProduction 
                    ? '데이터베이스 오류가 발생했습니다.' 
                    : error.message,
                ...(requestId && { requestId })
            }
        };
    }
    
    // 기타 에러
    logger.error('예상치 못한 오류', {
        requestId,
        error: error.message,
        stack: isProduction ? undefined : error.stack
    });
    
    return {
        success: false,
        error: {
            code: ERROR_CODES.SERVER_ERROR.code,
            message: isProduction 
                ? '서버 오류가 발생했습니다.' 
                : error.message,
            ...(requestId && { requestId })
        }
    };
}

/**
 * 전역 에러 핸들러 미들웨어
 */
function errorHandler(error, req, res, next) {
    const requestId = req.requestId || null;
    const errorResponse = createErrorResponse(error, requestId);
    
    // 상태 코드 결정
    let statusCode = 500;
    if (error.isOperational) {
        statusCode = error.statusCode;
    } else if (error.name === 'MulterError') {
        statusCode = 400;
    } else if (error.code && ERROR_CODES[error.code]) {
        statusCode = ERROR_CODES[error.code].status;
    }
    
    // 보안: 프로덕션에서는 스택 트레이스 숨김
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        logger.error('에러 스택', {
            requestId,
            stack: error.stack
        });
    }
    
    res.status(statusCode).json(errorResponse);
}

/**
 * 404 핸들러
 */
function notFoundHandler(req, res) {
    const requestId = req.requestId || null;
    res.status(404).json({
        success: false,
        error: {
            code: ERROR_CODES.NOT_FOUND.code,
            message: '요청한 리소스를 찾을 수 없습니다.',
            ...(requestId && { requestId })
        }
    });
}

module.exports = {
    AppError,
    ERROR_CODES,
    errorHandler,
    notFoundHandler,
    createErrorResponse
};


