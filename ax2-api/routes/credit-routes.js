/**
 * 크레딧 라우트
 * 크레딧 조회, 계산, 충전 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const creditService = require('../api/credit-service');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../middleware/error-handler');
const { v4: uuidv4 } = require('uuid');

// 모든 라우트에 인증 미들웨어 적용 (선택적)
router.use(authenticateToken);

/**
 * 크레딧 잔액 조회
 * GET /api/credits/balance
 */
router.get('/balance', async (req, res, next) => {
    try {
        const userId = req.user?.userId || null;
        const deviceId = req.headers['x-device-id'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        const balance = await creditService.getCreditBalance(db, userId, deviceId, ipAddress);
        
        res.json({
            success: true,
            data: balance
        });
        
    } catch (error) {
        logger.error('크레딧 잔액 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 크레딧 계산
 * POST /api/credits/calculate
 */
router.post('/calculate', async (req, res, next) => {
    try {
        const { durationSeconds, translationLanguageCount } = req.body;
        
        if (!durationSeconds) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'durationSeconds는 필수입니다.'
                }
            });
        }
        
        const requiredCredits = creditService.calculateRequiredCredits(
            parseFloat(durationSeconds),
            parseInt(translationLanguageCount) || 0
        );
        
        const durationMinutes = Math.ceil(durationSeconds / 60);
        const baseCredits = durationMinutes * 10;
        const translationCredits = durationMinutes * 5 * (parseInt(translationLanguageCount) || 0);
        
        res.json({
            success: true,
            data: {
                durationSeconds: parseFloat(durationSeconds),
                durationMinutes: durationMinutes,
                translationLanguageCount: parseInt(translationLanguageCount) || 0,
                baseCredits: baseCredits,
                translationCredits: translationCredits,
                totalCredits: requiredCredits
            }
        });
        
    } catch (error) {
        logger.error('크레딧 계산 오류', {
            requestId: req.requestId,
            error: error.message
        });
        next(error);
    }
});

/**
 * 크레딧 패키지 목록 조회
 * GET /api/credits/packages
 */
router.get('/packages', async (req, res, next) => {
    try {
        const [packages] = await db.execute(
            `SELECT package_id, name, credits, bonus, price, currency, is_active, display_order
             FROM credit_packages
             WHERE is_active = true
             ORDER BY display_order ASC, price ASC`
        );
        
        res.json({
            success: true,
            data: {
                packages: packages.map(pkg => ({
                    packageId: pkg.package_id,
                    name: pkg.name,
                    credits: pkg.credits,
                    bonus: pkg.bonus,
                    price: pkg.price,
                    currency: pkg.currency
                }))
            }
        });
        
    } catch (error) {
        logger.error('크레딧 패키지 목록 조회 오류', {
            requestId: req.requestId,
            error: error.message
        });
        next(error);
    }
});

/**
 * 결제 요청
 * POST /api/credits/payment
 */
router.post('/payment', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { packageId, paymentMethod, paymentInfo } = req.body;
        
        if (!packageId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'packageId와 paymentMethod는 필수입니다.'
                }
            });
        }
        
        // 패키지 조회
        const [packages] = await db.execute(
            'SELECT * FROM credit_packages WHERE package_id = ? AND is_active = true',
            [packageId]
        );
        
        if (packages.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.NOT_FOUND.code,
                    message: '패키지를 찾을 수 없습니다.'
                }
            });
        }
        
        const pkg = packages[0];
        
        // TODO: 실제 결제 처리 (PG사 연동)
        // 여기서는 Mock 처리
        const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const totalCredits = pkg.credits + pkg.bonus;
        
        // 결제 레코드 생성
        await db.execute(
            `INSERT INTO payments 
             (payment_id, user_id, package_id, amount, currency, payment_method, 
              payment_status, credits, bonus_credits, total_credits, paid_at)
             VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, NOW())`,
            [paymentId, userId, packageId, pkg.price, pkg.currency, paymentMethod,
             pkg.credits, pkg.bonus, totalCredits]
        );
        
        // 크레딧 충전
        const [credits] = await db.execute(
            'SELECT balance FROM credits WHERE user_id = ?',
            [userId]
        );
        
        if (credits.length === 0) {
            await db.execute(
                'INSERT INTO credits (user_id, balance, free_balance, total_charged) VALUES (?, ?, 0, ?)',
                [userId, totalCredits, pkg.price]
            );
        } else {
            await db.execute(
                `UPDATE credits 
                 SET balance = balance + ?, total_charged = total_charged + ?, updated_at = NOW()
                 WHERE user_id = ?`,
                [totalCredits, pkg.price, userId]
            );
        }
        
        // 크레딧 사용 내역 저장
        const [newCredits] = await db.execute(
            'SELECT balance FROM credits WHERE user_id = ?',
            [userId]
        );
        
        await db.execute(
            `INSERT INTO credit_history 
             (user_id, type, amount, balance_after, description, payment_id)
             VALUES (?, 'charge', ?, ?, ?, ?)`,
            [userId, totalCredits, newCredits[0].balance, `${pkg.name} 패키지 충전`, paymentId]
        );
        
        logger.logEvent('PAYMENT_SUCCESS', {
            requestId: req.requestId,
            userId,
            paymentId,
            packageId,
            amount: pkg.price,
            credits: totalCredits
        });
        
        res.json({
            success: true,
            message: '결제가 완료되었습니다.',
            data: {
                paymentId: paymentId,
                packageId: packageId,
                credits: pkg.credits,
                bonus: pkg.bonus,
                totalCredits: totalCredits,
                amount: pkg.price,
                currency: pkg.currency,
                paidAt: new Date().toISOString(),
                newBalance: newCredits[0].balance
            }
        });
        
    } catch (error) {
        logger.error('결제 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 크레딧 사용 내역 조회
 * GET /api/credits/history
 */
router.get('/history', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type || 'all';
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let whereConditions = ['user_id = ?'];
        const queryParams = [userId];
        
        if (type !== 'all') {
            whereConditions.push('type = ?');
            queryParams.push(type);
        }
        
        if (startDate) {
            whereConditions.push('created_at >= ?');
            queryParams.push(startDate);
        }
        
        if (endDate) {
            whereConditions.push('created_at <= ?');
            queryParams.push(endDate);
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        // 전체 개수 조회
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM credit_history ${whereClause}`,
            queryParams
        );
        const total = countRows[0].total;
        
        // 목록 조회
        const [history] = await db.execute(
            `SELECT history_id, type, amount, balance_after, description, 
                    job_id, payment_id, reservation_id, created_at
             FROM credit_history 
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, (page - 1) * limit]
        );
        
        res.json({
            success: true,
            data: {
                history: history.map(item => ({
                    historyId: `history_${item.history_id}`,
                    type: item.type,
                    description: item.description,
                    amount: item.amount,
                    balance: item.balance_after,
                    createdAt: item.created_at
                })),
                pagination: {
                    page: page,
                    limit: limit,
                    total: total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        logger.error('크레딧 사용 내역 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user.userId
        });
        next(error);
    }
});

module.exports = router;


