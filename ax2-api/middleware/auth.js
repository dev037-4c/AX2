/**
 * JWT 토큰 인증 미들웨어 (ax2-api)
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

/**
 * JWT 토큰 검증 미들웨어 (선택적 인증)
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
function authenticateToken(req, res, next) {
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
        if (error.name === 'TokenExpiredError') {
            logger.warn('만료된 토큰 사용 시도', {
                requestId: req.requestId,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('유효하지 않은 토큰 사용 시도', {
                requestId: req.requestId,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                error: error.message
            });
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
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
                }
            });
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


