/**
 * 영상 업로드 라우트
 */

const express = require('express');
const router = express.Router();
const videoUpload = require('../api/video-upload');
const db = require('../db/index');
const { checkVideoOwner } = require('../middleware/resource-owner');

/**
 * 영상 업로드
 * POST /api/v1/videos/upload
 */
router.post('/upload', videoUpload.upload, async (req, res) => {
    await videoUpload.handleVideoUpload(db, req, res);
});

/**
 * 작업 정보 조회
 * GET /api/v1/videos/jobs/:jobId
 */
router.get('/jobs/:jobId', checkVideoOwner, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await videoUpload.getJobInfo(db, jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        res.json({
            success: true,
            data: job
        });
    } catch (error) {
        console.error('작업 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '작업 정보 조회 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    }
});

/**
 * 파일 다운로드 URL 생성
 * GET /api/v1/videos/jobs/:jobId/download
 */
router.get('/jobs/:jobId/download', checkVideoOwner, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await videoUpload.getJobInfo(db, jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        if (job.status === 'deleted') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'FILE_DELETED',
                    message: '파일이 삭제되었습니다.'
                }
            });
        }
        
        // 다운로드 URL 생성 (임시 URL, 1시간 유효)
        const downloadUrl = await videoUpload.storageAdapter.getSignedUrl(
            job.file_path,
            3600
        );
        
        res.json({
            success: true,
            data: {
                downloadUrl: downloadUrl,
                expiresIn: 3600,
                fileName: job.file_name
            }
        });
    } catch (error) {
        console.error('다운로드 URL 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '다운로드 URL 생성 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    }
});

module.exports = router;



