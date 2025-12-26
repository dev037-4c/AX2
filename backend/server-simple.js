/**
 * AX2 Caption - 최소 백엔드 API 서버
 * 영상 업로드만 처리하는 간단한 서버
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// 업로드 디렉토리 생성
async function ensureUploadDir() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        console.log(`업로드 디렉토리 준비 완료: ${UPLOAD_DIR}`);
    } catch (error) {
        console.error('업로드 디렉토리 생성 실패:', error);
    }
}

// Multer 설정
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await ensureUploadDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // jobId 생성: timestamp + random string
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = path.extname(file.originalname);
        const filename = `${jobId}${ext}`;
        
        // jobId를 req에 저장 (응답에 사용)
        req.jobId = jobId;
        req.uploadedFilename = filename;
        
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        // 영상 파일 확장자 체크
        const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`));
        }
    }
});

// 미들웨어
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (프론트엔드)
const frontendPath = path.resolve(__dirname, '..');
app.use(express.static(frontendPath));

// 루트 경로에서 index.html 서빙
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// API: 영상 업로드
app.post('/api/videos/upload', (req, res) => {
    upload.single('video')(req, res, async (err) => {
        // Multer 에러 처리
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'FILE_TOO_LARGE',
                            message: '파일 크기는 2GB를 초과할 수 없습니다.'
                        }
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'UPLOAD_ERROR',
                        message: err.message || '파일 업로드 중 오류가 발생했습니다.'
                    }
                });
            }
            
            // 파일 형식 에러 등 기타 에러
            if (err.message && err.message.includes('지원하지 않는 파일 형식')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_FILE_TYPE',
                        message: err.message
                    }
                });
            }
            
            return res.status(400).json({
                success: false,
                error: {
                    code: 'UPLOAD_ERROR',
                    message: err.message || '파일 업로드 중 오류가 발생했습니다.'
                }
            });
        }
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NO_FILE',
                        message: '영상 파일이 업로드되지 않았습니다.'
                    }
                });
            }

        const jobId = req.jobId;
        const fileInfo = {
            originalName: req.file.originalname,
            filename: req.uploadedFilename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path
        };

        console.log(`영상 업로드 성공: ${jobId}`, {
            originalName: fileInfo.originalName,
            size: fileInfo.size,
            filename: fileInfo.filename
        });

            res.json({
                success: true,
                message: '영상이 업로드되었습니다.',
                data: {
                    jobId: jobId,
                    filename: fileInfo.filename,
                    originalName: fileInfo.originalName,
                    size: fileInfo.size,
                    uploadedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('업로드 오류:', error);
            
            // 파일이 업로드되었지만 오류 발생 시 삭제
            if (req.file && req.file.path) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error('파일 삭제 실패:', unlinkError);
                }
            }

            res.status(500).json({
                success: false,
                error: {
                    code: 'UPLOAD_ERROR',
                    message: error.message || '파일 업로드 중 오류가 발생했습니다.'
                }
            });
        }
    });
});

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: '요청한 리소스를 찾을 수 없습니다.'
        }
    });
});

// 서버 시작
ensureUploadDir().then(() => {
    app.listen(PORT, () => {
        console.log('=================================');
        console.log('AX2 Caption API Server (Simple)');
        console.log(`서버가 시작되었습니다.`);
        console.log(`포트: ${PORT}`);
        console.log(`업로드 디렉토리: ${UPLOAD_DIR}`);
        console.log('=================================');
        console.log(`\nAPI 엔드포인트:`);
        console.log(`  POST   /api/videos/upload  - 영상 업로드`);
        console.log(`  GET    /health            - 헬스 체크`);
        console.log(`\n프론트엔드: http://localhost:${PORT}`);
        console.log('=================================\n');
    });
});

module.exports = app;


