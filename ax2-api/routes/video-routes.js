/**
 * 비디오 관련 라우트
 * 비디오 목록, 상세, 다운로드 URL 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../middleware/error-handler');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 모든 라우트에 인증 미들웨어 적용 (선택적)
router.use(authenticateToken);

/**
 * 비디오 목록 조회
 * GET /api/videos
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.userId || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sort = req.query.sort || 'createdAt';
        const order = req.query.order || 'desc';
        const status = req.query.status || 'all';
        const search = req.query.search;
        
        let whereConditions = ["status != 'deleted'"];
        const queryParams = [];
        
        // 사용자별 필터링
        if (userId) {
            whereConditions.push('user_id = ?');
            queryParams.push(userId);
        } else {
            whereConditions.push('user_id IS NULL');
        }
        
        // 상태 필터링
        if (status !== 'all') {
            if (status === 'processing') {
                whereConditions.push("(status = 'processing' OR status = 'queued')");
            } else {
                whereConditions.push('status = ?');
                queryParams.push(status);
            }
        }
        
        // 검색
        if (search) {
            whereConditions.push("(original_name LIKE ? OR title LIKE ?)");
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
        }
        
        const whereClause = 'WHERE ' + whereConditions.join(' AND ');
        
        // 정렬
        let orderBy = 'created_at DESC';
        if (sort === 'title') {
            orderBy = `title ${order.toUpperCase()}`;
        } else if (sort === 'duration') {
            orderBy = `duration ${order.toUpperCase()}`;
        } else {
            orderBy = `created_at ${order.toUpperCase()}`;
        }
        
        // 전체 개수 조회
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM video_jobs ${whereClause}`,
            queryParams
        );
        const total = countRows[0].total;
        
        // 목록 조회
        const [rows] = await db.execute(
            `SELECT id, title, original_name, video_path, status, progress,
                    created_at, completed_at, expires_at
             FROM video_jobs 
             ${whereClause}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, (page - 1) * limit]
        );
        
        // 파일 크기 조회
        const videos = await Promise.all(rows.map(async (job) => {
            let fileSize = 0;
            try {
                if (fs.existsSync(job.video_path)) {
                    const stats = fs.statSync(job.video_path);
                    fileSize = stats.size;
                }
            } catch (error) {
                // 파일이 없어도 계속 진행
            }
            
            return {
                videoId: `video_${job.id}`,
                title: job.title || job.original_name.replace(/\.[^/.]+$/, '') || '영상',
                fileName: job.original_name,
                fileSize: fileSize,
                duration: 0, // TODO: 비디오 메타데이터에서 가져오기
                thumbnailUrl: null, // TODO: 썸네일 생성 시 추가
                status: job.status,
                hasSubtitles: job.status === 'completed',
                createdAt: job.created_at,
                expiresAt: job.expires_at
            };
        }));
        
        res.json({
            success: true,
            data: {
                videos: videos,
                pagination: {
                    page: page,
                    limit: limit,
                    total: total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        logger.error('비디오 목록 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.userId
        });
        next(error);
    }
});

/**
 * 비디오 상세 조회
 * GET /api/videos/:videoId
 */
