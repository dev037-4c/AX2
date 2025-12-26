/**
 * 크레딧 라우트
 * 크레딧 조회, 계산, 충전 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db/index');
const creditService = require('../api/credit-service');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// 모든 라우트에 인증 미들웨어 적용 (선택적)
router.use(authenticateToken);

/**
 * 크레딧 잔액 조회
 * GET /api/v1/credits/balance
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
        logger.error('크레딧 잔액 조회 오류', { error: error.message, userId: req.user?.userId });
        next(error);
    }
});

/**
 * 크레딧 계산
 * POST /api/v1/credits/calculate
 */
router.post('/calculate', (req, res) => {
    try {
        const { durationSeconds, translationLanguageCount } = req.body;
        
        if (!durationSeconds) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'durationSeconds는 필수입니다.'
                }
            });
        }
        
        const requiredCredits = creditService.calculateRequiredCredits(
            parseFloat(durationSeconds),
            parseInt(translationLanguageCount) || 0
        );
        
        res.json({
            success: true,
            data: {
                durationSeconds: parseFloat(durationSeconds),
                durationMinutes: Math.ceil(durationSeconds / 60),
                translationLanguageCount: parseInt(translationLanguageCount) || 0,
                baseCredits: Math.ceil(durationSeconds / 60) * 10,
                translationCredits: Math.ceil(durationSeconds / 60) * 5 * (parseInt(translationLanguageCount) || 0),
                totalCredits: requiredCredits
            }
        });
        
    } catch (error) {
        logger.error('크레딧 계산 오류', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '크레딧 계산 중 오류가 발생했습니다.'
            }
        });
    }
});

/**
 * 크레딧 사용 내역 조회
 * GET /api/v1/credits/history
 */
router.get('/history', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, type = 'all', startDate, endDate } = req.query;
        
        let query = `
            SELECT history_id, type, amount, balance_after, description, 
                   job_id, payment_id, reservation_id, created_at
            FROM credit_history
            WHERE user_id = $1
        `;
        const params = [userId];
        let paramIndex = 2;
        
        if (type !== 'all') {
            query += ` AND type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        
        if (startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
        
        const result = await db.query(query, params);
        
        // 총 개수 조회
        const countQuery = `
            SELECT COUNT(*) as total
            FROM credit_history
            WHERE user_id = $1
        `;
        const countParams = [userId];
        if (type !== 'all') {
            countQuery += ` AND type = $2`;
            countParams.push(type);
        }
        
        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        
        res.json({
            success: true,
            data: {
                history: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
        
    } catch (error) {
        logger.error('크레딧 사용 내역 조회 오류', { error: error.message, userId: req.user.userId });
        next(error);
    }
});

module.exports = router;



