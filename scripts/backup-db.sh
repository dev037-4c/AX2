#!/bin/bash
# 데이터베이스 백업 스크립트
# 매일 실행하여 DB 백업

# 설정
DB_HOST=${DB_HOST:-127.0.0.1}
DB_USER=${DB_USER:-ax2}
DB_NAME=${DB_NAME:-ax2_caption}
BACKUP_DIR=${BACKUP_DIR:-/data/lx2/backups/ax2-caption}
RETENTION_DAYS=${RETENTION_DAYS:-30}  # 30일 보관

# 로그 파일
LOG_FILE=${LOG_FILE:-/var/log/ax2-caption/backup.log}

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# 로그 함수
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# DB 비밀번호 입력 (보안)
read -sp "DB 비밀번호: " DB_PASS
echo

# 백업 파일명
BACKUP_FILE="$BACKUP_DIR/ax2_caption_$(date +%Y%m%d_%H%M%S).sql"

# 백업 실행
backup_database() {
    log_message "INFO" "=== 데이터베이스 백업 시작 ==="
    log_message "INFO" "백업 대상: $DB_NAME"
    log_message "INFO" "백업 파일: $BACKUP_FILE"
    
    # mysqldump 실행
    if mysqldump -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        "$DB_NAME" > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
        
        # 압축
        if command -v gzip &> /dev/null; then
            gzip "$BACKUP_FILE"
            BACKUP_FILE="${BACKUP_FILE}.gz"
            log_message "INFO" "백업 파일 압축 완료: $BACKUP_FILE"
        fi
        
        # 파일 크기 확인
        local file_size=$(du -h "$BACKUP_FILE" | cut -f1)
        log_message "INFO" "백업 완료: $BACKUP_FILE (크기: $file_size)"
        
        # 백업 검증 (선택적)
        if [ -f "$BACKUP_FILE" ]; then
            log_message "INFO" "백업 파일 검증 성공"
            return 0
        else
            log_message "ERROR" "백업 파일이 생성되지 않았습니다."
            return 1
        fi
    else
        log_message "ERROR" "백업 실패"
        return 1
    fi
}

# 오래된 백업 파일 삭제
cleanup_old_backups() {
    log_message "INFO" "오래된 백업 파일 정리 중... (보관 기간: ${RETENTION_DAYS}일)"
    
    local deleted_count=0
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            rm -f "$file"
            deleted_count=$((deleted_count + 1))
            log_message "INFO" "삭제: $file"
        fi
    done < <(find "$BACKUP_DIR" -name "ax2_caption_*.sql*" -type f -mtime +$RETENTION_DAYS)
    
    if [ "$deleted_count" -gt 0 ]; then
        log_message "INFO" "총 ${deleted_count}개의 오래된 백업 파일 삭제 완료"
    else
        log_message "INFO" "삭제할 오래된 백업 파일 없음"
    fi
}

# 백업 통계
show_backup_stats() {
    log_message "INFO" "=== 백업 통계 ==="
    
    local total_backups=$(find "$BACKUP_DIR" -name "ax2_caption_*.sql*" -type f | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    
    log_message "INFO" "총 백업 파일: ${total_backups}개"
    log_message "INFO" "총 백업 크기: ${total_size}"
    
    # 최근 백업 파일 목록
    log_message "INFO" "최근 백업 파일 (최대 5개):"
    find "$BACKUP_DIR" -name "ax2_caption_*.sql*" -type f -printf "%T@ %p\n" | \
        sort -rn | head -5 | while read timestamp file; do
            local date_str=$(date -d "@${timestamp}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "${timestamp}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
            local size=$(du -h "$file" | cut -f1)
            log_message "INFO" "  $date_str - $file (${size})"
        done
}

# 메인 실행
main() {
    if backup_database; then
        cleanup_old_backups
        show_backup_stats
        log_message "INFO" "=== 데이터베이스 백업 완료 ==="
        return 0
    else
        log_message "ERROR" "=== 데이터베이스 백업 실패 ==="
        return 1
    fi
}

# 스크립트 실행
main "$@"


