require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { authenticateToken, requireAuth } = require('./middleware/auth');
const requestLogger = require('./middleware/request-logger');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { fileFilter, sanitizeFilename } = require('./middleware/file-validator');
const { checkUploadQuota } = require('./middleware/upload-quota');
const { guestUploadLimiter, userUploadLimiter, ipApiLimiter } = require('./middleware/rate-limit-ip');
const { guestTokenMiddleware, guestUploadLimitMiddleware, cleanupExpiredTokens } = require('./middleware/guest-token');
const jobRoutes = require('./routes/job-routes');
const authRoutes = require('./routes/auth-routes');
const creditRoutes = require('./routes/credit-routes');
const subtitleRoutes = require('./routes/subtitle-routes');
const mypageRoutes = require('./routes/mypage-routes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Job 상태 전환 시뮬레이션 (DB 기반)
async function simulateJobProcessing(jobId) {
    try {
        // queued → processing (즉시)
        await db.execute(
            `UPDATE video_jobs SET status = 'processing', progress = 10, updated_at = NOW() WHERE id = ? AND status = 'queued'`,
            [jobId]
        );
        
        // processing → completed (5초 후)
        setTimeout(async () => {
            try {
                const completedAt = new Date();
                const expiresAt = new Date(completedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
                
                await db.execute(
                    `UPDATE video_jobs 
                     SET status = 'completed', 
                         progress = 100, 
                         completed_at = ?, 
                         expires_at = ?,
                         updated_at = NOW() 
                     WHERE id = ?`,
                    [completedAt, expiresAt, jobId]
                );
                
                // 자막 데이터 생성 및 저장 (JSON 파일로 저장)
                const subtitles = generateMockSubtitles();
                
                const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
                fs.writeFileSync(jsonFilePath, JSON.stringify(subtitles, null, 2));
                
                // job_results에 저장
                await db.execute(
                    `INSERT INTO job_results (job_id, format, file_path) 
                     VALUES (?, 'json', ?)
                     ON DUPLICATE KEY UPDATE file_path = ?`,
                    [jobId, jsonFilePath, jsonFilePath]
                );
                
                logger.logEvent('JOB_COMPLETED', { jobId });
            } catch (error) {
                logger.error('Job 완료 처리 오류', { jobId, error: error.message });
                await db.execute(
                    `UPDATE video_jobs SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
                    [error.message, jobId]
                );
            }
        }, 5000);
    } catch (error) {
        logger.error('Job 처리 시작 오류', { jobId, error: error.message });
    }
}

// 더미 자막 생성
function generateMockSubtitles(duration = 60, originalLang = 'ko', targetLangs = ['en']) {
    const segments = [];
    const segmentDuration = 3;
    const numSegments = Math.ceil(duration / segmentDuration);
    
    const mockTexts = {
        ko: [
            "안녕하세요, 오늘 강의를 시작하겠습니다.",
            "오늘은 AI 기술에 대해 알아보겠습니다.",
            "먼저 머신러닝의 기본 개념부터 설명드리겠습니다.",
            "머신러닝은 데이터로부터 패턴을 학습하는 기술입니다.",
            "딥러닝은 인공신경망을 사용한 머신러닝의 한 분야입니다.",
            "이제 실제 사례를 통해 살펴보겠습니다.",
            "자연어 처리 분야에서 많은 발전이 있었습니다.",
            "음성 인식 기술도 크게 향상되었습니다.",
            "이러한 기술들이 우리 일상에 어떻게 적용되는지 알아보겠습니다.",
            "질문이 있으시면 언제든지 말씀해주세요."
        ],
        en: [
            "Hello, let's start today's lecture.",
            "Today, we will learn about AI technology.",
            "First, I'll explain the basic concepts of machine learning.",
            "Machine learning is a technology that learns patterns from data.",
            "Deep learning is a field of machine learning using artificial neural networks.",
            "Now, let's look at real-world examples.",
            "There has been significant progress in natural language processing.",
            "Speech recognition technology has also greatly improved.",
            "Let's see how these technologies are applied in our daily lives.",
            "Please feel free to ask questions at any time."
        ]
    };
    
    for (let i = 0; i < numSegments; i++) {
        const start = i * segmentDuration;
        const end = Math.min((i + 1) * segmentDuration, duration);
        
        const segment = {
            id: i + 1,
            startTime: start,
            endTime: end,
            speaker: 1
        };
        
        const textIndex = i % (mockTexts[originalLang]?.length || 10);
        segment[originalLang] = mockTexts[originalLang]?.[textIndex] || `세그먼트 ${i + 1}`;
        
        targetLangs.forEach(lang => {
            if (mockTexts[lang] && mockTexts[lang][textIndex]) {
                segment[lang] = mockTexts[lang][textIndex];
            } else {
                segment[lang] = `[${lang}] ${segment[originalLang]}`;
            }
        });
        
        segments.push(segment);
    }
    
    return segments;
}

// 시간을 SRT 형식으로 변환 (00:00:00,000)
function formatTimeSRT(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// 시간을 VTT 형식으로 변환 (00:00:00.000)
function formatTimeVTT(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// 자막을 SRT 형식으로 변환
function convertToSRT(subtitles, langCode = 'ko') {
    let srtContent = '';
    subtitles.forEach((segment, index) => {
        const sequence = index + 1;
        const startTime = formatTimeSRT(segment.startTime);
        const endTime = formatTimeSRT(segment.endTime);
        const text = segment[langCode] || segment.text || '';
        
        srtContent += `${sequence}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${text}\n\n`;
    });
    return srtContent;
}

// 자막을 VTT 형식으로 변환
function convertToVTT(subtitles, langCode = 'ko') {
    let vttContent = 'WEBVTT\n\n';
    subtitles.forEach((segment) => {
        const startTime = formatTimeVTT(segment.startTime);
        const endTime = formatTimeVTT(segment.endTime);
        const text = segment[langCode] || segment.text || '';
        
        vttContent += `${startTime} --> ${endTime}\n`;
        vttContent += `${text}\n\n`;
    });
    return vttContent;
}

// JSON 파싱
app.use(express.json());

// 업로드 디렉토리 생성
const uploadsDir = path.join(__dirname, process.env.UPLOADS_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 결과 디렉토리 생성
const resultsDir = path.join(__dirname, process.env.RESULTS_DIR || 'results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `video-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024 // 2GB
    },
    fileFilter: fileFilter // 강화된 파일 검증 사용
});

// 보안 헤더 설정
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS 설정 (환경변수 기반)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
    origin: function (origin, callback) {
        // origin이 없으면 (같은 도메인 요청) 허용
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS 정책에 의해 차단되었습니다.'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 요청 로깅 미들웨어 (request_id 생성)
app.use(requestLogger);

// 게스트 토큰 미들웨어 (비로그인 사용자)
app.use(guestTokenMiddleware);

// IP별 API Rate Limit (모든 요청)
app.use(ipApiLimiter);

// 정적 파일 서빙 (프론트엔드)
const frontendPath = path.resolve(__dirname, '..');
app.use(express.static(frontendPath));

// 루트 경로에서 index.html 서빙
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Health check 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// 인증 라우트
app.use('/api/auth', authRoutes);

// 크레딧 라우트
app.use('/api/credits', creditRoutes);

// 비디오 라우트 (목록, 상세, 다운로드 URL 등)
const videoRoutes = require('./routes/video-routes');
app.use('/api/videos', videoRoutes);

// 자막 편집 라우트
app.use('/api/videos', subtitleRoutes);

// 마이페이지 라우트
app.use('/api/mypage', mypageRoutes);

// Job 라우트 (재시도, 재처리)
app.use('/api/jobs', jobRoutes);

// 업로드 API (인증 선택적 - 비로그인 사용자도 허용)
// Rate Limit: 비로그인 3회/15분, 로그인 10회/15분
app.post('/api/videos/upload', 
    authenticateToken, 
    guestUploadLimiter,  // 비로그인 사용자 제한
    userUploadLimiter,   // 로그인 사용자 제한
    guestUploadLimitMiddleware,  // 게스트 토큰 기반 업로드 제한
    upload.single('video'), 
    checkUploadQuota, 
    async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILE',
                    message: '파일이 업로드되지 않았습니다.'
                }
            });
        }

        // jobId 생성
        const jobId = uuidv4();
        const videoPath = path.join(uploadsDir, req.file.filename);
        
        // 파일명 정제 (보안)
        const sanitizedOriginalName = sanitizeFilename(req.file.originalname);
        const title = sanitizedOriginalName.replace(/\.[^/.]+$/, '') || '영상';
        
        // 게스트 업로드 카운트 증가
        if (req.incrementGuestUpload) {
            req.incrementGuestUpload();
        }
        
        // 업로드 이벤트 로깅
        logger.logEvent('UPLOAD_SUCCESS', {
            requestId: req.requestId,
            userId: req.user?.userId || null,
            guestToken: req.guestToken ? req.guestToken.substring(0, 20) + '...' : null,
            jobId,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // DB에 Job 생성 (user_id 포함, 파일 크기 저장)
        const userId = req.user ? req.user.userId : null;
        await db.execute(
            `INSERT INTO video_jobs (id, user_id, title, original_name, video_path, size, status, progress)
             VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)`,
            [jobId, userId, title, sanitizedOriginalName, videoPath, req.file.size]
        );

        // Job 처리 시뮬레이션 시작 (비동기, 에러는 내부에서 처리)
        // 주의: worker.js를 사용하는 경우 이 호출을 제거하거나 주석 처리하세요
        simulateJobProcessing(jobId).catch(error => {
            logger.error('Job 처리 시작 실패', {
                requestId: req.requestId,
                jobId,
                error: error.message
            });
        });

        // 성공 응답
        res.json({
            success: true,
            data: {
                jobId: jobId,
                filename: req.file.filename,
                originalName: sanitizedOriginalName,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });

    } catch (error) {
        logger.logEvent('UPLOAD_FAILED', {
            requestId: req.requestId,
            userId: req.user?.userId || null,
            error: error.message
        });
        
        // 에러는 전역 에러 핸들러에서 처리
        next(error);
    }
});

// Job 상태 조회 API (인증 선택적)
app.get('/api/jobs/:id', authenticateToken, async (req, res, next) => {
    try {
        const jobId = req.params.id;
        
        // 사용자별 필터링 (로그인한 경우)
        let query = `SELECT id, title, original_name, video_path, status, progress, 
                            created_at, updated_at, completed_at, expires_at, deleted_at
                     FROM video_jobs WHERE id = ?`;
        const queryParams = [jobId];
        
        // 로그인한 사용자는 자신의 작업만 조회 가능
        if (req.user) {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(req.user.userId);
        } else {
            // 비로그인 사용자는 user_id가 NULL인 작업만 조회 가능
            query += ' AND user_id IS NULL';
        }
        
        const [rows] = await db.execute(query, queryParams);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }

        const job = rows[0];

        // 응답 데이터 구성
        const responseData = {
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            filename: path.basename(job.video_path),
            originalName: job.original_name,
            title: job.title,
            createdAt: job.created_at,
            updatedAt: job.updated_at
        };

        // completed 상태일 때 자막 데이터 포함
        if (job.status === 'completed') {
            if (job.completed_at) {
                responseData.completedAt = job.completed_at;
            }
            if (job.expires_at) {
                responseData.expiresAt = job.expires_at;
            }
            
                // 자막 데이터 로드 (JSON 파일에서)
            try {
                const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
                if (fs.existsSync(jsonFilePath)) {
                    const subtitlesData = fs.readFileSync(jsonFilePath, 'utf8');
                    responseData.subtitles = JSON.parse(subtitlesData);
                }
            } catch (subError) {
                logger.warn('자막 데이터 로드 오류', {
                    requestId: req.requestId,
                    jobId,
                    error: subError.message
                });
            }
        }
        
        // deleted 상태 정보 포함
        if (job.status === 'deleted' && job.deleted_at) {
            responseData.deletedAt = job.deleted_at;
        }

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        logger.error('Job 조회 오류', {
            requestId: req.requestId,
            jobId: req.params.id,
            error: error.message
        });
        next(error);
    }
});

// 자막 다운로드 API (인증 선택적, 권한 체크 강화)
app.get('/api/jobs/:id/subtitle', authenticateToken, async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const format = req.query.format || 'json';
        const lang = req.query.lang || 'ko';
        
        // 다운로드 이벤트 로깅
        logger.logEvent('DOWNLOAD_REQUESTED', {
            requestId: req.requestId,
            userId: req.user?.userId || null,
            jobId,
            format,
            lang
        });
        
        // Job 조회 (사용자별 필터링 - 권한 체크 강화)
        let query = `SELECT id, status, original_name, user_id FROM video_jobs WHERE id = ?`;
        const queryParams = [jobId];
        
        // 권한 체크: 로그인 사용자는 자신의 작업만, 비로그인은 user_id가 NULL인 작업만
        if (req.user) {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(req.user.userId);
        } else {
            query += ' AND user_id IS NULL';
        }
        
        const [rows] = await db.execute(query, queryParams);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }

        const job = rows[0];

        if (job.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'JOB_NOT_COMPLETED',
                    message: '작업이 아직 완료되지 않았습니다.'
                }
            });
        }

        // 자막 데이터 로드
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
        if (format === 'srt') {
            const srtContent = convertToSRT(subtitles, lang);
            const filename = `${job.original_name.replace(/\.[^/.]+$/, '')}_${lang}.srt`;
            
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.send(srtContent);
            
        } else if (format === 'vtt') {
            const vttContent = convertToVTT(subtitles, lang);
            const filename = `${job.original_name.replace(/\.[^/.]+$/, '')}_${lang}.vtt`;
            
            res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.send(vttContent);
            
        } else if (format === 'json') {
            const jsonData = {
                jobId: job.id,
                language: lang,
                subtitles: subtitles.map(segment => ({
                    id: segment.id,
                    startTime: segment.startTime,
                    endTime: segment.endTime,
                    text: segment[lang] || segment.text || '',
                    speaker: segment.speaker || 1
                }))
            };
            
            const filename = `${job.original_name.replace(/\.[^/.]+$/, '')}_${lang}.json`;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.json(jsonData);
            
        } else {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_FORMAT',
                    message: '지원하지 않는 형식입니다. srt, vtt, json 중 하나를 선택하세요.'
                }
            });
        }

    } catch (error) {
        logger.error('Storage 조회 오류', {
            requestId: req.requestId,
            error: error.message
        });
        next(error);
    }
});

