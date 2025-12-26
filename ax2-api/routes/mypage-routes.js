/**
 * 마이페이지 라우트
 * 통계, 작업 목록 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../middleware/error-handler');
const fs = require('fs');
const path = require('path');

// 모든 라우트에 인증 필수
router.use(requireAuth);

/**
 * 마이페이지 통계 조회
 * GET /api/mypage/stats
 */
router.get('/stats', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // 크레딧 잔액
        const [credits] = await db.execute(
            'SELECT balance, free_balance, total_charged FROM credits WHERE user_id = ?',
            [userId]
        );
        const creditBalance = credits.length > 0 ? credits[0].balance : 0;
        
        // 비디오 통계
        const [videoStats] = await db.execute(
            `SELECT 
                COUNT(*) as total_videos,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_videos,
                SUM(CASE WHEN status IN ('processing', 'queued') THEN 1 ELSE 0 END) as processing_videos,
                COALESCE(SUM(size), 0) as total_size
             FROM video_jobs 
             WHERE user_id = ? AND status != 'deleted'`,
            [userId]
        );
        
        const stats = videoStats[0] || {
            total_videos: 0,
            completed_videos: 0,
            processing_videos: 0,
            total_size: 0
        };
        
        // 총 크레딧 사용량
        const [creditUsage] = await db.execute(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as total_used
             FROM credit_history
             WHERE user_id = ? AND type IN ('use', 'reservation')`,
            [userId]
        );
        
        // 월별 크레딧 사용량
        const [monthlyUsage] = await db.execute(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as monthly_used
             FROM credit_history
             WHERE user_id = ? AND type IN ('use', 'reservation')
             AND MONTH(created_at) = MONTH(NOW())
             AND YEAR(created_at) = YEAR(NOW())`,
            [userId]
        );
        
        // 스토리지 사용량 계산 (업로드된 파일 크기 합계)
        const storageUsedGB = (stats.total_size || 0) / (1024 * 1024 * 1024);
        const storageTotalGB = 5.0; // 기본 5GB (설정 가능)
        
        res.json({
            success: true,
            data: {
                creditBalance: creditBalance,
                totalVideos: parseInt(stats.total_videos) || 0,
                completedVideos: parseInt(stats.completed_videos) || 0,
                processingVideos: parseInt(stats.processing_videos) || 0,
                totalDuration: 0, // TODO: 비디오 길이 정보가 있으면 계산
                totalCreditsUsed: parseInt(creditUsage[0]?.total_used) || 0,
                monthlyCreditsUsed: parseInt(monthlyUsage[0]?.monthly_used) || 0,
                storageUsed: parseFloat(storageUsedGB.toFixed(2)),
                storageTotal: storageTotalGB
            }
        });
        
    } catch (error) {
        logger.error('마이페이지 통계 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user.userId
        });
        next(error);
    }
});

/**
 * 마이페이지 작업 목록 조회
 * GET /api/mypage/videos
 */
router.get('/videos', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filter = req.query.filter || 'all';
        const search = req.query.search;
        
        let whereConditions = ['user_id = ?', "status != 'deleted'"];
        const queryParams = [userId];
        
        // 필터링
        if (filter === 'processing') {
            whereConditions.push("(status = 'processing' OR status = 'queued')");
        } else if (filter === 'completed') {
            whereConditions.push("status = 'completed'");
        } else if (filter === 'expiring') {
            whereConditions.push("status = 'completed' AND expires_at IS NOT NULL AND expires_at > NOW() AND expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)");
        }
        
        // 검색
        if (search) {
            whereConditions.push("(original_name LIKE ? OR title LIKE ?)");
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
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
            `SELECT id, title, original_name, video_path, status, progress,
                    created_at, updated_at, completed_at, expires_at
             FROM video_jobs 
             ${whereClause}
             ORDER BY created_at DESC
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
                thumbnailUrl: null, // TODO: 썸네일 생성 시 추가
                duration: 0, // TODO: 비디오 메타데이터에서 가져오기
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
        logger.error('마이페이지 작업 목록 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user.userId
        });
        next(error);
    }
});

module.exports = router;


