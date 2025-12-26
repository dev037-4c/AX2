/**
 * 작업 라우트
 * 자막 생성 작업 관리 (크레딧 통합)
 */

const express = require('express');
const router = express.Router();
const db = require('../db/index');
const captionGeneration = require('../api/caption-generation');
const creditService = require('../api/credit-service');
const videoUpload = require('../api/video-upload');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// 모든 라우트에 인증 미들웨어 적용 (선택적)
router.use(authenticateToken);

/**
 * 작업 생성 (크레딧 예약 포함)
 * POST /api/v1/jobs
 */
router.post('/', async (req, res, next) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { videoId, originalLanguage, targetLanguages, speakers, duration } = req.body;
        const userId = req.user?.userId || null;
        const deviceId = req.headers['x-device-id'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        // 필수 파라미터 검증
        if (!videoId) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_VIDEO_ID',
                    message: 'videoId는 필수입니다.'
                }
            });
        }
        
        // 비디오 존재 확인
        const videoResult = await client.query(
            'SELECT job_id, status, file_path FROM video_jobs WHERE job_id = $1',
            [videoId]
        );
        
        if (videoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: {
                    code: 'VIDEO_NOT_FOUND',
                    message: '비디오를 찾을 수 없습니다.'
                }
            });
        }
        
        const video = videoResult.rows[0];
        
        if (video.status !== 'uploaded') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_VIDEO_STATUS',
                    message: '업로드된 비디오만 작업을 생성할 수 있습니다.'
                }
            });
        }
        
        // 크레딧 계산
        const translationLanguageCount = targetLanguages ? targetLanguages.length : 0;
        const requiredCredits = creditService.calculateRequiredCredits(
            parseFloat(duration) || 0,
            translationLanguageCount
        );
        
        // 크레딧 예약
        const reservation = await creditService.reserveCredits(
            db,
            null, // jobId는 아직 없음
            requiredCredits,
            userId,
            deviceId,
            ipAddress
        );
        
        if (!reservation.success) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: reservation.error,
                    message: reservation.message,
                    details: {
                        required: requiredCredits,
                        balance: reservation.balance
                    }
                }
            });
        }
        
        // 작업 생성
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const job = {
            jobId,
            videoId,
            reservationId: reservation.reservationId,
            status: 'queued',
            originalLanguage: originalLanguage || 'auto',
            targetLanguages: targetLanguages || [],
            speakers: parseInt(speakers) || 1,
            duration: parseFloat(duration) || 0,
            requiredCredits: requiredCredits,
            progress: 0,
            createdAt: new Date().toISOString()
        };
        
        // 작업을 데이터베이스에 저장
        await client.query(
            `INSERT INTO jobs 
             (job_id, user_id, video_id, status, original_language, required_credits, 
              reservation_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [
                jobId,
                userId,
                videoId,
                'queued',
                originalLanguage || 'auto',
                requiredCredits,
                reservation.reservationId
            ]
        );
        
        // 예약에 job_id 연결
        await client.query(
            `UPDATE credit_reservations SET job_id = $1 WHERE reservation_id = $2`,
            [jobId, reservation.reservationId]
        );
        
        // 비디오 상태를 processing으로 변경
        await videoUpload.startProcessing(db, videoId);
        
        await client.query('COMMIT');
        
        // 비동기로 작업 처리 시작
        setTimeout(() => {
            processJobWithCredits(db, jobId, reservation.reservationId, videoId);
        }, 1000);
        
        logger.info('작업 생성 성공', { jobId, videoId, userId });
        
        res.status(201).json({
            success: true,
            message: '작업이 생성되었습니다.',
            data: {
                jobId: job.jobId,
                videoId: job.videoId,
                status: job.status,
                requiredCredits: job.requiredCredits,
                reservationId: reservation.reservationId,
                balance: reservation.balance,
                createdAt: job.createdAt
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('작업 생성 오류', { error: error.message, videoId: req.body.videoId });
        next(error);
    } finally {
        client.release();
    }
});

/**
 * 작업 조회
 * GET /api/v1/jobs/:jobId
 */
const { checkJobOwner } = require('../middleware/resource-owner');

router.get('/:jobId', checkJobOwner, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const job = await captionGeneration.getJob(req, res);
        // getJob이 이미 응답을 보내므로 여기서는 next()만 호출
    } catch (error) {
        next(error);
    }
});

/**
 * 작업 목록 조회
 * GET /api/v1/jobs
 * 로그인 사용자: 자신의 작업만 조회
 * 비로그인 사용자: 접근 제한
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        
        // 비로그인 사용자는 접근 제한
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: '작업 목록 조회를 위해서는 로그인이 필요합니다.'
                }
            });
        }
        
        // 사용자 ID를 쿼리 파라미터에 추가하여 자신의 작업만 조회
        req.query.userId = userId;
        
        await captionGeneration.getJobs(req, res);
    } catch (error) {
        next(error);
    }
});

/**
 * 작업 취소 (크레딧 환불 포함)
 * POST /api/v1/jobs/:jobId/cancel
 */
router.post('/:jobId/cancel', checkJobOwner, async (req, res, next) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { jobId } = req.params;
        
        // 작업 조회
        const jobResult = await client.query(
            `SELECT job_id, status, reservation_id, video_id FROM jobs WHERE job_id = $1`,
            [jobId]
        );
        
        if (jobResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        const job = jobResult.rows[0];
        
        // 완료되거나 실패한 작업은 취소 불가
        if (job.status === 'completed' || job.status === 'failed') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'JOB_CANNOT_BE_CANCELLED',
                    message: '완료되었거나 취소할 수 없는 작업입니다.'
                }
            });
        }
        
        // 작업 상태를 취소로 변경
        await client.query(
            `UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE job_id = $1`,
            [jobId]
        );
        
        // 크레딧 환불
        if (job.reservation_id) {
            const refundResult = await creditService.refundCredits(
                db,
                job.reservation_id,
                jobId,
                '사용자 요청에 의한 작업 취소',
                null // 전액 환불
            );
            
            if (!refundResult.success) {
                logger.warn('크레딧 환불 실패', { jobId, reservationId: job.reservation_id });
            }
        }
        
        await client.query('COMMIT');
        
        logger.info('작업 취소 성공', { jobId });
        
        res.json({
            success: true,
            message: '작업이 취소되었습니다.',
            data: {
                jobId: job.jobId,
                status: 'cancelled',
                refunded: job.reservation_id ? true : false
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('작업 취소 오류', { error: error.message, jobId: req.params.jobId });
        next(error);
    } finally {
        client.release();
    }
});

/**
 * 작업 처리 (크레딧 통합)
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 * @param {string} reservationId - 예약 ID
 * @param {string} videoId - 비디오 ID
 */
async function processJobWithCredits(db, jobId, reservationId, videoId) {
    try {
        // 작업 처리 시작
        await videoUpload.startProcessing(db, videoId);
        
        // 자막 생성 처리 (Mock)
        await captionGeneration.processJob(jobId);
        
        // 작업 완료 처리
        await videoUpload.completeProcessing(db, videoId);
        
        // 크레딧 확정 차감
        await creditService.confirmDeduction(db, reservationId, jobId);
        
        logger.info('작업 처리 완료', { jobId, videoId });
        
    } catch (error) {
        logger.error('작업 처리 오류', { error: error.message, jobId, videoId });
        
        // 작업 실패 처리
        await videoUpload.failProcessing(db, videoId, error.message);
        
        // 크레딧 환불
        try {
            await creditService.refundCredits(
                db,
                reservationId,
                jobId,
                `작업 처리 실패: ${error.message}`,
                null
            );
        } catch (refundError) {
            logger.error('크레딧 환불 오류', { error: refundError.message, jobId });
        }
    }
}

module.exports = router;



