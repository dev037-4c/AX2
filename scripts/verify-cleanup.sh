#!/bin/bash
# 만료 삭제 검증 스크립트
# 스케줄러가 제대로 동작하는지 확인

LOG_FILE=${LOG_FILE:-/var/log/ax2-caption/cleanup-verify.log}
DB_HOST=${DB_HOST:-127.0.0.1}
DB_USER=${DB_USER:-ax2}
DB_NAME=${DB_NAME:-ax2_caption}

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"

# 로그 함수
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# DB 비밀번호 입력 (보안)
read -sp "DB 비밀번호: " DB_PASS
echo

# 만료된 Job 확인
check_expired_jobs() {
    log_message "INFO" "=== 만료 삭제 검증 시작 ==="
    
    # 1. 만료되었지만 아직 삭제되지 않은 Job 확인
    local expired_not_deleted=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "
        SELECT COUNT(*) 
        FROM video_jobs 
        WHERE status = 'completed' 
        AND expires_at IS NOT NULL 
        AND expires_at < NOW() 
        AND status != 'deleted'
    " 2>/dev/null)
    
    if [ "$expired_not_deleted" -gt 0 ]; then
        log_message "WARNING" "만료되었지만 아직 삭제되지 않은 Job: ${expired_not_deleted}개"
        
        # 상세 정보
        mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
            SELECT id, title, expires_at, TIMESTAMPDIFF(DAY, expires_at, NOW()) as days_expired
            FROM video_jobs 
            WHERE status = 'completed' 
            AND expires_at IS NOT NULL 
            AND expires_at < NOW() 
            AND status != 'deleted'
            ORDER BY expires_at ASC
            LIMIT 10
        " 2>/dev/null | tee -a "$LOG_FILE"
    else
        log_message "INFO" "만료되었지만 삭제되지 않은 Job 없음 (정상)"
    fi
    
    # 2. 삭제된 Job의 파일이 실제로 존재하는지 확인
    local deleted_with_files=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "
        SELECT COUNT(*) 
        FROM video_jobs 
        WHERE status = 'deleted' 
        AND video_path IS NOT NULL
    " 2>/dev/null)
    
    if [ "$deleted_with_files" -gt 0 ]; then
        log_message "WARNING" "삭제 상태이지만 파일 경로가 남아있는 Job: ${deleted_with_files}개"
        
        # 파일 존재 여부 확인
        local files_exist=0
        while IFS= read -r file_path; do
            if [ -f "$file_path" ]; then
                files_exist=$((files_exist + 1))
                log_message "WARNING" "삭제된 Job의 파일이 아직 존재: $file_path"
            fi
        done < <(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "
            SELECT video_path 
            FROM video_jobs 
            WHERE status = 'deleted' 
            AND video_path IS NOT NULL
            LIMIT 10
        " 2>/dev/null)
        
        if [ "$files_exist" -eq 0 ]; then
            log_message "INFO" "삭제된 Job의 파일이 모두 정리되었습니다."
        fi
    fi
    
    # 3. 만료 예정 Job 확인 (D-3)
    local expiring_soon=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "
        SELECT COUNT(*) 
        FROM video_jobs 
        WHERE status = 'completed' 
        AND expires_at IS NOT NULL 
        AND expires_at > NOW() 
        AND expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)
    " 2>/dev/null)
    
    if [ "$expiring_soon" -gt 0 ]; then
        log_message "INFO" "3일 이내 만료 예정 Job: ${expiring_soon}개"
    fi
    
    # 4. 스케줄러 실행 시간 확인 (마지막 정리 시간)
    log_message "INFO" "=== 만료 삭제 검증 완료 ==="
}

# 통계 정보
show_statistics() {
    log_message "INFO" "=== Job 통계 ==="
    
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
        SELECT 
            status,
            COUNT(*) as count,
            SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 ELSE 0 END) as expired_count
        FROM video_jobs
        GROUP BY status
        ORDER BY count DESC
    " 2>/dev/null | tee -a "$LOG_FILE"
}

# 메인 실행
main() {
    check_expired_jobs
    show_statistics
}

# 스크립트 실행
main "$@"


