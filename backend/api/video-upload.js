/**
 * 영상 업로드 API
 * multipart/form-data 방식으로 영상 파일 업로드 처리
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const LocalStorageAdapter = require('../storage/local-storage-adapter');

// Multer 설정
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // 임시 디렉토리에 저장
        const tempDir = path.join(__dirname, '../../storage/temp');
        await fs.mkdir(tempDir, { recursive: true });
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        // jobId를 파일명에 포함 (jobId가 없으면 임시 ID 생성)
        const jobId = req.body.jobId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = path.extname(file.originalname);
        const filename = `${jobId}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024 // 2GB
    },
    fileFilter: (req, file, cb) => {
        // 허용된 파일 형식
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('지원하지 않는 파일 형식입니다. (MP4, MOV, AVI, WEBM만 지원)'));
        }
    }
});

// Storage Adapter 인스턴스 (환경 변수로 전환 가능)
const storageAdapter = new LocalStorageAdapter(path.join(__dirname, '../../storage'));

/**
 * 영상 업로드 처리
 * @param {Object} db - 데이터베이스 연결
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
async function handleVideoUpload(db, req, res) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        if (!req.file) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILE',
                    message: '파일이 업로드되지 않았습니다.'
                }
            });
        }
        
        const userId = req.user?.userId || null;
        const { title, description } = req.body;
        const file = req.file;
        
        // jobId 생성
        const jobId = req.body.jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 파일 정보
        const fileExtension = path.extname(file.originalname);
        const tempFilePath = `temp/${jobId}${fileExtension}`;
        const localTempPath = file.path;
        
        // Storage에 업로드 (임시 디렉토리)
        const storagePath = await storageAdapter.upload(
            localTempPath,
            tempFilePath,
            {
                contentType: file.mimetype,
                originalName: file.originalname,
                size: file.size
            }
        );
        
        // 파일 메타데이터 조회
        const metadata = await storageAdapter.getMetadata(storagePath);
        
        // 비디오 정보를 데이터베이스에 저장
        await client.query(
            `INSERT INTO video_jobs 
             (job_id, user_id, title, description, file_name, file_size, file_type, 
              file_path, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
            [
                jobId,
                userId,
                title || file.originalname,
                description || null,
                file.originalname,
                file.size,
                file.mimetype,
                storagePath,
                'uploaded',
            ]
        );
        
        // 로컬 임시 파일 삭제 (Storage에 저장되었으므로)
        try {
            await fs.unlink(localTempPath);
        } catch (error) {
            console.warn('로컬 임시 파일 삭제 실패:', error);
        }
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: '파일이 업로드되었습니다.',
            data: {
                jobId: jobId,
                fileName: file.originalname,
                fileSize: file.size,
                fileType: file.mimetype,
                filePath: storagePath,
                status: 'uploaded',
                createdAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        
        // 업로드된 파일 정리
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('파일 정리 오류:', cleanupError);
            }
        }
        
        console.error('영상 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'UPLOAD_ERROR',
                message: '파일 업로드 중 오류가 발생했습니다.',
                details: error.message
            }
        });
    } finally {
        client.release();
    }
}

/**
 * 작업 상태를 processing으로 변경 (자막 생성 시작)
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 */
async function startProcessing(db, jobId) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        await client.query(
            `UPDATE video_jobs 
             SET status = 'processing', updated_at = NOW()
             WHERE job_id = $1 AND status = 'uploaded'`,
            [jobId]
        );
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 작업 완료 처리 (임시 → 처리 완료 디렉토리로 이동)
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 */
async function completeProcessing(db, jobId) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // 작업 정보 조회
        const jobResult = await client.query(
            `SELECT job_id, file_path, status FROM video_jobs WHERE job_id = $1`,
            [jobId]
        );
        
        if (jobResult.rows.length === 0) {
            throw new Error('작업을 찾을 수 없습니다.');
        }
        
        const job = jobResult.rows[0];
        
        if (job.status !== 'processing') {
            throw new Error(`작업 상태가 올바르지 않습니다: ${job.status}`);
        }
        
        // 파일 경로 변경 (temp → processed)
        const oldPath = job.file_path;
        const newPath = oldPath.replace('temp/', 'processed/');
        
        // 파일 이동
        await storageAdapter.move(oldPath, newPath);
        
        // 만료 시간 계산 (완료 시점 + 7일)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // 데이터베이스 업데이트
        await client.query(
            `UPDATE video_jobs 
             SET status = 'completed', 
                 file_path = $1,
                 completed_at = NOW(),
                 expires_at = $2,
                 updated_at = NOW()
             WHERE job_id = $3`,
            [newPath, expiresAt, jobId]
        );
        
        await client.query('COMMIT');
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 작업 실패 처리
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 * @param {string} errorMessage - 에러 메시지
 */
async function failProcessing(db, jobId, errorMessage) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        await client.query(
            `UPDATE video_jobs 
             SET status = 'failed', 
                 error_message = $1,
                 updated_at = NOW()
             WHERE job_id = $2`,
            [errorMessage, jobId]
        );
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 만료된 파일 삭제
 * @param {Object} db - 데이터베이스 연결
 * @returns {Promise<number>} 삭제된 파일 수
 */
async function deleteExpiredFiles(db) {
    const client = await db.connect();
    let deletedCount = 0;
    
    try {
        await client.query('BEGIN');
        
        // 만료된 작업 조회
        const expiredJobs = await client.query(
            `SELECT job_id, file_path FROM video_jobs 
             WHERE status = 'completed' 
             AND expires_at < NOW() 
             AND status != 'deleted'`
        );
        
        for (const job of expiredJobs.rows) {
            try {
                // 파일 삭제
                await storageAdapter.delete(job.file_path);
                
                // 상태를 deleted로 변경
                await client.query(
                    `UPDATE video_jobs 
                     SET status = 'deleted', 
                         deleted_at = NOW(),
                         updated_at = NOW()
                     WHERE job_id = $1`,
                    [job.job_id]
                );
                
                deletedCount++;
            } catch (error) {
                console.error(`파일 삭제 실패 (${job.job_id}):`, error);
                // 파일 삭제 실패해도 계속 진행
            }
        }
        
        await client.query('COMMIT');
        
        return deletedCount;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('만료된 파일 삭제 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 작업 정보 조회
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 * @returns {Promise<Object>} 작업 정보
 */
async function getJobInfo(db, jobId) {
    const result = await db.query(
        `SELECT job_id, user_id, title, description, file_name, file_size, 
                file_type, file_path, status, created_at, completed_at, expires_at
         FROM video_jobs 
         WHERE job_id = $1`,
        [jobId]
    );
    
    if (result.rows.length === 0) {
        return null;
    }
    
    return result.rows[0];
}

module.exports = {
    upload: upload.single('video'), // Multer 미들웨어
    handleVideoUpload,
    startProcessing,
    completeProcessing,
    failProcessing,
    deleteExpiredFiles,
    getJobInfo,
    storageAdapter
};



