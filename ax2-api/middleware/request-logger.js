/**
 * 요청 로깅 미들웨어
 * request_id 생성 및 요청/응답 로깅
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * request_id 생성 및 요청 로깅
 */
function requestLogger(req, res, next) {
    // request_id 생성
    req.requestId = uuidv4();
    
    // 요청 시작 시간
    req.startTime = Date.now();
    
    // 응답 완료 시 로깅
    res.on('finish', () => {
        const responseTime = Date.now() - req.startTime;
        logger.access(req, res, responseTime);
    });
    
    // 요청 정보 로깅 (디버그 모드)
    logger.debug('요청 시작', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
    });
    
    next();
}

module.exports = requestLogger;


