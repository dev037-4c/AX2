/**
 * 파일 업로드 검증 강화
 * 확장자 + MIME 타입 이중 체크
 */

const path = require('path');
const fs = require('fs');
const { AppError, ERROR_CODES } = require('./error-handler');

// 허용된 파일 확장자
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.wmv', '.mkv'];

// 허용된 MIME 타입
const ALLOWED_MIME_TYPES = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-matroska'
];

// 확장자와 MIME 타입 매핑
const EXTENSION_MIME_MAP = {
    '.mp4': ['video/mp4', 'video/mpeg'],
    '.mov': ['video/quicktime'],
    '.avi': ['video/x-msvideo'],
    '.wmv': ['video/x-ms-wmv'],
    '.mkv': ['video/x-matroska']
};

/**
 * 파일 확장자 검증
 */
function validateFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
        throw new AppError(
            ERROR_CODES.INVALID_INPUT.code,
            '파일명이 유효하지 않습니다.',
            ERROR_CODES.INVALID_INPUT.status
        );
    }
    
    const ext = path.extname(filename).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new AppError(
            ERROR_CODES.INVALID_FILE_TYPE.code,
            `지원하지 않는 파일 확장자입니다. 허용된 형식: ${ALLOWED_EXTENSIONS.join(', ')}`,
            ERROR_CODES.INVALID_FILE_TYPE.status
        );
    }
    
    return ext;
}

/**
 * MIME 타입 검증
 */
function validateMimeType(mimetype, filename) {
    if (!mimetype || typeof mimetype !== 'string') {
        throw new AppError(
            ERROR_CODES.INVALID_FILE_TYPE.code,
            '파일 형식을 확인할 수 없습니다.',
            ERROR_CODES.INVALID_FILE_TYPE.status
        );
    }
    
    // MIME 타입 기본 검증
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        throw new AppError(
            ERROR_CODES.INVALID_FILE_TYPE.code,
            `지원하지 않는 파일 형식입니다. 허용된 형식: ${ALLOWED_MIME_TYPES.join(', ')}`,
            ERROR_CODES.INVALID_FILE_TYPE.status
        );
    }
    
    // 확장자와 MIME 타입 일치 검증
    if (filename) {
        const ext = path.extname(filename).toLowerCase();
        const expectedMimes = EXTENSION_MIME_MAP[ext];
        
        if (expectedMimes && !expectedMimes.includes(mimetype)) {
            throw new AppError(
                ERROR_CODES.INVALID_FILE_TYPE.code,
                '파일 확장자와 실제 파일 형식이 일치하지 않습니다.',
                ERROR_CODES.INVALID_FILE_TYPE.status
            );
        }
    }
    
    return true;
}

/**
 * 파일 크기 검증
 */
function validateFileSize(size, maxSize = 2 * 1024 * 1024 * 1024) {
    if (size > maxSize) {
        const maxSizeMB = Math.round(maxSize / 1024 / 1024);
        throw new AppError(
            ERROR_CODES.FILE_TOO_LARGE.code,
            `파일 크기가 ${maxSizeMB}MB를 초과합니다.`,
            ERROR_CODES.FILE_TOO_LARGE.status
        );
    }
    
    return true;
}

/**
 * 파일명 정제 (보안)
 * 원본 파일명은 DB에만 저장하고, 실제 저장은 UUID 사용
 */
function sanitizeFilename(originalName) {
    // 위험한 문자 제거
    const sanitized = originalName
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\.\./g, '')
        .trim();
    
    // 최대 길이 제한
    const maxLength = 255;
    if (sanitized.length > maxLength) {
        const ext = path.extname(sanitized);
        const nameWithoutExt = sanitized.substring(0, maxLength - ext.length);
        return nameWithoutExt + ext;
    }
    
    return sanitized;
}

/**
 * Multer 파일 필터 (이중 검증)
 */
function fileFilter(req, file, cb) {
    try {
        // 확장자 검증
        validateFileExtension(file.originalname);
        
        // MIME 타입 검증
        validateMimeType(file.mimetype, file.originalname);
        
        cb(null, true);
    } catch (error) {
        cb(error, false);
    }
}

module.exports = {
    validateFileExtension,
    validateMimeType,
    validateFileSize,
    sanitizeFilename,
    fileFilter,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES
};


