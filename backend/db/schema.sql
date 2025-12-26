-- 영상 작업 테이블
CREATE TABLE IF NOT EXISTS video_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id),
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

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_created_at ON video_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_video_jobs_expires_at ON video_jobs(expires_at) WHERE expires_at IS NOT NULL;

-- 만료된 파일 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_video_jobs_expired ON video_jobs(status, expires_at) 
WHERE status = 'completed' AND expires_at IS NOT NULL;