// Storage 목록 조회 API (인증 선택적)
app.get('/api/storage', authenticateToken, async (req, res, next) => {
    try {
        const status = req.query.status || 'all';
        const search = req.query.search;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        // SQL 쿼리 구성
        let whereConditions = ["status != 'deleted'"];
        const queryParams = [];
        
        // 사용자별 필터링
        if (req.user) {
            // 로그인한 사용자: 자신의 작업 또는 비로그인 작업
            whereConditions.push("(user_id = ? OR user_id IS NULL)");
            queryParams.push(req.user.userId);
        } else {
            // 비로그인 사용자: user_id가 NULL인 작업만
            whereConditions.push("user_id IS NULL");
        }

        // 상태 필터링
        if (status && status !== 'all') {
            if (status === 'processing') {
                whereConditions.push("(status = 'processing' OR status = 'queued')");
            } else if (status === 'completed') {
                whereConditions.push("status = 'completed'");
            } else if (status === 'expiring') {
                // 만료 예정 (D-3): 3일 이내 만료되는 Job
                whereConditions.push("status = 'completed' AND expires_at IS NOT NULL AND expires_at > NOW() AND expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)");
            }
        }

        // 검색 필터링
        if (search) {
            whereConditions.push("(original_name LIKE ? OR title LIKE ?)");
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

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
            [...queryParams, limit, offset]
        );

        // 파일 크기 조회를 위해 파일 시스템 확인
        const videos = await Promise.all(rows.map(async (job) => {
            let fileSize = 0;
            try {
                if (fs.existsSync(job.video_path)) {
                    const stats = fs.statSync(job.video_path);
                    fileSize = stats.size;
                }
            } catch (error) {
                logger.warn('파일 크기 조회 오류', {
                    jobId: job.id,
                    path: job.video_path,
                    error: error.message
                });
            }

            return {
                id: `video_${job.id}`,
                jobId: job.id,
                title: job.title || job.original_name.replace(/\.[^/.]+$/, '') || '영상',
                description: '서버에서 불러온 영상',
                fileName: job.original_name,
                fileSize: fileSize,
                size: fileSize / (1024 * 1024 * 1024),
                translated: job.status === 'completed',
                status: job.status,
                progress: job.progress || 0,
                createdAt: job.created_at,
                savedAt: job.completed_at || job.updated_at,
                expiresAt: job.expires_at,
                serverJob: true
            };
        }));

        res.json({
            success: true,
            data: videos,
            pagination: {
                total: total,
                limit: limit,
                offset: offset,
                hasMore: offset + limit < total
            }
        });

    } catch (error) {
        logger.error('Storage 조회 오류', {
            requestId: req.requestId,
            error: error.message
        });
        next(error);
    }
});

