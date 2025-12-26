/**
 * 인증 라우트
 * 회원가입, 로그인, 토큰 갱신 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken, generateRefreshToken, verifyRefreshToken, requireAuth } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../middleware/error-handler');

// 계정 잠금 설정
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * 회원가입
 * POST /api/auth/signup
 */
router.post('/signup', async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        
        // 입력 검증
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '이메일, 비밀번호, 이름은 필수입니다.'
                }
            });
        }
        
        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '올바른 이메일 형식이 아닙니다.'
                }
            });
        }
        
        // 비밀번호 최소 길이 검증
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '비밀번호는 최소 8자 이상이어야 합니다.'
                }
            });
        }
        
        // 중복 이메일 확인
        const [existingUsers] = await db.execute(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );
        
        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                error: {
                    code: ERROR_CODES.DUPLICATE_ENTRY.code,
                    message: '이미 등록된 이메일입니다.'
                }
            });
        }
        
        // 비밀번호 해싱
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // 사용자 생성
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.execute(
            `INSERT INTO users (user_id, email, password_hash, name, provider, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'email', NOW(), NOW())`,
            [userId, email, passwordHash, name]
        );
        
        // 크레딧 계정 생성
        await db.execute(
            `INSERT INTO credits (user_id, balance, free_balance, total_charged, created_at, updated_at)
             VALUES (?, 0, 0, 0, NOW(), NOW())`,
            [userId]
        );
        
        logger.logEvent('SIGNUP_SUCCESS', {
            requestId: req.requestId,
            userId,
            email
        });
        
        res.status(201).json({
            success: true,
            message: '회원가입이 완료되었습니다.',
            data: {
                userId: userId,
                email: email,
                name: name,
                createdAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('회원가입 오류', {
            requestId: req.requestId,
            error: error.message,
            email: req.body.email
        });
        next(error);
    }
});

