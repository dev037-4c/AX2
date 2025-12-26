// 보안 미들웨어 모음

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate Limiting 설정
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 10, // 최대 10회
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '너무 많은 업로드 요청이 있습니다. 잠시 후 다시 시도하세요.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100, // 최대 100회
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '너무 많은 요청이 있습니다. 잠시 후 다시 시도하세요.'
        }
    }
});

// JobId 검증 함수
function validateJobId(jobId) {
    if (!jobId || typeof jobId !== 'string') {
        throw new Error('Job ID가 필요합니다.');
    }
    
    // UUID 형식 검증 (36자, 하이픈 포함)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
        throw new Error('유효하지 않은 Job ID 형식입니다.');
    }
    
    // 경로 조작 문자 검증
    if (jobId.includes('..') || jobId.includes('/') || jobId.includes('\\')) {
        throw new Error('유효하지 않은 Job ID입니다.');
    }
    
    return jobId;
}

// 파일 확장자 검증
function validateFileExtension(filename) {
    const allowedExts = ['.mp4', '.mov', '.avi', '.wmv'];
    const ext = require('path').extname(filename).toLowerCase();
    
    if (!allowedExts.includes(ext)) {
        throw new Error('지원하지 않는 파일 확장자입니다.');
    }
    
    return ext;
}

// 입력 검증 미들웨어
function validateInput(req, res, next) {
    // jobId 파라미터 검증
    if (req.params.id) {
        try {
            req.params.id = validateJobId(req.params.id);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: error.message
                }
            });
        }
    }
    
    // 쿼리 파라미터 검증
    if (req.query.status) {
        const allowedStatuses = ['all', 'processing', 'completed', 'expiring'];
        if (!allowedStatuses.includes(req.query.status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: '유효하지 않은 상태 값입니다.'
                }
            });
        }
    }
    
    if (req.query.format) {
        const allowedFormats = ['srt', 'vtt', 'json'];
        if (!allowedFormats.includes(req.query.format)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: '유효하지 않은 형식입니다.'
                }
            });
        }
    }
    
    // limit, offset 검증
    if (req.query.limit) {
        const limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit < 1 || limit > 1000) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'limit은 1-1000 사이의 값이어야 합니다.'
                }
            });
        }
    }
    
    if (req.query.offset) {
        const offset = parseInt(req.query.offset);
        if (isNaN(offset) || offset < 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'offset은 0 이상의 값이어야 합니다.'
                }
            });
        }
    }
    
    next();
}

// 에러 핸들링 미들웨어 (정보 노출 방지)
function errorHandler(error, req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    console.error('에러 발생:', {
        message: error.message,
        stack: isProduction ? undefined : error.stack,
        path: req.path,
        method: req.method
    });
    
    res.status(error.status || 500).json({
        success: false,
        error: {
            code: error.code || 'SERVER_ERROR',
            message: isProduction 
                ? '서버 오류가 발생했습니다.' 
                : error.message
        }
    });
}

module.exports = {
    uploadLimiter,
    apiLimiter,
    validateJobId,
    validateFileExtension,
    validateInput,
    errorHandler,
    helmet
};