// Storage 삭제 API (인증 선택적, 소유자 확인)
app.delete('/api/storage/:id', authenticateToken, async (req, res, next) => {
    try {
        const videoId = req.params.id;
        
        // video_ 접두사 제거하여 jobId 추출
        const jobId = videoId.startsWith('video_') ? videoId.replace('video_', '') : videoId;
        
        // Job 조회 (소유자 확인)
        let query = `SELECT id, video_path, user_id FROM video_jobs WHERE id = ?`;
        const queryParams = [jobId];
        
        if (req.user) {
            // 로그인한 사용자: 자신의 작업만 삭제 가능
            query += ' AND (user_id = ? OR user_id IS NULL)';
            queryParams.push(req.user.userId);
        } else {
            // 비로그인 사용자: user_id가 NULL인 작업만 삭제 가능
            query += ' AND user_id IS NULL';
        }
        
        const [rows] = await db.execute(query, queryParams);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: '작업을 찾을 수 없습니다.'
                }
            });
        }

        const job = rows[0];

                // 업로드된 파일 삭제
        if (job.video_path && fs.existsSync(job.video_path)) {
            try {
                fs.unlinkSync(job.video_path);
                logger.logEvent('DELETE_MANUAL', {
                    requestId: req.requestId,
                    userId: req.user?.userId || null,
                    jobId,
                    type: 'video_file'
                });
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
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        if (fs.existsSync(jsonFilePath)) {
            try {
                fs.unlinkSync(jsonFilePath);
                logger.logEvent('DELETE_MANUAL', {
                    requestId: req.requestId,
                    userId: req.user?.userId || null,
                    jobId,
                    type: 'result_file'
                });
            } catch (fileError) {
                logger.error('결과 파일 삭제 오류', {
                    requestId: req.requestId,
                    jobId,
                    path: jsonFilePath,
                    error: fileError.message
                });
            }
        }

        // DB에서 Job 삭제 (CASCADE로 job_results도 자동 삭제)
        await db.execute(`DELETE FROM video_jobs WHERE id = ?`, [jobId]);

        res.json({
            success: true,
            message: '작업이 삭제되었습니다.',
            data: {
                jobId: jobId
            }
        });

    } catch (error) {
        logger.error('Storage 삭제 오류', {
            requestId: req.requestId,
            jobId: videoId,
            error: error.message
        });
        next(error);
    }
});

