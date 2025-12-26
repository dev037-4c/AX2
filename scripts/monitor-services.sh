#!/bin/bash
# 서비스 모니터링 스크립트
# API 서버, 워커 프로세스 다운 감지 및 알림

LOG_FILE=${LOG_FILE:-/var/log/ax2-caption/service-monitor.log}
SERVICES=("ax2-caption-api" "ax2-caption-worker")

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"

# 로그 함수
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# 알림 전송
send_alert() {
    local level=$1
    shift
    local message=$*
    
    # 슬랙 웹훅 (선택적)
    local slack_webhook=${SLACK_WEBHOOK_URL:-""}
    if [ -n "$slack_webhook" ]; then
        local color="danger"
        if [ "$level" = "WARNING" ]; then
            color="warning"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$level] AX2 Caption 서비스 모니터링\",\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$slack_webhook" 2>/dev/null || true
    fi
    
    # 이메일 알림 (위험 레벨만)
    local admin_email=${ADMIN_EMAIL:-""}
    if [ -n "$admin_email" ] && [ "$level" = "CRITICAL" ]; then
        echo "$message" | mail -s "[$level] AX2 Caption 서비스 다운" "$admin_email" 2>/dev/null || true
    fi
}

# 서비스 상태 확인
check_service() {
    local service=$1
    
    if systemctl is-active --quiet "$service"; then
        log_message "INFO" "서비스 정상: $service"
        return 0
    else
        log_message "CRITICAL" "서비스 다운: $service"
        
        # 서비스 상태 상세 정보
        local status=$(systemctl status "$service" --no-pager -l 2>&1 | head -20)
        log_message "INFO" "서비스 상태:\n$status"
        
        # 자동 재시작 시도
        log_message "INFO" "서비스 재시작 시도: $service"
        if systemctl restart "$service"; then
            sleep 2
            if systemctl is-active --quiet "$service"; then
                log_message "INFO" "서비스 재시작 성공: $service"
                send_alert "WARNING" "서비스 $service가 다운되었지만 자동으로 재시작되었습니다."
                return 0
            else
                log_message "CRITICAL" "서비스 재시작 실패: $service"
                send_alert "CRITICAL" "서비스 $service가 다운되었고 재시작에 실패했습니다. 즉시 확인이 필요합니다."
                return 1
            fi
        else
            log_message "CRITICAL" "서비스 재시작 명령 실패: $service"
            send_alert "CRITICAL" "서비스 $service가 다운되었고 재시작 명령이 실패했습니다."
            return 1
        fi
    fi
}

# 포트 확인
check_port() {
    local port=$1
    local service=$2
    
    if ss -lntp | grep -q ":$port "; then
        log_message "INFO" "포트 $port 리스닝 중 (서비스: $service)"
        return 0
    else
        log_message "WARNING" "포트 $port가 리스닝되지 않음 (서비스: $service)"
        return 1
    fi
}

# API 헬스 체크
check_api_health() {
    local health_url="http://localhost:3000/api/health"
    
    if command -v curl &> /dev/null; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$health_url" 2>/dev/null)
        if [ "$response" = "200" ]; then
            log_message "INFO" "API 헬스 체크 성공"
            return 0
        else
            log_message "WARNING" "API 헬스 체크 실패 (HTTP $response)"
            return 1
        fi
    else
        log_message "WARNING" "curl이 설치되지 않아 API 헬스 체크를 건너뜁니다."
        return 0
    fi
}

# 메인 실행
main() {
    log_message "INFO" "=== 서비스 모니터링 시작 ==="
    
    local failed_services=()
    
    # 각 서비스 확인
    for service in "${SERVICES[@]}"; do
        if ! check_service "$service"; then
            failed_services+=("$service")
        fi
    done
    
    # 포트 확인
    check_port 3000 "ax2-caption-api"
    
    # API 헬스 체크
    check_api_health
    
    # 결과 요약
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_message "INFO" "=== 모든 서비스 정상 ==="
        return 0
    else
        log_message "CRITICAL" "=== 실패한 서비스: ${failed_services[*]} ==="
        return 1
    fi
}

# 스크립트 실행
main "$@"


