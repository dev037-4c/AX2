-- AX2 Caption 데이터베이스 초기화 스크립트

CREATE DATABASE IF NOT EXISTS ax2_caption DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ax2_caption;

-- video_jobs 테이블
CREATE TABLE IF NOT EXISTS video_jobs (
    id            CHAR(36) PRIMARY KEY,
    user_id       BIGINT NULL,
    title         VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    video_path    VARCHAR(500) NOT NULL,
    size          BIGINT NULL,
    status        ENUM('uploaded', 'queued', 'processing', 'completed', 'failed', 'deleted') NOT NULL DEFAULT 'uploaded',
    progress      INT DEFAULT 0,
    error_message TEXT NULL,
    retry_count   INT DEFAULT 0,
    
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at  DATETIME NULL,
    expires_at    DATETIME NULL,
    deleted_at    DATETIME NULL,
    
    INDEX idx_status (status),
    INDEX idx_expires (expires_at),
    INDEX idx_created (created_at),
    INDEX idx_user_id (user_id),
    INDEX idx_size (size)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- job_results 테이블 (자막 결과 파일 메타)
CREATE TABLE IF NOT EXISTS job_results (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id     CHAR(36) NOT NULL,
    format     ENUM('json', 'srt', 'vtt', 'ass') NOT NULL,
    file_path  VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uq_job_format (job_id, format),
    CONSTRAINT fk_results_job FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE,
    INDEX idx_job_id (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


