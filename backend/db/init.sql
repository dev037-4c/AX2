-- AX2 Caption 데이터베이스 초기화 스크립트
-- PostgreSQL 데이터베이스 스키마 생성

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100) NOT NULL,
    picture TEXT,
    provider VARCHAR(20) NOT NULL DEFAULT 'email',
    provider_id VARCHAR(255),
    marketing_agree BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

-- 사용자 세션 테이블
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at TIMESTAMP NOT NULL,
    refresh_token_expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);

-- 크레딧 테이블
CREATE TABLE IF NOT EXISTS credits (
    credit_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    free_balance INTEGER NOT NULL DEFAULT 0,
    total_charged INTEGER NOT NULL DEFAULT 0,
    device_id VARCHAR(255),
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(device_id),
    UNIQUE(ip_address)
);

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_device_id ON credits(device_id);

-- 크레딧 예약 테이블
CREATE TABLE IF NOT EXISTS credit_reservations (
    reservation_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    job_id VARCHAR(50),
    amount INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',
    reserved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_id ON credit_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_job_id ON credit_reservations(job_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_status ON credit_reservations(status);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_expires_at ON credit_reservations(expires_at);

-- 크레딧 사용 내역 테이블
CREATE TABLE IF NOT EXISTS credit_history (
    history_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description VARCHAR(255),
    job_id VARCHAR(50),
    payment_id VARCHAR(50),
    reservation_id VARCHAR(50) REFERENCES credit_reservations(reservation_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_history_user_id ON credit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_history_type ON credit_history(type);
CREATE INDEX IF NOT EXISTS idx_credit_history_created_at ON credit_history(created_at);

-- 영상 작업 테이블
CREATE TABLE IF NOT EXISTS video_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT status_check CHECK (status IN ('uploaded', 'processing', 'completed', 'failed', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_created_at ON video_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_video_jobs_expires_at ON video_jobs(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_jobs_expired ON video_jobs(status, expires_at) 
    WHERE status = 'completed' AND expires_at IS NOT NULL;

-- 작업 테이블
CREATE TABLE IF NOT EXISTS jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    video_id VARCHAR(50) REFERENCES video_jobs(job_id) ON DELETE SET NULL,
    video_file_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    current_step VARCHAR(50),
    original_language VARCHAR(10),
    detected_language VARCHAR(10),
    speakers INTEGER DEFAULT 1,
    required_credits INTEGER NOT NULL,
    used_credits INTEGER,
    is_free_trial BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    error_code VARCHAR(50),
    reservation_id VARCHAR(50) REFERENCES credit_reservations(reservation_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT job_status_check CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- 자막 테이블
CREATE TABLE IF NOT EXISTS subtitles (
    subtitle_id BIGSERIAL PRIMARY KEY,
    video_id VARCHAR(50) REFERENCES video_jobs(job_id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    is_original BOOLEAN DEFAULT FALSE,
    segment_index INTEGER NOT NULL,
    start_time DECIMAL(10, 3) NOT NULL,
    end_time DECIMAL(10, 3) NOT NULL,
    text TEXT NOT NULL,
    speaker_id INTEGER,
    speaker_name VARCHAR(100),
    confidence DECIMAL(5, 2),
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtitles_video_id ON subtitles(video_id, language_code);
CREATE INDEX IF NOT EXISTS idx_subtitles_segment_index ON subtitles(video_id, language_code, segment_index);

-- 사용자 활동 로그 테이블
CREATE TABLE IF NOT EXISTS user_activities (
    activity_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);

-- 보안 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS security_events (
    event_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_category ON security_events(event_category);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- 초기 데이터 (선택사항)
-- 관리자 계정 생성 등