// 404 핸들러 (모든 라우트 이후)
app.use(notFoundHandler);

// 전역 에러 핸들러 (모든 라우트 이후)
app.use(errorHandler);

// 만료된 Job 정리 함수 (DB 기반)
async function cleanupExpiredJobs() {
    try {
        // 만료된 Job 조회 (expires_at이 지났고 status가 completed인 Job)
        const [rows] = await db.execute(
            `SELECT id, video_path FROM video_jobs 
             WHERE status = 'completed' 
             AND expires_at IS NOT NULL 
             AND expires_at <= NOW()`
        );

        let cleanedCount = 0;

        for (const job of rows) {
            try {
                logger.logEvent('DELETE_AUTO', { jobId: job.id });

                // 업로드된 파일 삭제
                if (job.video_path && fs.existsSync(job.video_path)) {
                    try {
                        fs.unlinkSync(job.video_path);
                        logger.debug('만료 파일 삭제 완료', { jobId: job.id, path: job.video_path });
                    } catch (fileError) {
                        logger.error('만료 파일 삭제 오류', { jobId: job.id, path: job.video_path, error: fileError.message });
                    }
                }

                // 결과 파일 삭제
                const jsonFilePath = path.join(resultsDir, `${job.id}.json`);
                if (fs.existsSync(jsonFilePath)) {
                    try {
                        fs.unlinkSync(jsonFilePath);
                        logger.debug('만료 결과 파일 삭제 완료', { jobId: job.id, path: jsonFilePath });
                    } catch (fileError) {
                        logger.error('만료 결과 파일 삭제 오류', { jobId: job.id, path: jsonFilePath, error: fileError.message });
                    }
                }

                // job_results 테이블의 레코드는 CASCADE로 자동 삭제됨
                // status를 deleted로 변경
                await db.execute(
                    `UPDATE video_jobs 
                     SET status = 'deleted', 
                         deleted_at = NOW(), 
                         updated_at = NOW() 
                     WHERE id = ?`,
                    [job.id]
                );

                cleanedCount++;
                logger.debug('만료 Job 삭제 완료', { jobId: job.id });
            } catch (jobError) {
                logger.error('만료 Job 정리 오류', { jobId: job.id, error: jobError.message });
            }
        }

        if (cleanedCount > 0) {
            logger.info(`만료된 Job 정리 완료`, { cleanedCount });
        }
    } catch (error) {
        logger.error('만료 Job 정리 오류', { error: error.message });
    }
}

