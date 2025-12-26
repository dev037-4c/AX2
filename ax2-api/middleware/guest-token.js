/**
 * 게스트 토큰 미들웨어
 * 비로그인 사용자 제한된 접근
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// 게스트 토큰 저장 (메모리, 실제로는 Redis 권장)
const guestTokens = new Map();

// 게스트 토큰 만료 시간 (24시간)
const GUEST_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * 게스트 토큰 생성
 */
function generateGuestToken(ip) {
    const token = `guest_${uuidv4()}`;
    const expiry = Date.now() + GUEST_TOKEN_EXPIRY;
    
    guestTokens.set(token, {
        ip,
        createdAt: Date.now(),
        expiry,
        uploadCount: 0,
        maxUploads: 3 // 게스트는 최대 3회 업로드
    });
    
    // 만료된 토큰 정리 (1시간마다)
    if (guestTokens.size % 100 === 0) {
        cleanupExpiredTokens();
    }
    
    logger.info('게스트 토큰 생성', {
        token: token.substring(0, 20) + '...',
        ip
    });
    
    return token;
}

/**
 * 게스트 토큰 검증
 */
function verifyGuestToken(token, ip) {
    const tokenData = guestTokens.get(token);
    
    if (!tokenData) {
        return null;
    }
    
    // 만료 확인
    if (Date.now() > tokenData.expiry) {
        guestTokens.delete(token);
        return null;
    }
    
    // IP 확인 (보안)
    if (tokenData.ip !== ip) {
        logger.warn('게스트 토큰 IP 불일치', {
            token: token.substring(0, 20) + '...',
            expectedIp: tokenData.ip,
            actualIp: ip
        });
        return null;
    }
    
    return tokenData;
}

/**
 * 게스트 토큰 업로드 카운트 증가
 */
function incrementGuestUploadCount(token) {
    const tokenData = guestTokens.get(token);
    if (tokenData) {
        tokenData.uploadCount++;
        guestTokens.set(token, tokenData);
    }
}

/**
 * 게스트 토큰 업로드 가능 여부 확인
 */
function canGuestUpload(token) {
    const tokenData = guestTokens.get(token);
    if (!tokenData) {
        return false;
    }
    return tokenData.uploadCount < tokenData.maxUploads;
}

/**
 * 만료된 토큰 정리
 */
function cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, data] of guestTokens.entries()) {
        if (now > data.expiry) {
            guestTokens.delete(token);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        logger.debug('만료된 게스트 토큰 정리', { cleaned });
    }
}

/**
 * 게스트 토큰 미들웨어
 * 비로그인 사용자에게 게스트 토큰 발급
 */
function guestTokenMiddleware(req, res, next) {
    // 로그인 사용자는 건너뜀
    if (req.user) {
        return next();
    }
    
    // 게스트 토큰 확인 (헤더만 사용, 쿠키는 선택적)
    const guestToken = req.headers['x-guest-token'] || (req.cookies && req.cookies.guest_token);
    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (guestToken) {
        // 기존 토큰 검증
        const tokenData = verifyGuestToken(guestToken, clientIp);
        if (tokenData) {
            req.guestToken = guestToken;
            req.guestTokenData = tokenData;
            return next();
        }
    }
    
    // 새 게스트 토큰 생성
    const newToken = generateGuestToken(clientIp);
    req.guestToken = newToken;
    req.guestTokenData = guestTokens.get(newToken);
    
    // 응답 헤더에 토큰 포함
    res.setHeader('X-Guest-Token', newToken);
    
    // 쿠키에도 설정 (선택적, cookie-parser 필요)
    if (typeof res.cookie === 'function') {
        res.cookie('guest_token', newToken, {
            maxAge: GUEST_TOKEN_EXPIRY,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
    }
    
    next();
}

/**
 * 게스트 업로드 제한 미들웨어
 */
function guestUploadLimitMiddleware(req, res, next) {
    // 로그인 사용자는 건너뜀
    if (req.user) {
        return next();
    }
    
    // 게스트 토큰 확인
    if (!req.guestToken || !req.guestTokenData) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'GUEST_TOKEN_REQUIRED',
                message: '게스트 토큰이 필요합니다.'
            }
        });
    }
    
    // 업로드 가능 여부 확인
    if (!canGuestUpload(req.guestToken)) {
        logger.warn('게스트 업로드 한도 초과', {
            requestId: req.requestId,
            token: req.guestToken.substring(0, 20) + '...',
            uploadCount: req.guestTokenData.uploadCount,
            maxUploads: req.guestTokenData.maxUploads
        });
        
        return res.status(429).json({
            success: false,
            error: {
                code: 'GUEST_UPLOAD_LIMIT_EXCEEDED',
                message: `비로그인 사용자는 최대 ${req.guestTokenData.maxUploads}회까지만 업로드할 수 있습니다. 로그인하시면 더 많은 업로드가 가능합니다.`,
                details: {
                    uploadCount: req.guestTokenData.uploadCount,
                    maxUploads: req.guestTokenData.maxUploads
                }
            }
        });
    }
    
    // 업로드 성공 시 카운트 증가 (업로드 완료 후)
    req.incrementGuestUpload = () => {
        incrementGuestUploadCount(req.guestToken);
    };
    
    next();
}

module.exports = {
    guestTokenMiddleware,
    guestUploadLimitMiddleware,
    generateGuestToken,
    verifyGuestToken,
    canGuestUpload,
    cleanupExpiredTokens
};


