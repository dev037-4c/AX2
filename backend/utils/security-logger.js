/**
 * 보안 이벤트 로깅 유틸리티
 * OWASP A09: Security Logging and Monitoring Failures 대응
 */

const db = require('../db/index');
const logger = require('./logger');

// 보안 이벤트 카테고리
const EventCategory = {
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    DATA_ACCESS: 'data_access',
    SYSTEM: 'system',
    SUSPICIOUS: 'suspicious'
};

// 보안 이벤트 타입
const EventType = {
    // 인증 관련
    LOGIN_SUCCESS: 'login_success',
    LOGIN_FAILURE: 'login_failure',
    LOGOUT: 'logout',
    ACCOUNT_LOCKED: 'account_locked',
    ACCOUNT_UNLOCKED: 'account_unlocked',
    PASSWORD_CHANGE: 'password_change',
    PASSWORD_RESET: 'password_reset',
    
    // 인가 관련
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    PERMISSION_DENIED: 'permission_denied',
    
    // 데이터 접근
    DATA_ACCESS: 'data_access',
    DATA_MODIFICATION: 'data_modification',
    DATA_DELETION: 'data_deletion',
    
    // 의심스러운 활동
    BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
    SUSPICIOUS_IP: 'suspicious_ip',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    
    // 시스템
    TOKEN_EXPIRED: 'token_expired',
    TOKEN_INVALID: 'token_invalid',
    SESSION_EXPIRED: 'session_expired'
};

// 심각도 레벨
const Severity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * 보안 이벤트 로깅
 * @param {string} eventType - 이벤트 타입
 * @param {string} category - 이벤트 카테고리
 * @param {string} severity - 심각도
 * @param {string} description - 설명
 * @param {Object} options - 추가 옵션
 * @param {string} options.userId - 사용자 ID
 * @param {string} options.ipAddress - IP 주소
 * @param {string} options.userAgent - User Agent
 * @param {Object} options.metadata - 추가 메타데이터
 */
async function logSecurityEvent(eventType, category, severity, description, options = {}) {
    const {
        userId = null,
        ipAddress = null,
        userAgent = null,
        metadata = {}
    } = options;

    try {
        // 데이터베이스에 저장
        await db.query(
            `INSERT INTO security_events 
             (user_id, event_type, event_category, severity, description, ip_address, user_agent, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                userId,
                eventType,
                category,
                severity,
                description,
                ipAddress,
                userAgent,
                JSON.stringify(metadata)
            ]
        );

        // 로그 파일에도 기록
        const logMessage = `[SECURITY] ${eventType} - ${description}`;
        const logData = {
            userId,
            ipAddress,
            eventType,
            category,
            severity,
            metadata
        };

        if (severity === Severity.CRITICAL || severity === Severity.HIGH) {
            logger.error(logMessage, logData);
        } else if (severity === Severity.MEDIUM) {
            logger.warn(logMessage, logData);
        } else {
            logger.info(logMessage, logData);
        }

    } catch (error) {
        // 보안 로깅 실패는 심각한 문제이므로 에러 로깅
        logger.error('보안 이벤트 로깅 실패', {
            error: error.message,
            eventType,
            category,
            severity,
            description
        });
    }
}

/**
 * 로그인 성공 로깅
 */
async function logLoginSuccess(userId, ipAddress, userAgent) {
    await logSecurityEvent(
        EventType.LOGIN_SUCCESS,
        EventCategory.AUTHENTICATION,
        Severity.LOW,
        `사용자 로그인 성공: ${userId}`,
        { userId, ipAddress, userAgent }
    );
}

/**
 * 로그인 실패 로깅
 */
async function logLoginFailure(email, ipAddress, userAgent, reason = 'Invalid credentials') {
    await logSecurityEvent(
        EventType.LOGIN_FAILURE,
        EventCategory.AUTHENTICATION,
        Severity.MEDIUM,
        `로그인 실패: ${email} - ${reason}`,
        { ipAddress, userAgent, metadata: { email, reason } }
    );
}

/**
 * 계정 잠금 로깅
 */
async function logAccountLocked(userId, email, ipAddress, userAgent, reason) {
    await logSecurityEvent(
        EventType.ACCOUNT_LOCKED,
        EventCategory.AUTHENTICATION,
        Severity.HIGH,
        `계정 잠금: ${email} - ${reason}`,
        { userId, ipAddress, userAgent, metadata: { email, reason } }
    );
}

/**
 * 무단 접근 시도 로깅
 */
async function logUnauthorizedAccess(userId, resourceType, resourceId, ipAddress, userAgent) {
    await logSecurityEvent(
        EventType.UNAUTHORIZED_ACCESS,
        EventCategory.AUTHORIZATION,
        Severity.HIGH,
        `무단 접근 시도: ${resourceType}/${resourceId}`,
        { userId, ipAddress, userAgent, metadata: { resourceType, resourceId } }
    );
}

/**
 * 브루트포스 공격 시도 로깅
 */
async function logBruteForceAttempt(email, ipAddress, userAgent, attemptCount) {
    await logSecurityEvent(
        EventType.BRUTE_FORCE_ATTEMPT,
        EventCategory.SUSPICIOUS,
        Severity.CRITICAL,
        `브루트포스 공격 시도 감지: ${email} (${attemptCount}회 실패)`,
        { ipAddress, userAgent, metadata: { email, attemptCount } }
    );
}

/**
 * 의심스러운 IP 로깅
 */
async function logSuspiciousIP(ipAddress, userAgent, reason, metadata = {}) {
    await logSecurityEvent(
        EventType.SUSPICIOUS_IP,
        EventCategory.SUSPICIOUS,
        Severity.HIGH,
        `의심스러운 IP 감지: ${ipAddress} - ${reason}`,
        { ipAddress, userAgent, metadata }
    );
}

module.exports = {
    logSecurityEvent,
    logLoginSuccess,
    logLoginFailure,
    logAccountLocked,
    logUnauthorizedAccess,
    logBruteForceAttempt,
    logSuspiciousIP,
    EventCategory,
    EventType,
    Severity
};