/**
 * 이메일 로그인
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '이메일과 비밀번호를 입력해주세요.'
                }
            });
        }
        
        // 사용자 조회
        const [users] = await db.execute(
            `SELECT user_id, email, password_hash, name, picture, provider, 
                    failed_login_attempts, locked_until, is_active
             FROM users 
             WHERE email = ?`,
            [email]
        );
        
        if (users.length === 0) {
            logger.warn('로그인 실패: 사용자 없음', {
                requestId: req.requestId,
                email,
                ip: ipAddress
            });
            return res.status(401).json({
                success: false,
                error: {
                    code: ERROR_CODES.UNAUTHORIZED.code,
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.'
                }
            });
        }
        
        const user = users[0];
        
        // 계정 활성화 확인
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: {
                    code: ERROR_CODES.ACCOUNT_LOCKED.code,
                    message: '비활성화된 계정입니다.'
                }
            });
        }
        
        // 계정 잠금 확인
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const lockUntil = new Date(user.locked_until);
            const minutesRemaining = Math.ceil((lockUntil - new Date()) / 1000 / 60);
            return res.status(423).json({
                success: false,
                error: {
                    code: ERROR_CODES.ACCOUNT_LOCKED.code,
                    message: `계정이 잠금되었습니다. ${minutesRemaining}분 후 다시 시도해주세요.`,
                    lockedUntil: lockUntil.toISOString()
                }
            });
        }
        
        // 잠금 시간이 지났으면 잠금 해제
        if (user.locked_until && new Date(user.locked_until) <= new Date()) {
            await db.execute(
                `UPDATE users 
                 SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
                 WHERE user_id = ?`,
                [user.user_id]
            );
        }
        
        // 비밀번호 확인
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            // 실패 횟수 증가
            const newAttemptCount = (user.failed_login_attempts || 0) + 1;
            
            let lockedUntil = null;
            if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
                lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
            }
            
            await db.execute(
                `UPDATE users 
                 SET failed_login_attempts = ?, locked_until = ?, updated_at = NOW()
                 WHERE user_id = ?`,
                [newAttemptCount, lockedUntil, user.user_id]
            );
            
            logger.warn('로그인 실패: 비밀번호 오류', {
                requestId: req.requestId,
                userId: user.user_id,
                email,
                attempts: newAttemptCount,
                ip: ipAddress
            });
            
            if (lockedUntil) {
                return res.status(423).json({
                    success: false,
                    error: {
                        code: ERROR_CODES.ACCOUNT_LOCKED.code,
                        message: `로그인 실패 횟수가 초과되어 계정이 ${LOCKOUT_DURATION_MINUTES}분간 잠금되었습니다.`,
                        lockedUntil: lockedUntil.toISOString()
                    }
                });
            }
            
            return res.status(401).json({
                success: false,
                error: {
                    code: ERROR_CODES.UNAUTHORIZED.code,
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                    remainingAttempts: MAX_LOGIN_ATTEMPTS - newAttemptCount
                }
            });
        }
        
        // 로그인 성공: 실패 횟수 초기화 및 마지막 로그인 정보 업데이트
        await db.execute(
            `UPDATE users 
             SET failed_login_attempts = 0, locked_until = NULL, 
                 last_login_at = NOW(), last_login_ip = ?, updated_at = NOW()
             WHERE user_id = ?`,
            [ipAddress, user.user_id]
        );
        
        // JWT 토큰 생성
        const tokenPayload = {
            userId: user.user_id,
            email: user.email,
            name: user.name
        };
        
        const accessToken = generateToken(tokenPayload, '1h');
        const refreshToken = generateRefreshToken(tokenPayload);
        
        // 세션 저장 (선택사항)
        const sessionId = uuidv4();
        const accessTokenExpiresAt = new Date(Date.now() + 3600 * 1000);
        const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
        
        await db.execute(
            `INSERT INTO user_sessions (session_id, user_id, access_token, refresh_token, 
                                       access_token_expires_at, refresh_token_expires_at, 
                                       ip_address, user_agent, created_at, last_accessed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [sessionId, user.user_id, accessToken, refreshToken, 
             accessTokenExpiresAt, refreshTokenExpiresAt, ipAddress, userAgent]
        );
        
        logger.logEvent('LOGIN_SUCCESS', {
            requestId: req.requestId,
            userId: user.user_id,
            email,
            ip: ipAddress
        });
        
        res.json({
            success: true,
            message: '로그인 성공',
            data: {
                accessToken: accessToken,
                refreshToken: refreshToken,
                expiresIn: 3600,
                user: {
                    userId: user.user_id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    provider: user.provider
                }
            }
        });
        
    } catch (error) {
        logger.error('로그인 오류', {
            requestId: req.requestId,
            error: error.message,
            email: req.body.email
        });
        next(error);
    }
});

/**
 * 토큰 갱신
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'Refresh Token이 필요합니다.'
                }
            });
        }
        
        // Refresh Token 검증
        const decoded = verifyRefreshToken(refreshToken);
        
        // 세션 확인
        const [sessions] = await db.execute(
            `SELECT user_id FROM user_sessions 
             WHERE refresh_token = ? AND refresh_token_expires_at > NOW()`,
            [refreshToken]
        );
        
        if (sessions.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: ERROR_CODES.INVALID_TOKEN.code,
                    message: 'Refresh Token이 유효하지 않거나 만료되었습니다.'
                }
            });
        }
        
        // 새 Access Token 생성
        const tokenPayload = {
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        };
        
        const newAccessToken = generateToken(tokenPayload, '1h');
        
        // 세션 업데이트
        const newAccessTokenExpiresAt = new Date(Date.now() + 3600 * 1000);
        await db.execute(
            `UPDATE user_sessions 
             SET access_token = ?, access_token_expires_at = ?, last_accessed_at = NOW()
             WHERE refresh_token = ?`,
            [newAccessToken, newAccessTokenExpiresAt, refreshToken]
        );
        
        logger.logEvent('TOKEN_REFRESHED', {
            requestId: req.requestId,
            userId: decoded.userId
        });
        
        res.json({
            success: true,
            data: {
                accessToken: newAccessToken,
                expiresIn: 3600
            }
        });
        
    } catch (error) {
        logger.error('토큰 갱신 오류', {
            requestId: req.requestId,
            error: error.message
        });
        return res.status(401).json({
            success: false,
            error: {
                code: ERROR_CODES.INVALID_TOKEN.code,
                message: 'Refresh Token이 유효하지 않거나 만료되었습니다.'
            }
        });
    }
});

/**
 * 로그아웃
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const userId = req.user.userId;
        
        if (refreshToken) {
            // 세션 삭제
            await db.execute(
                'DELETE FROM user_sessions WHERE refresh_token = ? AND user_id = ?',
                [refreshToken, userId]
            );
        }
        
        logger.logEvent('LOGOUT_SUCCESS', {
            requestId: req.requestId,
            userId
        });
        
        res.json({
            success: true,
            message: '로그아웃되었습니다.'
        });
        
    } catch (error) {
        logger.error('로그아웃 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 현재 사용자 정보 조회
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const [users] = await db.execute(
            `SELECT user_id, email, name, picture, provider, created_at, updated_at
             FROM users 
             WHERE user_id = ? AND is_active = true`,
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.NOT_FOUND.code,
                    message: '사용자를 찾을 수 없습니다.'
                }
            });
        }
        
        res.json({
            success: true,
            data: users[0]
        });
        
    } catch (error) {
        logger.error('사용자 정보 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 사용자 정보 수정
 * PUT /api/auth/me
 */
