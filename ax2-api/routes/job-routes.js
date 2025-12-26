/**
 * Job 관련 라우트
 * 재시도, 재처리 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const { AppError, ERROR_CODES } = require('../middleware/error-handler');
const logger = require('../utils/logger');
const creditService = require('../api/credit-service');
const { v4: uuidv4 } = require('uuid');

/**
 * 작업 생성
 * POST /api/jobs
 */
router.post('/', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { videoId, originalLanguage, targetLanguages, speakers } = req.body;
        
        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'videoId는 필수입니다.'
                }
            });
        }
        
        // videoId에서 jobId 추출
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            'SELECT id, status, size, user_id FROM video_jobs WHERE id = ? AND user_id = ?',
            [jobId, userId]
        );
        
        if (jobs.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND.code,
                    message: '비디오를 찾을 수 없습니다.'
                }
            });
        }
        
        const job = jobs[0];
        
        if (job.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: '완료된 비디오만 자막 생성 작업을 생성할 수 있습니다.'
                }
            });
        }
        
        // 크레딧 계산 (영상 길이 추정 - 실제로는 비디오 메타데이터에서 가져와야 함)
        const estimatedDuration = 60; // TODO: 실제 비디오 길이 가져오기
        const translationCount = targetLanguages ? targetLanguages.length : 0;
        const requiredCredits = creditService.calculateRequiredCredits(estimatedDuration, translationCount);
        
        // 크레딧 잔액 확인
        const balance = await creditService.getCreditBalance(db, userId);
        
        if (balance.balance < requiredCredits) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_CREDITS',
                    message: '크레딧이 부족합니다.',
                    details: {
                        required: requiredCredits,
                        balance: balance.balance
                    }
                }
            });
        }
        
        // 크레딧 예약
        const reservationResult = await creditService.reserveCredits(
            db,
            jobId,
            requiredCredits,
            userId
        );
        
        if (!reservationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_CREDITS',
                    message: reservationResult.message || '크레딧이 부족합니다.'
                }
            });
        }
        
        // 새 Job 생성 (재처리용)
        const newJobId = uuidv4();
        await db.execute(
            `INSERT INTO video_jobs (id, user_id, title, original_name, video_path, size, status, progress)
             VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)`,
            [newJobId, userId, job.title, job.original_name, job.video_path, job.size]
        );
        
        logger.logEvent('JOB_CREATED', {
            requestId: req.requestId,
            userId,
            jobId: newJobId,
            videoId: jobId,
            requiredCredits
        });
        
        res.status(201).json({
            success: true,
            message: '작업이 생성되었습니다.',
            data: {
                jobId: newJobId,
                videoId: videoId,
                status: 'pending',
                originalLanguage: originalLanguage || 'auto',
                targetLanguages: targetLanguages || [],
                requiredCredits: requiredCredits,
                createdAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('작업 생성 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 작업 목록 조회
 * GET /api/jobs
 */
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || 'all';
        const videoId = req.query.videoId;
        
        let whereConditions = ['user_id = ?'];
        const queryParams = [userId];
        
        if (status !== 'all') {
            if (status === 'processing') {
                whereConditions.push("(status = 'processing' OR status = 'queued')");
            } else {
                whereConditions.push('status = ?');
                queryParams.push(status);
            }
        }
        
        if (videoId) {
            const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
            whereConditions.push('id = ?');
            queryParams.push(jobId);
        }
        
        const whereClause = 'WHERE ' + whereConditions.join(' AND ');
        
        // 전체 개수 조회
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM video_jobs ${whereClause}`,
            queryParams
        );
        const total = countRows[0].total;
        
        // 목록 조회
        const [rows] = await db.execute(
            `SELECT id, title, original_name, status, progress, created_at, completed_at
             FROM video_jobs 
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, (page - 1) * limit]
        );
        
        res.json({
            success: true,
            data: {
                jobs: rows.map(job => ({
                    jobId: job.id,
                    videoId: `video_${job.id}`,
                    videoTitle: job.title,
                    status: job.status,
                    progress: job.progress || 0,
                    createdAt: job.created_at,
                    completedAt: job.completed_at
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
        logger.error('작업 목록 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 작업 취소
 * POST /api/jobs/:id/cancel
 */
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const userId = req.user.userId;
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            'SELECT id, status, user_id FROM video_jobs WHERE id = ? AND user_id = ?',
            [jobId, userId]
        );
        
        if (jobs.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND.code,
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        const job = jobs[0];
        
        // 취소 가능한 상태 확인
        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'deleted') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'JOB_CANNOT_BE_CANCELLED',
                    message: '완료되었거나 취소할 수 없는 작업입니다.'
                }
            });
        }
        
        // 크레딧 환불 (예약된 크레딧이 있는 경우)
        const [reservations] = await db.execute(
            'SELECT reservation_id, amount FROM credit_reservations WHERE job_id = ? AND status = ?',
            [jobId, 'reserved']
        );
        
        let refundedCredits = 0;
        if (reservations.length > 0) {
            const reservation = reservations[0];
            const refundResult = await creditService.refundCredits(
                db,
                reservation.reservation_id,
                jobId,
                '작업 취소로 인한 환불'
            );
            
            if (refundResult.success) {
                refundedCredits = refundResult.refundAmount;
            }
        }
        
        // Job 상태를 cancelled로 변경
        await db.execute(
            `UPDATE video_jobs 
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = ?`,
            [jobId]
        );
        
        logger.logEvent('JOB_CANCELLED', {
            requestId: req.requestId,
            userId,
            jobId,
            refundedCredits
        });
        
        res.json({
            success: true,
            message: '작업이 취소되었습니다.',
            data: {
                jobId: jobId,
                status: 'cancelled',
                refundedCredits: refundedCredits
            }
        });
        
    } catch (error) {
        logger.error('작업 취소 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId,
            jobId: req.params.id
        });
        next(error);
    }
});

