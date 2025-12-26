/**
 * 인증 미들웨어
 * JWT 토큰 검증 및 사용자 정보 추출
 */

const jwt = require('jsonwebtoken');
const securityLogger = require('../utils/security-logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

/**
 * JWT 토큰 검증 미들웨어
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
function authenticateToken(req, res, next) {
    // 인증이 선택적인 경우 (비로그인 사용자 허용)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        // 비로그인 사용자 허용 (선택적 인증)
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        };
        next();
    } catch (error) {
        // 토큰이 유효하지 않으면 비로그인 사용자로 처리
        // 보안 로깅: 유효하지 않은 토큰
        if (error.name === 'TokenExpiredError') {
            securityLogger.logSecurityEvent(
                securityLogger.EventType.TOKEN_EXPIRED,
                securityLogger.EventCategory.AUTHENTICATION,
                securityLogger.Severity.LOW,
                '만료된 토큰 사용 시도',
                {
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent')
                }
            );
        } else if (error.name === 'JsonWebTokenError') {
            securityLogger.logSecurityEvent(
                securityLogger.EventType.TOKEN_INVALID,
                securityLogger.EventCategory.AUTHENTICATION,
                securityLogger.Severity.MEDIUM,
                '유효하지 않은 토큰 사용 시도',
                {
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent'),
                    metadata: { error: error.message }
                }
            );
        }
        req.user = null;
        next();
    }
}

/**
 * 필수 인증 미들웨어 (로그인 필수)
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: '인증이 필요합니다.'
            }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        };
        next();
    } catch (error) {
        // 보안 로깅: 인증 실패
        if (error.name === 'TokenExpiredError') {
            securityLogger.logSecurityEvent(
                securityLogger.EventType.TOKEN_EXPIRED,
                securityLogger.EventCategory.AUTHENTICATION,
                securityLogger.Severity.MEDIUM,
                '만료된 토큰으로 인증 시도',
                {
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent')
                }
            );
        } else {
            securityLogger.logSecurityEvent(
                securityLogger.EventType.TOKEN_INVALID,
                securityLogger.EventCategory.AUTHENTICATION,
                securityLogger.Severity.MEDIUM,
                '유효하지 않은 토큰으로 인증 시도',
                {
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent'),
                    metadata: { error: error.message }
                }
            );
        }
        
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: '유효하지 않은 토큰입니다.'
            }
        });
    }
}

/**
 * JWT 토큰 생성
 * @param {Object} payload - 토큰 페이로드
 * @param {string} expiresIn - 만료 시간 (예: '1h', '7d')
 * @returns {string} JWT 토큰
 */
function generateToken(payload, expiresIn = '1h') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Refresh Token 생성
 * @param {Object} payload - 토큰 페이로드
 * @returns {string} Refresh Token
 */
function generateRefreshToken(payload) {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

/**
 * Refresh Token 검증
 * @param {string} token - Refresh Token
 * @returns {Object} 디코딩된 페이로드
 */
function verifyRefreshToken(token) {
    return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
    authenticateToken,
    requireAuth,
    generateToken,
    generateRefreshToken,
    verifyRefreshToken
};



