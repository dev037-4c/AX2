const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const jobService = require('./job-service');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

async function ensureUploadDir() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (error) {
        console.error('업로드 디렉토리 생성 실패:', error);
    }
}

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await ensureUploadDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = path.extname(file.originalname);
        const filename = `${jobId}${ext}`;
        req.jobId = jobId;
        req.uploadedFilename = filename;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`));
        }
    }
});

app.use(cors());
app.use(express.json());

const frontendPath = path.resolve(__dirname, '..');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.post('/api/videos/upload', (req, res) => {
    upload.single('video')(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 2GB를 초과할 수 없습니다.' }
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: { code: 'UPLOAD_ERROR', message: err.message || '파일 업로드 중 오류가 발생했습니다.' }
                });
            }
            if (err.message && err.message.includes('지원하지 않는 파일 형식')) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_FILE_TYPE', message: err.message }
                });
            }
            return res.status(400).json({
                success: false,
                error: { code: 'UPLOAD_ERROR', message: err.message || '파일 업로드 중 오류가 발생했습니다.' }
            });
        }
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_FILE', message: '영상 파일이 업로드되지 않았습니다.' }
                });
            }

            const jobId = req.jobId;
            
            const job = jobService.createJob(
                jobId,
                req.uploadedFilename,
                req.file.originalname,
                req.file.size
            );
            
            console.log(`영상 업로드 성공: ${jobId}`, {
                originalName: req.file.originalname,
                size: req.file.size,
                filename: req.uploadedFilename
            });

            setTimeout(() => {
                jobService.updateJobStatus(jobId, 'processing', 50);
                setTimeout(() => {
                    jobService.updateJobStatus(jobId, 'completed', 100);
                }, 2000);
            }, 1000);

            res.json({
                success: true,
                message: '영상이 업로드되었습니다.',
                data: {
                    jobId: jobId,
                    filename: req.uploadedFilename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    uploadedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('업로드 오류:', error);
            if (req.file && req.file.path) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error('파일 삭제 실패:', unlinkError);
                }
            }
            res.status(500).json({
                success: false,
                error: { code: 'UPLOAD_ERROR', message: error.message || '파일 업로드 중 오류가 발생했습니다.' }
            });
        }
    });
});

app.get('/api/jobs/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobService.getJob(jobId);
    
    if (!job) {
        return res.status(404).json({
            success: false,
            error: { code: 'JOB_NOT_FOUND', message: '작업을 찾을 수 없습니다.' }
        });
    }
    
    res.json({
        success: true,
        data: job
    });
});

app.get('/api/jobs', (req, res) => {
    const status = req.query.status;
    const allJobs = Object.values(jobService.getAllJobs());
    
    let filteredJobs = allJobs;
    if (status) {
        filteredJobs = allJobs.filter(job => job.status === status);
    }
    
    res.json({
        success: true,
        data: filteredJobs
    });
});

app.get('/api/jobs/:jobId/subtitles', (req, res) => {
    const { jobId } = req.params;
    const job = jobService.getJob(jobId);
    
    if (!job) {
        return res.status(404).json({
            success: false,
            error: { code: 'JOB_NOT_FOUND', message: '작업을 찾을 수 없습니다.' }
        });
    }
    
    if (job.status !== 'completed') {
        return res.status(400).json({
            success: false,
            error: { code: 'JOB_NOT_COMPLETED', message: '작업이 아직 완료되지 않았습니다.' }
        });
    }
    
    const originalLang = req.query.originalLang || 'ko';
    const targetLangs = req.query.targetLangs ? req.query.targetLangs.split(',') : ['en'];
    const duration = parseFloat(req.query.duration) || 60;
    
    const subtitles = jobService.generateMockSubtitles(duration, originalLang, targetLangs);
    
    res.json({
        success: true,
        data: {
            jobId: jobId,
            originalLang: originalLang,
            targetLangs: targetLangs,
            subtitles: subtitles
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

ensureUploadDir().then(() => {
    app.listen(PORT, () => {
        console.log('=================================');
        console.log('AX2 Caption API Server');
        console.log(`포트: ${PORT}`);
        console.log(`업로드 디렉토리: ${UPLOAD_DIR}`);
        console.log('=================================');
        console.log(`POST   /api/videos/upload`);
        console.log(`GET    /api/jobs`);
        console.log(`GET    /api/jobs/:jobId`);
        console.log(`GET    /api/jobs/:jobId/subtitles`);
        console.log(`GET    /health`);
        console.log(`프론트엔드: http://localhost:${PORT}`);
        console.log('=================================\n');
    });
});

module.exports = app;