router.put('/me', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { name, picture } = req.body;
        
        const updateFields = [];
        const updateValues = [];
        
        if (name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        
        if (picture !== undefined) {
            updateFields.push('picture = ?');
            updateValues.push(picture);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '수정할 정보를 입력해주세요.'
                }
            });
        }
        
        updateFields.push('updated_at = NOW()');
        updateValues.push(userId);
        
        await db.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
            updateValues
        );
        
        // 업데이트된 사용자 정보 조회
        const [users] = await db.execute(
            `SELECT user_id, email, name, picture, provider, created_at, updated_at
             FROM users WHERE user_id = ?`,
            [userId]
        );
        
        logger.logEvent('USER_UPDATED', {
            requestId: req.requestId,
            userId
        });
        
        res.json({
            success: true,
            message: '프로필이 수정되었습니다.',
            data: users[0]
        });
        
    } catch (error) {
        logger.error('사용자 정보 수정 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 비밀번호 변경
 * PUT /api/auth/password
 */
router.put('/password', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '현재 비밀번호와 새 비밀번호를 입력해주세요.'
                }
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: '새 비밀번호는 최소 8자 이상이어야 합니다.'
                }
            });
        }
        
        // 현재 비밀번호 확인
        const [users] = await db.execute(
            'SELECT password_hash FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.NOT_FOUND.code,
                    message: '사용자를 찾을 수 없습니다.'
                }
            });
        }
        
        const passwordMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: {
                    code: ERROR_CODES.UNAUTHORIZED.code,
                    message: '현재 비밀번호가 올바르지 않습니다.'
                }
            });
        }
        
        // 새 비밀번호 해싱
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // 비밀번호 업데이트
        await db.execute(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
            [newPasswordHash, userId]
        );
        
        logger.logEvent('PASSWORD_CHANGED', {
            requestId: req.requestId,
            userId
        });
        
        res.json({
            success: true,
            message: '비밀번호가 변경되었습니다.'
        });
        
    } catch (error) {
        logger.error('비밀번호 변경 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 소셜 로그인
 * POST /api/auth/social/:provider
 */
router.post('/social/:provider', async (req, res, next) => {
    try {
        const provider = req.params.provider;
        const { token, providerId } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');
        
        if (!token || !providerId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'token과 providerId가 필요합니다.'
                }
            });
        }
        
        // 지원하는 provider 확인
        const supportedProviders = ['google', 'kakao', 'naver'];
        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: `지원하지 않는 소셜 로그인 제공자입니다. (${supportedProviders.join(', ')})`
                }
            });
        }
        
        // TODO: 실제 소셜 로그인 토큰 검증 (Google/Kakao/Naver API 호출)
        // 여기서는 Mock 처리
        // 실제로는 각 provider의 API를 호출하여 사용자 정보를 가져와야 함
        
        // 기존 사용자 조회
        const [users] = await db.execute(
            'SELECT user_id, email, name, picture, provider FROM users WHERE provider = ? AND provider_id = ?',
            [provider, providerId]
        );
        
        let user;
        if (users.length > 0) {
            user = users[0];
        } else {
            // 새 사용자 생성
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const email = `${providerId}@${provider}.social`; // 임시 이메일
            const name = `${provider} User`; // TODO: 실제 이름 가져오기
            
            await db.execute(
                `INSERT INTO users (user_id, email, name, provider, provider_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                [userId, email, name, provider, providerId]
            );
            
            // 크레딧 계정 생성
            await db.execute(
                `INSERT INTO credits (user_id, balance, free_balance, total_charged) VALUES (?, 0, 0, 0)`,
                [userId]
            );
            
            user = {
                user_id: userId,
                email: email,
                name: name,
                picture: null,
                provider: provider
            };
        }
        
        // 마지막 로그인 정보 업데이트
        await db.execute(
            `UPDATE users 
             SET last_login_at = NOW(), last_login_ip = ?, updated_at = NOW()
             WHERE user_id = ?`,
            [ipAddress, user.user_id]
        );
        
        // JWT 토큰 생성
        const tokenPayload = {
            userId: user.user_id,
            email: user.email,
            name: user.name
        };
        
        const accessToken = generateToken(tokenPayload, '1h');
        const refreshToken = generateRefreshToken(tokenPayload);
        
        // 세션 저장
        const sessionId = uuidv4();
        const accessTokenExpiresAt = new Date(Date.now() + 3600 * 1000);
        const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
        
        await db.execute(
            `INSERT INTO user_sessions (session_id, user_id, access_token, refresh_token, 
                                       access_token_expires_at, refresh_token_expires_at, 
                                       ip_address, user_agent, created_at, last_accessed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [sessionId, user.user_id, accessToken, refreshToken, 
             accessTokenExpiresAt, refreshTokenExpiresAt, ipAddress, userAgent]
        );
        
        logger.logEvent('SOCIAL_LOGIN_SUCCESS', {
            requestId: req.requestId,
            userId: user.user_id,
            provider,
            ip: ipAddress
        });
        
        res.json({
            success: true,
            message: '로그인 성공',
            data: {
                accessToken: accessToken,
                refreshToken: refreshToken,
                expiresIn: 3600,
                user: {
                    userId: user.user_id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    provider: user.provider
                }
            }
        });
        
    } catch (error) {
        logger.error('소셜 로그인 오류', {
            requestId: req.requestId,
            error: error.message,
            provider: req.params.provider
        });
        next(error);
    }
});

/**
 * 회원 탈퇴
 * DELETE /api/auth/me
 */
router.delete('/me', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // 소프트 삭제
        await db.execute(
            'UPDATE users SET deleted_at = NOW(), is_active = false, updated_at = NOW() WHERE user_id = ?',
            [userId]
        );
        
        // 세션 삭제
        await db.execute(
            'DELETE FROM user_sessions WHERE user_id = ?',
            [userId]
        );
        
        logger.logEvent('USER_DELETED', {
            requestId: req.requestId,
            userId
        });
        
        res.json({
            success: true,
            message: '회원 탈퇴가 완료되었습니다.'
        });
        
    } catch (error) {
        logger.error('회원 탈퇴 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

module.exports = router;


