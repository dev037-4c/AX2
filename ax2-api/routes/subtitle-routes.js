/**
 * 자막 편집 라우트
 * 자막 수정, 분할, 병합 등
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../middleware/error-handler');
const path = require('path');
const fs = require('fs');

// 모든 라우트에 인증 미들웨어 적용
router.use(requireAuth);

/**
 * 자막 조회
 * GET /api/videos/:videoId/subtitles
 */
router.get('/:videoId/subtitles', async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const language = req.query.language || 'ko';
        const format = req.query.format || 'json';
        
        // videoId에서 jobId 추출 (video_ 접두사 제거)
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            `SELECT id, status, user_id FROM video_jobs WHERE id = ?`,
            [jobId]
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
        
        // 권한 확인
        if (job.user_id && job.user_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: ERROR_CODES.FORBIDDEN.code,
                    message: '접근 권한이 없습니다.'
                }
            });
        }
        
        if (job.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'JOB_NOT_COMPLETED',
                    message: '작업이 아직 완료되지 않았습니다.'
                }
            });
        }
        
        // 자막 데이터 로드 (JSON 파일에서)
        const resultsDir = path.join(__dirname, '..', process.env.RESULTS_DIR || 'results');
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBTITLES_NOT_FOUND',
                    message: '자막 데이터를 찾을 수 없습니다.'
                }
            });
        }
        
        const subtitlesData = fs.readFileSync(jsonFilePath, 'utf8');
        const subtitles = JSON.parse(subtitlesData);
        
        // 형식별 처리
        if (format === 'json') {
            res.json({
                success: true,
                data: {
                    videoId: videoId,
                    language: language,
                    subtitles: subtitles.map(segment => ({
                        id: segment.id,
                        startTime: segment.startTime,
                        endTime: segment.endTime,
                        text: segment[language] || segment.text || '',
                        speaker: segment.speaker || 1
                    })),
                    speakers: [
                        { id: 1, name: 'Speaker 1' }
                    ]
                }
            });
        } else {
            // SRT/VTT 형식은 기존 다운로드 API 사용
            return res.redirect(`/api/jobs/${jobId}/subtitle?format=${format}&lang=${language}`);
        }
        
    } catch (error) {
        logger.error('자막 조회 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

/**
 * 자막 수정
 * PUT /api/videos/:videoId/subtitles
 */
router.put('/:videoId/subtitles', async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const { language, subtitles } = req.body;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        if (!language || !subtitles || !Array.isArray(subtitles)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'language와 subtitles 배열이 필요합니다.'
                }
            });
        }
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            `SELECT id, status, user_id FROM video_jobs WHERE id = ?`,
            [jobId]
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
        
        // 권한 확인
        if (job.user_id && job.user_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: ERROR_CODES.FORBIDDEN.code,
                    message: '접근 권한이 없습니다.'
                }
            });
        }
        
        // 자막 데이터 로드
        const resultsDir = path.join(__dirname, '..', process.env.RESULTS_DIR || 'results');
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBTITLES_NOT_FOUND',
                    message: '자막 데이터를 찾을 수 없습니다.'
                }
            });
        }
        
        const existingSubtitles = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        
        // 자막 수정 (기존 세그먼트 업데이트)
        const updatedSubtitles = existingSubtitles.map(existing => {
            const updated = subtitles.find(s => s.id === existing.id);
            if (updated) {
                return {
                    ...existing,
                    startTime: updated.startTime !== undefined ? updated.startTime : existing.startTime,
                    endTime: updated.endTime !== undefined ? updated.endTime : existing.endTime,
                    [language]: updated.text,
                    is_edited: true
                };
            }
            return existing;
        });
        
        // 파일 저장
        fs.writeFileSync(jsonFilePath, JSON.stringify(updatedSubtitles, null, 2));
        
        // DB에 저장 (subtitles 테이블에 저장 - 선택사항)
        // 여기서는 JSON 파일만 업데이트
        
        logger.logEvent('SUBTITLES_UPDATED', {
            requestId: req.requestId,
            userId: req.user.userId,
            jobId,
            language
        });
        
        res.json({
            success: true,
            message: '자막이 수정되었습니다.',
            data: {
                videoId: videoId,
                language: language,
                updatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('자막 수정 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

/**
 * 자막 세그먼트 분할
 * POST /api/videos/:videoId/subtitles/:subtitleId/split
 */
router.post('/:videoId/subtitles/:subtitleId/split', async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const subtitleId = parseInt(req.params.subtitleId);
        const { splitTime, text1, text2 } = req.body;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        if (!splitTime || text1 === undefined || text2 === undefined) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'splitTime, text1, text2가 필요합니다.'
                }
            });
        }
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            `SELECT id, status, user_id FROM video_jobs WHERE id = ?`,
            [jobId]
        );
        
        if (jobs.length === 0 || (jobs[0].user_id && jobs[0].user_id !== req.user.userId)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND.code,
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        // 자막 데이터 로드
        const resultsDir = path.join(__dirname, '..', process.env.RESULTS_DIR || 'results');
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBTITLES_NOT_FOUND',
                    message: '자막 데이터를 찾을 수 없습니다.'
                }
            });
        }
        
        const subtitles = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        const segmentIndex = subtitles.findIndex(s => s.id === subtitleId);
        
        if (segmentIndex === -1) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBTITLE_NOT_FOUND',
                    message: '자막 세그먼트를 찾을 수 없습니다.'
                }
            });
        }
        
        const segment = subtitles[segmentIndex];
        
        // 세그먼트 분할
        const newSegment1 = {
            ...segment,
            id: segment.id,
            endTime: splitTime,
            text: text1,
            ko: text1
        };
        
        const newSegment2 = {
            ...segment,
            id: subtitles.length + 1,
            startTime: splitTime,
            text: text2,
            ko: text2
        };
        
        // 세그먼트 교체
        subtitles.splice(segmentIndex, 1, newSegment1, newSegment2);
        
        // ID 재정렬
        subtitles.forEach((s, index) => {
            s.id = index + 1;
        });
        
        // 파일 저장
        fs.writeFileSync(jsonFilePath, JSON.stringify(subtitles, null, 2));
        
        logger.logEvent('SUBTITLE_SPLIT', {
            requestId: req.requestId,
            userId: req.user.userId,
            jobId,
            subtitleId
        });
        
        res.json({
            success: true,
            message: '자막이 분할되었습니다.',
            data: {
                originalId: subtitleId,
                newSubtitles: [
                    {
                        id: newSegment1.id,
                        startTime: newSegment1.startTime,
                        endTime: newSegment1.endTime,
                        text: newSegment1.text
                    },
                    {
                        id: newSegment2.id,
                        startTime: newSegment2.startTime,
                        endTime: newSegment2.endTime,
                        text: newSegment2.text
                    }
                ]
            }
        });
        
    } catch (error) {
        logger.error('자막 분할 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

/**
 * 자막 세그먼트 병합
 * POST /api/videos/:videoId/subtitles/merge
 */
router.post('/:videoId/subtitles/merge', async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        const { subtitleIds, text } = req.body;
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        if (!subtitleIds || !Array.isArray(subtitleIds) || subtitleIds.length < 2 || !text) {
            return res.status(400).json({
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: 'subtitleIds 배열(최소 2개)과 text가 필요합니다.'
                }
            });
        }
        
        // Job 조회 및 권한 확인
        const [jobs] = await db.execute(
            `SELECT id, status, user_id FROM video_jobs WHERE id = ?`,
            [jobId]
        );
        
        if (jobs.length === 0 || (jobs[0].user_id && jobs[0].user_id !== req.user.userId)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: ERROR_CODES.JOB_NOT_FOUND.code,
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }
        
        // 자막 데이터 로드
        const resultsDir = path.join(__dirname, '..', process.env.RESULTS_DIR || 'results');
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBTITLES_NOT_FOUND',
                    message: '자막 데이터를 찾을 수 없습니다.'
                }
            });
        }
        
        const subtitles = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        
        // 병합할 세그먼트 찾기
        const segmentsToMerge = subtitles.filter(s => subtitleIds.includes(s.id));
        
        if (segmentsToMerge.length !== subtitleIds.length) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBTITLE_NOT_FOUND',
                    message: '일부 자막 세그먼트를 찾을 수 없습니다.'
                }
            });
        }
        
        // 세그먼트 정렬
        segmentsToMerge.sort((a, b) => a.startTime - b.startTime);
        
        // 병합된 세그먼트 생성
        const mergedSegment = {
            id: segmentsToMerge[0].id,
            startTime: segmentsToMerge[0].startTime,
            endTime: segmentsToMerge[segmentsToMerge.length - 1].endTime,
            text: text,
            ko: text,
            speaker: segmentsToMerge[0].speaker || 1
        };
        
        // 세그먼트 교체 (첫 번째 세그먼트 위치에 병합된 세그먼트 삽입, 나머지 제거)
        const firstIndex = subtitles.findIndex(s => s.id === segmentsToMerge[0].id);
        const indicesToRemove = segmentsToMerge.map(s => subtitles.findIndex(sub => sub.id === s.id)).sort((a, b) => b - a);
        
        // 역순으로 제거 (인덱스 변경 방지)
        indicesToRemove.forEach(index => {
            if (index !== firstIndex) {
                subtitles.splice(index, 1);
            }
        });
        
        // 첫 번째 위치에 병합된 세그먼트 삽입
        subtitles[firstIndex] = mergedSegment;
        
        // ID 재정렬
        subtitles.forEach((s, index) => {
            s.id = index + 1;
        });
        
        // 파일 저장
        fs.writeFileSync(jsonFilePath, JSON.stringify(subtitles, null, 2));
        
        logger.logEvent('SUBTITLE_MERGED', {
            requestId: req.requestId,
            userId: req.user.userId,
            jobId,
            subtitleIds
        });
        
        res.json({
            success: true,
            message: '자막이 병합되었습니다.',
            data: {
                mergedId: mergedSegment.id,
                startTime: mergedSegment.startTime,
                endTime: mergedSegment.endTime,
                text: mergedSegment.text
            }
        });
        
    } catch (error) {
        logger.error('자막 병합 오류', {
            requestId: req.requestId,
            error: error.message,
            videoId: req.params.videoId
        });
        next(error);
    }
});

module.exports = router;


