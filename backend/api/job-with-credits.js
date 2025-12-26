/**
 * 작업 생성 API와 크레딧 서비스 통합 예제
 * 실제 사용 시나리오를 보여주는 예제 코드
 */

const creditService = require('./credit-service');
const { createJob, processJob } = require('./caption-generation');

/**
 * 크레딧을 포함한 작업 생성
 * @param {Object} db - 데이터베이스 연결
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
async function createJobWithCredits(db, req, res) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { videoId, originalLanguage, targetLanguages, speakers, duration } = req.body;
        const userId = req.user?.userId || null; // 인증 미들웨어에서 설정
        const deviceId = req.headers['x-device-id'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        // 1. 크레딧 계산
        const translationLanguageCount = targetLanguages ? targetLanguages.length : 0;
        const requiredCredits = creditService.calculateRequiredCredits(
            parseFloat(duration),
            translationLanguageCount
        );
        
        // 2. 크레딧 예약 (선차감)
        const reservation = await creditService.reserveCredits(
            db,
            null, // jobId는 아직 생성 전
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
        
        // 3. 작업 생성
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
        
        // 작업을 데이터베이스에 저장 (예시)
        await client.query(
            `INSERT INTO jobs (job_id, user_id, video_id, status, required_credits, reservation_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [jobId, userId, videoId, 'queued', requiredCredits, reservation.reservationId]
        );
        
        // 예약에 job_id 연결
        await client.query(
            `UPDATE credit_reservations SET job_id = $1 WHERE reservation_id = $2`,
            [jobId, reservation.reservationId]
        );
        
        await client.query('COMMIT');
        
        // 비동기로 작업 처리 시작
        setTimeout(() => {
            processJobWithCredits(db, jobId, reservation.reservationId);
        }, 1000);
        
        // 응답 반환
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
        console.error('작업 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 생성 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    } finally {
        client.release();
    }
}

/**
 * 크레딧을 포함한 작업 처리
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 * @param {string} reservationId - 예약 ID
 */
async function processJobWithCredits(db, jobId, reservationId) {
    try {
        // 작업 처리 시작
        // ... (기존 processJob 로직)
        
        // 작업이 성공적으로 완료된 경우
        // 크레딧 확정 차감
        await creditService.confirmDeduction(db, reservationId, jobId);
        
    } catch (error) {
        console.error(`작업 처리 오류 (${jobId}):`, error);
        
        // 작업 실패 시 크레딧 환불
        try {
            await creditService.refundCredits(
                db,
                reservationId,
                jobId,
                `작업 처리 실패: ${error.message}`,
                null // 전액 환불
            );
        } catch (refundError) {
            console.error('크레딧 환불 오류:', refundError);
        }
    }
}

/**
 * 작업 취소 및 크레딧 환불
 * @param {Object} db - 데이터베이스 연결
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
async function cancelJobWithRefund(db, req, res) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { jobId } = req.params;
        
        // 작업 조회
        const jobResult = await client.query(
            `SELECT job_id, status, reservation_id FROM jobs WHERE job_id = $1`,
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
                console.error('크레딧 환불 실패:', refundResult);
                // 환불 실패해도 작업 취소는 진행
            }
        }
        
        await client.query('COMMIT');
        
        res.status(200).json({
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
        console.error('작업 취소 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 취소 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    } finally {
        client.release();
    }
}

module.exports = {
    createJobWithCredits,
    processJobWithCredits,
    cancelJobWithRefund
};