/**
 * Job 재시도
 * POST /api/jobs/:id/retry
 * - status가 'failed'인 Job만 재시도 가능
 */
router.post('/:id/retry', authenticateToken, async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const userId = req.user?.userId || null;
        
        // Job 조회 및 권한 확인
        let query = `SELECT id, status, error_message, retry_count, user_id 
                     FROM video_jobs 
                     WHERE id = ?`;
        const queryParams = [jobId];
        
        if (req.user) {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(userId);
        } else {
            query += ' AND user_id IS NULL';
        }
        
        const [rows] = await db.execute(query, queryParams);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND.code,
                    message: '작업을 찾을 수 없거나 접근 권한이 없습니다.'
                }
            });
        }
        
        const job = rows[0];
        
        // 실패한 Job만 재시도 가능
        if (job.status !== 'failed') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: '실패한 작업만 재시도할 수 있습니다.'
                }
            });
        }
        
        // 재시도 횟수 제한 (최대 3회)
        const maxRetries = 3;
        const currentRetries = job.retry_count || 0;
        
        if (currentRetries >= maxRetries) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MAX_RETRIES_EXCEEDED',
                    message: `최대 재시도 횟수(${maxRetries}회)를 초과했습니다.`
                }
            });
        }
        
        // 재시도 처리: status를 queued로 변경
        await db.execute(
            `UPDATE video_jobs 
             SET status = 'queued',
                 progress = 0,
                 error_message = NULL,
                 retry_count = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [currentRetries + 1, jobId]
        );
        
        logger.logEvent('JOB_RETRY', {
            requestId: req.requestId,
            userId,
            jobId,
            retryCount: currentRetries + 1
        });
        
        res.json({
            success: true,
            message: '작업이 재시도 대기열에 추가되었습니다.',
            data: {
                jobId,
                retryCount: currentRetries + 1
            }
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Job 재처리
 * POST /api/jobs/:id/reprocess
 * - completed 상태의 Job을 다시 처리
 */
router.post('/:id/reprocess', authenticateToken, async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const userId = req.user?.userId || null;
        
        // Job 조회 및 권한 확인
        let query = `SELECT id, status, user_id 
                     FROM video_jobs 
                     WHERE id = ?`;
        const queryParams = [jobId];
        
        if (req.user) {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(userId);
        } else {
            query += ' AND user_id IS NULL';
        }
        
        const [rows] = await db.execute(query, queryParams);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND.code,
                    message: '작업을 찾을 수 없거나 접근 권한이 없습니다.'
                }
            });
        }
        
        const job = rows[0];
        
        // completed 상태만 재처리 가능
        if (job.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: '완료된 작업만 재처리할 수 있습니다.'
                }
            });
        }
        
        // 재처리: status를 queued로 변경
        await db.execute(
            `UPDATE video_jobs 
             SET status = 'queued',
                 progress = 0,
                 completed_at = NULL,
                 expires_at = NULL,
                 updated_at = NOW()
             WHERE id = ?`,
            [jobId]
        );
        
        logger.logEvent('JOB_REPROCESS', {
            requestId: req.requestId,
            userId,
            jobId
        });
        
        res.json({
            success: true,
            message: '작업이 재처리 대기열에 추가되었습니다.',
            data: {
                jobId
            }
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;


