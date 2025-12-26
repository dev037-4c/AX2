/**
 * 인증 라우트
 * 회원가입, 로그인, 토큰 갱신 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const securityLogger = require('../utils/security-logger');
const { validatePassword } = require('../utils/password-validator');

// 계정 잠금 설정
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * 회원가입
 * POST /api/v1/auth/signup
 */
router.post('/signup', async (req, res, next) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { email, password, name } = req.body;
        
        // 입력 검증
        if (!email || !password || !name) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '이메일, 비밀번호, 이름은 필수입니다.'
                }
            });
        }
        
        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '올바른 이메일 형식이 아닙니다.'
                }
            });
        }
        
        // 비밀번호 강도 검증 (강화된 정책)
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: '비밀번호가 정책을 만족하지 않습니다.',
                    details: passwordValidation.errors
                }
            });
        }
        
        // 중복 이메일 확인
        const existingUser = await client.query(
            'SELECT user_id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                error: {
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: '이미 등록된 이메일입니다.'
                }
            });
        }
        
        // 비밀번호 해싱
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // 사용자 생성
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await client.query(
            `INSERT INTO users (user_id, email, password_hash, name, provider, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'email', NOW(), NOW())`,
            [userId, email, passwordHash, name]
        );
        
        // 크레딧 계정 생성
        await client.query(
            `INSERT INTO credits (user_id, balance, free_balance, total_charged, created_at, updated_at)
             VALUES ($1, 0, 0, 0, NOW(), NOW())`,
            [userId]
        );
        
        await client.query('COMMIT');
        
        logger.info('회원가입 성공', { userId, email });
        
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
        await client.query('ROLLBACK');
        logger.error('회원가입 오류', { error: error.message, email: req.body.email });
        next(error);
    } finally {
        client.release();
    }
});

/**
 * 로그인
 * POST /api/v1/auth/login
 */
router.post('/login', async (req, res, next) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { email, password } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');
        
        if (!email || !password) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '이메일과 비밀번호를 입력해주세요.'
                }
            });
        }
        
        // 사용자 조회 (잠금 상태 포함)
        const userResult = await client.query(
            `SELECT user_id, email, password_hash, name, picture, provider, 
                    failed_login_attempts, locked_until, is_active
             FROM users 
             WHERE email = $1`,
            [email]
        );
        
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            // 보안 로깅: 존재하지 않는 이메일로 로그인 시도
            await securityLogger.logLoginFailure(email, ipAddress, userAgent, 'User not found');
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.'
                }
            });
        }
        
        const user = userResult.rows[0];
        
        // 계정 활성화 확인
        if (!user.is_active) {
            await client.query('ROLLBACK');
            await securityLogger.logLoginFailure(email, ipAddress, userAgent, 'Account inactive');
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_INACTIVE',
                    message: '비활성화된 계정입니다.'
                }
            });
        }
        
        // 계정 잠금 확인
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            await client.query('ROLLBACK');
            const lockUntil = new Date(user.locked_until);
            const minutesRemaining = Math.ceil((lockUntil - new Date()) / 1000 / 60);
            await securityLogger.logLoginFailure(email, ipAddress, userAgent, 'Account locked');
            return res.status(423).json({
                success: false,
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message: `계정이 잠금되었습니다. ${minutesRemaining}분 후 다시 시도해주세요.`,
                    lockedUntil: lockUntil.toISOString()
                }
            });
        }
        
        // 잠금 시간이 지났으면 잠금 해제
        if (user.locked_until && new Date(user.locked_until) <= new Date()) {
            await client.query(
                `UPDATE users 
                 SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
                 WHERE user_id = $1`,
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
                await securityLogger.logAccountLocked(
                    user.user_id,
                    email,
                    ipAddress,
                    userAgent,
                    `Failed login attempts: ${newAttemptCount}`
                );
                
                // 브루트포스 공격 시도 로깅
                if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
                    await securityLogger.logBruteForceAttempt(email, ipAddress, userAgent, newAttemptCount);
                }
            }
            
            await client.query(
                `UPDATE users 
                 SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
                 WHERE user_id = $3`,
                [newAttemptCount, lockedUntil, user.user_id]
            );
            
            await client.query('COMMIT');
            
            // 보안 로깅
            await securityLogger.logLoginFailure(email, ipAddress, userAgent, 'Invalid password');
            
            if (lockedUntil) {
                const minutesRemaining = LOCKOUT_DURATION_MINUTES;
                return res.status(423).json({
                    success: false,
                    error: {
                        code: 'ACCOUNT_LOCKED',
                        message: `로그인 실패 횟수가 초과되어 계정이 ${LOCKOUT_DURATION_MINUTES}분간 잠금되었습니다.`,
                        lockedUntil: lockedUntil.toISOString()
                    }
                });
            }
            
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                    remainingAttempts: MAX_LOGIN_ATTEMPTS - newAttemptCount
                }
            });
        }
        
        // 로그인 성공: 실패 횟수 초기화 및 마지막 로그인 정보 업데이트
        await client.query(
            `UPDATE users 
             SET failed_login_attempts = 0, locked_until = NULL, 
                 last_login_at = NOW(), last_login_ip = $1, updated_at = NOW()
             WHERE user_id = $2`,
            [ipAddress, user.user_id]
        );
        
        await client.query('COMMIT');
        
        // JWT 토큰 생성
        const tokenPayload = {
            userId: user.user_id,
            email: user.email,
            name: user.name
        };
        
        const accessToken = generateToken(tokenPayload, '1h');
        const refreshToken = generateRefreshToken(tokenPayload);
        
        // 보안 로깅: 로그인 성공
        await securityLogger.logLoginSuccess(user.user_id, ipAddress, userAgent);
        
        logger.info('로그인 성공', { userId: user.user_id, email });
        
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
        await client.query('ROLLBACK');
        logger.error('로그인 오류', { error: error.message, email: req.body.email });
        next(error);
    } finally {
        client.release();
    }
});

/**
 * 토큰 갱신
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Refresh Token이 필요합니다.'
                }
            });
        }
        
        // Refresh Token 검증
        const decoded = verifyRefreshToken(refreshToken);
        
        // 새 Access Token 생성
        const tokenPayload = {
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        };
        
        const newAccessToken = generateToken(tokenPayload, '1h');
        
        res.json({
            success: true,
            data: {
                accessToken: newAccessToken,
                expiresIn: 3600
            }
        });
        
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_REFRESH_TOKEN',
                message: 'Refresh Token이 유효하지 않거나 만료되었습니다.'
            }
        });
    }
});

/**
 * 현재 사용자 정보 조회
 * GET /api/v1/auth/me
 */
const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const userResult = await db.query(
            `SELECT user_id, email, name, picture, provider, created_at, updated_at
             FROM users 
             WHERE user_id = $1 AND is_active = true`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: '사용자를 찾을 수 없습니다.'
                }
            });
        }
        
        res.json({
            success: true,
            data: userResult.rows[0]
        });
        
    } catch (error) {
        logger.error('사용자 정보 조회 오류', { error: error.message, userId: req.user?.userId });
        next(error);
    }
});

module.exports = router;



