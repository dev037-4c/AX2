#!/bin/bash
# 디스크 용량 모니터링 스크립트
# 사용법: ./check-disk-usage.sh [경고 임계값] [위험 임계값]

# 기본값 설정
WARNING_THRESHOLD=${1:-80}  # 기본 80%
CRITICAL_THRESHOLD=${2:-90} # 기본 90%

# 모니터링 대상 경로 (환경변수 또는 기본값)
MONITOR_PATH=${MONITOR_PATH:-/data/lx2/ax2-caption-storage}
LOG_FILE=${LOG_FILE:-/var/log/ax2-caption/disk-usage.log}

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"

# 로그 함수
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# 디스크 사용률 확인
check_disk_usage() {
    local path=$1
    
    # 경로 존재 확인
    if [ ! -d "$path" ]; then
        log_message "ERROR" "경로가 존재하지 않습니다: $path"
        return 1
    fi
    
    # 디스크 사용률 계산
    local usage=$(df -h "$path" | awk 'NR==2 {print $5}' | sed 's/%//')
    local total=$(df -h "$path" | awk 'NR==2 {print $2}')
    local used=$(df -h "$path" | awk 'NR==2 {print $3}')
    local available=$(df -h "$path" | awk 'NR==2 {print $4}')
    
    log_message "INFO" "디스크 사용률: ${usage}% (사용: ${used}/${total}, 남은 공간: ${available})"
    
    # 경고/위험 레벨 확인
    if [ "$usage" -ge "$CRITICAL_THRESHOLD" ]; then
        log_message "CRITICAL" "디렉토리 사용률이 위험 수준입니다: ${usage}% (임계값: ${CRITICAL_THRESHOLD}%)"
        
        # 알림 전송 (슬랙/메일 등)
        send_alert "CRITICAL" "디스크 사용률이 ${usage}%에 도달했습니다. 즉시 조치가 필요합니다."
        
        return 2
    elif [ "$usage" -ge "$WARNING_THRESHOLD" ]; then
        log_message "WARNING" "디렉토리 사용률이 경고 수준입니다: ${usage}% (임계값: ${WARNING_THRESHOLD}%)"
        
        # 알림 전송
        send_alert "WARNING" "디스크 사용률이 ${usage}%에 도달했습니다. 모니터링이 필요합니다."
        
        return 1
    else
        log_message "INFO" "디스크 사용률이 정상 범위입니다: ${usage}%"
        return 0
    fi
}

# 알림 전송 함수 (슬랙 웹훅 예시)
send_alert() {
    local level=$1
    shift
    local message=$*
    
    # 슬랙 웹훅 URL (환경변수에서 가져오기)
    local slack_webhook=${SLACK_WEBHOOK_URL:-""}
    
    if [ -n "$slack_webhook" ]; then
        local color="good"
        if [ "$level" = "WARNING" ]; then
            color="warning"
        elif [ "$level" = "CRITICAL" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$level] AX2 Caption 디스크 모니터링\",\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\",\"fields\":[{\"title\":\"경로\",\"value\":\"$MONITOR_PATH\",\"short\":true},{\"title\":\"시간\",\"value\":\"$(date '+%Y-%m-%d %H:%M:%S')\",\"short\":true}]}]}" \
            "$slack_webhook" 2>/dev/null || true
    fi
    
    # 메일 알림 (선택적)
    local admin_email=${ADMIN_EMAIL:-""}
    if [ -n "$admin_email" ] && [ "$level" = "CRITICAL" ]; then
        echo "$message" | mail -s "[$level] AX2 Caption 디스크 경고" "$admin_email" 2>/dev/null || true
    fi
}

# 상세 디렉토리별 사용량 확인
check_directory_sizes() {
    local path=$1
    
    log_message "INFO" "디렉토리별 상세 사용량:"
    
    # 상위 10개 디렉토리
    du -h --max-depth=1 "$path" 2>/dev/null | sort -hr | head -10 | while read size dir; do
        log_message "INFO" "  $dir: $size"
    done
}

# 오래된 파일 확인 (30일 이상)
check_old_files() {
    local path=$1
    local days=${OLD_FILE_DAYS:-30}
    
    log_message "INFO" "$days일 이상 된 파일 확인 중..."
    
    local old_files=$(find "$path" -type f -mtime +$days 2>/dev/null | wc -l)
    local old_size=$(find "$path" -type f -mtime +$days -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    
    if [ "$old_files" -gt 0 ]; then
        log_message "INFO" "$days일 이상 된 파일: ${old_files}개 (총 ${old_size})"
    fi
}

# 메인 실행
main() {
    log_message "INFO" "=== 디스크 사용률 모니터링 시작 ==="
    log_message "INFO" "모니터링 경로: $MONITOR_PATH"
    log_message "INFO" "경고 임계값: ${WARNING_THRESHOLD}%, 위험 임계값: ${CRITICAL_THRESHOLD}%"
    
    # 디스크 사용률 확인
    check_disk_usage "$MONITOR_PATH"
    local result=$?
    
    # 상세 정보 (경고 이상일 때만)
    if [ $result -ge 1 ]; then
        check_directory_sizes "$MONITOR_PATH"
        check_old_files "$MONITOR_PATH"
    fi
    
    log_message "INFO" "=== 디스크 사용률 모니터링 완료 ==="
    
    return $result
}

# 스크립트 실행
main "$@"


