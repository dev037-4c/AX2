-- DB 스키마 추가 필드 마이그레이션
-- retry_count, size 필드 추가

USE ax2_caption;

-- video_jobs 테이블에 필드 추가
ALTER TABLE video_jobs 
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0 AFTER error_message,
ADD COLUMN IF NOT EXISTS size BIGINT NULL AFTER video_path;

-- size 필드에 인덱스 추가 (쿼터 계산용)
CREATE INDEX IF NOT EXISTS idx_size ON video_jobs(size);

-- 기존 데이터의 size 업데이트 (파일 크기 계산)
-- 주의: 실제 파일이 존재하는 경우에만 업데이트
-- 이 쿼리는 수동으로 실행하거나 별도 스크립트로 처리