// 스케줄러 시작 (1시간마다 실행)
function startScheduler() {
    // 서버 시작 시 즉시 한 번 실행
    cleanupExpiredJobs();
    cleanupExpiredTokens(); // 게스트 토큰 정리
    
    // 1시간마다 실행 (3600000ms = 1시간)
    setInterval(() => {
        cleanupExpiredJobs();
        cleanupExpiredTokens(); // 게스트 토큰 정리
    }, 60 * 60 * 1000);
    
    logger.info('만료 Job 정리 스케줄러 시작', { interval: '1시간' });
    logger.info('게스트 토큰 정리 스케줄러 시작', { interval: '1시간' });
}

// 서버 시작
const server = app.listen(PORT, () => {
    logger.info('서버 시작', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development'
    });
    logger.info('서버 시작 완료', { port: PORT, uploadsDir });
    
    // 스케줄러 시작
    startScheduler();
});

// 서버 타임아웃 설정 (대용량 업로드 대응)
server.timeout = 600000;  // 10분
server.keepAliveTimeout = 65000;  // 65초
server.headersTimeout = 66000;  // 66초

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('서버 종료 신호 수신 (SIGTERM)');
    server.close(() => {
        logger.info('서버 종료 완료');
        process.exit(0);
    });
    
    // 강제 종료 (10초 후)
    setTimeout(() => {
        logger.error('서버 강제 종료');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', () => {
    logger.info('서버 종료 신호 수신 (SIGINT)');
    server.close(() => {
        logger.info('서버 종료 완료');
        process.exit(0);
    });
});


