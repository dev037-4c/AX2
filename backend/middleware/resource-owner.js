/**
 * 리소스 소유자 확인 미들웨어
 * OWASP A01: Broken Access Control 대응
 * IDOR (Insecure Direct Object Reference) 취약점 방지
 */

const db = require('../db/index');
const securityLogger = require('../utils/security-logger');
const logger = require('../utils/logger');

/**
 * 비디오 소유자 확인 미들웨어
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
async function checkVideoOwner(req, res, next) {
    try {
        const { videoId } = req.params;
        const userId = req.user?.userId;

        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_VIDEO_ID',
                    message: '비디오 ID가 필요합니다.'
                }
            });
        }

        // 비디오 조회
        const videoResult = await db.query(
            'SELECT user_id FROM video_jobs WHERE job_id = $1',
            [videoId]
        );

        if (videoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'VIDEO_NOT_FOUND',
                    message: '비디오를 찾을 수 없습니다.'
                }
            });
        }

        const video = videoResult.rows[0];

        // 비로그인 사용자는 자신의 리소스만 접근 가능
        if (!userId) {
            // 비로그인 사용자의 경우 device_id 또는 ip_address로 확인
            const deviceId = req.headers['x-device-id'];
            const ipAddress = req.ip || req.connection.remoteAddress;
            
            // 비로그인 사용자는 접근 제한 (또는 device_id 기반 확인)
            if (!video.user_id) {
                // 비로그인 사용자가 생성한 비디오인 경우 device_id 확인 필요
                // 현재는 비로그인 사용자 접근 제한
                await securityLogger.logUnauthorizedAccess(
                    null,
                    'video',
                    videoId,
                    ipAddress,
                    req.get('user-agent')
                );
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: '이 비디오에 접근할 권한이 없습니다.'
                    }
                });
            }
        } else {
            // 로그인 사용자: 소유자 확인
            if (video.user_id !== userId) {
                await securityLogger.logUnauthorizedAccess(
                    userId,
                    'video',
                    videoId,
                    req.ip || req.connection.remoteAddress,
                    req.get('user-agent')
                );
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: '이 비디오에 접근할 권한이 없습니다.'
                    }
                });
            }
        }

        // 소유자 확인 완료
        req.video = video;
        next();

    } catch (error) {
        logger.error('비디오 소유자 확인 오류', {
            error: error.message,
            videoId: req.params.videoId,
            userId: req.user?.userId
        });
        next(error);
    }
}

/**
 * 작업 소유자 확인 미들웨어
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
async function checkJobOwner(req, res, next) {
    try {
        const { jobId } = req.params;
        const userId = req.user?.userId;

        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_JOB_ID',
                    message: '작업 ID가 필요합니다.'
                }
            });
        }

        // 작업 조회
        const jobResult = await db.query(
            'SELECT user_id FROM jobs WHERE job_id = $1',
            [jobId]
        );

        if (jobResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }

        const job = jobResult.rows[0];

        // 비로그인 사용자 접근 제한
        if (!userId) {
            const ipAddress = req.ip || req.connection.remoteAddress;
            await securityLogger.logUnauthorizedAccess(
                null,
                'job',
                jobId,
                ipAddress,
                req.get('user-agent')
            );
            return res.status(403).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: '이 작업에 접근할 권한이 없습니다.'
                }
            });
        }

        // 로그인 사용자: 소유자 확인
        if (job.user_id !== userId) {
            await securityLogger.logUnauthorizedAccess(
                userId,
                'job',
                jobId,
                req.ip || req.connection.remoteAddress,
                req.get('user-agent')
            );
            return res.status(403).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: '이 작업에 접근할 권한이 없습니다.'
                }
            });
        }

        // 소유자 확인 완료
        req.job = job;
        next();

    } catch (error) {
        logger.error('작업 소유자 확인 오류', {
            error: error.message,
            jobId: req.params.jobId,
            userId: req.user?.userId
        });
        next(error);
    }
}

/**
 * 사용자 리소스 확인 미들웨어 (자신의 리소스만 접근)
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 */
async function checkUserResource(req, res, next) {
    try {
        const { userId: paramUserId } = req.params;
        const currentUserId = req.user?.userId;

        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: '인증이 필요합니다.'
                }
            });
        }

        if (paramUserId !== currentUserId) {
            await securityLogger.logUnauthorizedAccess(
                currentUserId,
                'user',
                paramUserId,
                req.ip || req.connection.remoteAddress,
                req.get('user-agent')
            );
            return res.status(403).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: '다른 사용자의 리소스에 접근할 수 없습니다.'
                }
            });
        }

        next();

    } catch (error) {
        logger.error('사용자 리소스 확인 오류', {
            error: error.message,
            paramUserId: req.params.userId,
            currentUserId: req.user?.userId
        });
        next(error);
    }
}

module.exports = {
    checkVideoOwner,
    checkJobOwner,
    checkUserResource
};