router.get('/:videoId', async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회 및 권한 확인
        let query = `SELECT id, title, original_name, video_path, status, progress,
                            created_at, completed_at, expires_at, user_id
                     FROM video_jobs WHERE id = ?`;
        const queryParams = [jobId];
        
        if (req.user) {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(req.user.userId);
        } else {
            query += ' AND user_id IS NULL';
        }
        
        const [jobs] = await db.execute(query, queryParams);
        
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
        
        // 파일 크기 조회
        let fileSize = 0;
        try {
            if (fs.existsSync(job.video_path)) {
                const stats = fs.statSync(job.video_path);
                fileSize = stats.size;
            }
        } catch (error) {
            // 파일이 없어도 계속 진행
        }
        
        // 자막 언어 정보 (JSON 파일에서)
        let originalLanguage = 'ko';
        let translatedLanguages = [];
        
        if (job.status === 'completed') {
            try {
                const resultsDir = path.join(__dirname, '..', process.env.RESULTS_DIR || 'results');
                const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
                if (fs.existsSync(jsonFilePath)) {
                    const subtitlesData = fs.readFileSync(jsonFilePath, 'utf8');
                    const subtitles = JSON.parse(subtitlesData);
                    if (subtitles.length > 0) {
                        const firstSegment = subtitles[0];
                        // 언어 코드 추출 (ko, en 등)
                        const languages = Object.keys(firstSegment).filter(key => 
                            key !== 'id' && key !== 'startTime' && key !== 'endTime' && key !== 'speaker' && key !== 'text'
                        );
                        originalLanguage = languages[0] || 'ko';
                        translatedLanguages = languages.slice(1);
                    }
                }
            } catch (error) {
                // 자막 파일이 없어도 계속 진행
            }
        }
        
        res.json({
            success: true,
            data: {
                videoId: videoId,
                title: job.title,
                fileName: job.original_name,
                fileSize: fileSize,
                fileType: path.extname(job.original_name).substring(1),
                duration: 0, // TODO: 비디오 메타데이터에서 가져오기
                uploadUrl: null, // TODO: 실제 스토리지 URL
                thumbnailUrl: null, // TODO: 썸네일 URL
                status: job.status,
                hasSubtitles: job.status === 'completed',
                originalLanguage: originalLanguage,
                translatedLanguages: translatedLanguages,
                createdAt: job.created_at,
                expiresAt: job.expires_at
            }
        });
        
    } catch (error) {
        logger.error('비디오 상세 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

/**
 * 비디오 삭제
 * DELETE /api/videos/:videoId
 */
router.delete('/:videoId', async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회 및 권한 확인
        let query = `SELECT id, video_path, user_id FROM video_jobs WHERE id = ?`;
        const queryParams = [jobId];
        
        if (req.user) {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(req.user.userId);
        } else {
            query += ' AND user_id IS NULL';
        }
        
        const [jobs] = await db.execute(query, queryParams);
        
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
        
        // 파일 삭제
        if (job.video_path && fs.existsSync(job.video_path)) {
            try {
                fs.unlinkSync(job.video_path);
            } catch (fileError) {
                logger.error('파일 삭제 오류', {
                    requestId: req.requestId,
                    jobId,
                    path: job.video_path,
                    error: fileError.message
                });
            }
        }
        
        // 결과 파일 삭제
        const resultsDir = path.join(__dirname, '..', process.env.RESULTS_DIR || 'results');
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        if (fs.existsSync(jsonFilePath)) {
            try {
                fs.unlinkSync(jsonFilePath);
            } catch (fileError) {
                logger.error('결과 파일 삭제 오류', {
                    requestId: req.requestId,
                    jobId,
                    path: jsonFilePath,
                    error: fileError.message
                });
            }
        }
        
        // DB에서 삭제
        await db.execute('DELETE FROM video_jobs WHERE id = ?', [jobId]);
        
        logger.logEvent('VIDEO_DELETED', {
            requestId: req.requestId,
            userId: req.user?.userId,
            jobId
        });
        
        res.json({
            success: true,
            message: '비디오가 삭제되었습니다.'
        });
        
    } catch (error) {
        logger.error('비디오 삭제 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

/**
 * 비디오 다운로드 URL 생성
 * POST /api/videos/:videoId/download-url
 */
router.post('/:videoId/download-url', requireAuth, async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            `SELECT id, video_path, user_id FROM video_jobs WHERE id = ? AND user_id = ?`,
            [jobId, req.user.userId]
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
        
        // 임시 토큰 생성 (1시간 유효)
        const downloadToken = uuidv4();
        const expiresAt = new Date(Date.now() + 3600 * 1000);
        
        // TODO: 실제로는 Redis나 DB에 토큰 저장하고 검증
        // 여기서는 간단히 파일 경로 기반 URL 생성
        
        // 실제 다운로드 URL 생성 (프로덕션에서는 실제 스토리지 URL)
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const downloadUrl = `${baseUrl}/api/videos/${videoId}/download?token=${downloadToken}`;
        
        res.json({
            success: true,
            data: {
                downloadUrl: downloadUrl,
                expiresIn: 3600
            }
        });
        
    } catch (error) {
        logger.error('다운로드 URL 생성 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

/**
 * 업로드 진행률 조회
 * GET /api/videos/:videoId/upload-progress
 */
router.get('/:videoId/upload-progress', requireAuth, async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회
        const [jobs] = await db.execute(
            `SELECT id, status, size, user_id FROM video_jobs WHERE id = ? AND user_id = ?`,
            [jobId, req.user.userId]
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
        
        // 파일 크기 확인
        let uploadedBytes = 0;
        let totalBytes = job.size || 0;
        
        try {
            if (fs.existsSync(job.video_path)) {
                const stats = fs.statSync(job.video_path);
                uploadedBytes = stats.size;
                totalBytes = totalBytes || stats.size;
            }
        } catch (error) {
            // 파일이 없어도 계속 진행
        }
        
        const progress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
        const status = job.status === 'queued' || job.status === 'processing' ? 'uploading' : 'completed';
        
        res.json({
            success: true,
            data: {
                videoId: videoId,
                progress: progress,
                status: status,
                uploadedBytes: uploadedBytes,
                totalBytes: totalBytes
            }
        });
        
    } catch (error) {
        logger.error('업로드 진행률 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

module.exports = router;


