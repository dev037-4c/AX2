/**
 * IP별 Rate Limit 미들웨어
 * 업로드 남용 방지
 */

const rateLimit = require('express-rate-limit');
const { AppError, ERROR_CODES } = require('./error-handler');
const logger = require('../utils/logger');

/**
 * IP 추출 함수
 */
function getClientIp(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
           'unknown';
}

/**
 * 비로그인 사용자 업로드 제한 (더 강하게)
 * - 15분당 3회
 * - IP 기반
 */
const guestUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 3, // 최대 3회
    keyGenerator: (req) => {
        // IP 기반 키 생성
        return `guest_upload:${getClientIp(req)}`;
    },
    message: {
        success: false,
        error: {
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED.code,
            message: '비로그인 사용자는 15분당 3회까지만 업로드할 수 있습니다. 로그인하시면 더 많은 업로드가 가능합니다.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // 로그인 사용자는 이 제한을 건너뜀
        return !!req.user;
    },
    onLimitReached: (req, res, options) => {
        logger.warn('비로그인 사용자 업로드 제한 초과', {
            requestId: req.requestId,
            ip: getClientIp(req),
            limit: options.max,
            windowMs: options.windowMs
        });
    }
});

/**
 * 로그인 사용자 업로드 제한
 * - 15분당 10회
 * - 사용자 ID 기반
 */
const userUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 10, // 최대 10회
    keyGenerator: (req) => {
        // 사용자 ID 기반 키 생성
        if (req.user && req.user.userId) {
            return `user_upload:${req.user.userId}`;
        }
        // 로그인하지 않은 경우 IP 기반
        return `user_upload:${getClientIp(req)}`;
    },
    message: {
        success: false,
        error: {
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED.code,
            message: '너무 많은 업로드 요청이 있습니다. 잠시 후 다시 시도하세요.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // 비로그인 사용자는 이 제한을 건너뜀 (guestUploadLimiter 사용)
        return !req.user;
    },
    onLimitReached: (req, res, options) => {
        logger.warn('로그인 사용자 업로드 제한 초과', {
            requestId: req.requestId,
            userId: req.user?.userId || null,
            ip: getClientIp(req),
            limit: options.max,
            windowMs: options.windowMs
        });
    }
});

/**
 * IP별 일반 API 제한
 * - 15분당 200회
 */
const ipApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 200, // 최대 200회
    keyGenerator: (req) => {
        return `api:${getClientIp(req)}`;
    },
    message: {
        success: false,
        error: {
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED.code,
            message: '너무 많은 요청이 있습니다. 잠시 후 다시 시도하세요.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    onLimitReached: (req, res, options) => {
        logger.warn('IP별 API 제한 초과', {
            requestId: req.requestId,
            ip: getClientIp(req),
            limit: options.max,
            windowMs: options.windowMs
        });
    }
});

module.exports = {
    guestUploadLimiter,
    userUploadLimiter,
    ipApiLimiter,
    getClientIp
};


