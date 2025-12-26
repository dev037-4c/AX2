/**
 * 에러 처리 미들웨어
 * 통합 에러 처리 및 로깅
 */

const logger = require('../utils/logger');

/**
 * 에러 처리 미들웨어
 * @param {Error} err - 에러 객체
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
function errorHandler(err, req, res, next) {
    // 에러 로깅
    logger.error('에러 발생:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId || 'anonymous'
    });

    // 개발 환경에서만 스택 트레이스 표시
    const isDevelopment = process.env.NODE_ENV === 'development';

    // 에러 타입별 처리
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: err.message,
                details: err.details
            }
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: '인증이 필요합니다.'
            }
        });
    }

    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'FILE_TOO_LARGE',
                    message: '파일 크기는 2GB를 초과할 수 없습니다.'
                }
            });
        }
    }

    // 기본 에러 응답
    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || '서버 내부 오류가 발생했습니다.',
            details: isDevelopment ? err.stack : undefined
        }
    });
}

/**
 * 404 핸들러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: '요청한 리소스를 찾을 수 없습니다.',
            path: req.path
        }
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};



