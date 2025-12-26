-- 사용자 및 크레딧 관련 테이블 추가 마이그레이션
-- MySQL/MariaDB 형식

USE ax2_caption;

-- users 테이블
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NULL,
    name VARCHAR(100) NOT NULL,
    picture TEXT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'email',
    provider_id VARCHAR(255) NULL,
    marketing_agree BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_at DATETIME NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    
    INDEX idx_email (email),
    INDEX idx_provider (provider, provider_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_sessions 테이블
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at DATETIME NOT NULL,
    refresh_token_expires_at DATETIME NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_refresh_token (refresh_token(255)),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- credits 테이블
CREATE TABLE IF NOT EXISTS credits (
    credit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NULL,
    balance INT NOT NULL DEFAULT 0,
    free_balance INT NOT NULL DEFAULT 0,
    total_charged INT NOT NULL DEFAULT 0,
    device_id VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uq_user_id (user_id),
    UNIQUE KEY uq_device_id (device_id),
    UNIQUE KEY uq_ip_address (ip_address),
    INDEX idx_user_id (user_id),
    INDEX idx_device_id (device_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- credit_reservations 테이블
CREATE TABLE IF NOT EXISTS credit_reservations (
    reservation_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NULL,
    job_id VARCHAR(50) NULL,
    amount INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',
    reserved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME NULL,
    refunded_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_job_id (job_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- credit_history 테이블
CREATE TABLE IF NOT EXISTS credit_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NULL,
    type VARCHAR(20) NOT NULL,
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    description VARCHAR(255) NULL,
    job_id VARCHAR(50) NULL,
    payment_id VARCHAR(50) NULL,
    reservation_id VARCHAR(50) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (reservation_id) REFERENCES credit_reservations(reservation_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- credit_packages 테이블
CREATE TABLE IF NOT EXISTS credit_packages (
    package_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    credits INT NOT NULL,
    bonus INT DEFAULT 0,
    price INT NOT NULL,
    currency VARCHAR(10) DEFAULT 'KRW',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_is_active (is_active),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments 테이블
CREATE TABLE IF NOT EXISTS payments (
    payment_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    package_id VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    currency VARCHAR(10) DEFAULT 'KRW',
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    pg_provider VARCHAR(50) NULL,
    pg_transaction_id VARCHAR(255) NULL,
    credits INT NOT NULL,
    bonus_credits INT DEFAULT 0,
    total_credits INT NOT NULL,
    receipt_url TEXT NULL,
    paid_at DATETIME NULL,
    refunded_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_package_id (package_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (package_id) REFERENCES credit_packages(package_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- subtitles 테이블 (자막 편집용)
CREATE TABLE IF NOT EXISTS subtitles (
    subtitle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    is_original BOOLEAN DEFAULT FALSE,
    segment_index INT NOT NULL,
    start_time DECIMAL(10, 3) NOT NULL,
    end_time DECIMAL(10, 3) NOT NULL,
    text TEXT NOT NULL,
    speaker_id INT NULL,
    speaker_name VARCHAR(100) NULL,
    confidence DECIMAL(5, 2) NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_job_id (job_id, language_code),
    INDEX idx_segment_index (job_id, language_code, segment_index),
    FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 크레딧 패키지 데이터 삽입
INSERT INTO credit_packages (package_id, name, credits, bonus, price, currency, is_active, display_order) VALUES
('package_1', '스타터', 1000, 100, 10000, 'KRW', TRUE, 1),
('package_2', '프로', 5000, 500, 45000, 'KRW', TRUE, 2),
('package_3', '엔터프라이즈', 10000, 1500, 80000, 'KRW', TRUE, 3)
ON DUPLICATE KEY UPDATE name=name;


