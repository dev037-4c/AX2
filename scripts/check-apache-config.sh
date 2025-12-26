#!/bin/bash
# Apache 설정 점검 스크립트
# 업로드 크기 제한, 타임아웃, SSL 등 확인

LOG_FILE=${LOG_FILE:-/var/log/ax2-caption/apache-check.log}

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"

# 로그 함수
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Apache 설정 파일 경로
APACHE_CONF=${APACHE_CONF:-/etc/apache2/apache2.conf}
APACHE_VHOST=${APACHE_VHOST:-/etc/apache2/sites-available/lx2.kr.conf}

# Apache 설정 확인
check_apache_config() {
    log_message "INFO" "=== Apache 설정 점검 시작 ==="
    
    # Apache 설정 파일 존재 확인
    if [ ! -f "$APACHE_CONF" ]; then
        log_message "WARNING" "Apache 설정 파일을 찾을 수 없습니다: $APACHE_CONF"
    fi
    
    # VirtualHost 설정 파일 확인
    if [ ! -f "$APACHE_VHOST" ]; then
        log_message "WARNING" "VirtualHost 설정 파일을 찾을 수 없습니다: $APACHE_VHOST"
    fi
    
    # 1. 업로드 크기 제한 확인
    check_upload_limit
    
    # 2. 타임아웃 설정 확인
    check_timeout_settings
    
    # 3. SSL 인증서 확인
    check_ssl_certificate
    
    # 4. 프록시 설정 확인
    check_proxy_settings
    
    # 5. 보안 헤더 확인
    check_security_headers
    
    log_message "INFO" "=== Apache 설정 점검 완료 ==="
}

# 업로드 크기 제한 확인
check_upload_limit() {
    log_message "INFO" "업로드 크기 제한 확인 중..."
    
    local limit_body_size=$(grep -i "LimitRequestBody" "$APACHE_CONF" "$APACHE_VHOST" 2>/dev/null | head -1 | awk '{print $2}')
    
    if [ -z "$limit_body_size" ]; then
        log_message "WARNING" "LimitRequestBody가 설정되지 않았습니다. 기본값(무제한)이 적용됩니다."
        log_message "INFO" "권장: LimitRequestBody 2147483648 (2GB)"
    else
        local limit_mb=$((limit_body_size / 1024 / 1024))
        log_message "INFO" "LimitRequestBody: ${limit_mb}MB ($limit_body_size bytes)"
        
        if [ "$limit_body_size" -lt 2147483648 ]; then
            log_message "WARNING" "업로드 크기 제한이 2GB 미만입니다. 대용량 파일 업로드에 문제가 있을 수 있습니다."
        fi
    fi
    
    # PHP 업로드 제한 확인 (PHP 사용 시)
    if command -v php &> /dev/null; then
        local php_upload_max=$(php -i 2>/dev/null | grep "upload_max_filesize" | awk '{print $3}')
        local php_post_max=$(php -i 2>/dev/null | grep "post_max_size" | awk '{print $3}')
        
        if [ -n "$php_upload_max" ]; then
            log_message "INFO" "PHP upload_max_filesize: $php_upload_max"
        fi
        if [ -n "$php_post_max" ]; then
            log_message "INFO" "PHP post_max_size: $php_post_max"
        fi
    fi
}

# 타임아웃 설정 확인
check_timeout_settings() {
    log_message "INFO" "타임아웃 설정 확인 중..."
    
    local timeout=$(grep -i "Timeout" "$APACHE_CONF" 2>/dev/null | head -1 | awk '{print $2}')
    
    if [ -z "$timeout" ]; then
        log_message "WARNING" "Timeout이 설정되지 않았습니다. 기본값(60초)이 적용됩니다."
    else
        log_message "INFO" "Timeout: ${timeout}초"
        
        if [ "$timeout" -lt 300 ]; then
            log_message "WARNING" "타임아웃이 300초 미만입니다. 대용량 파일 업로드 시 문제가 있을 수 있습니다."
            log_message "INFO" "권장: Timeout 600 (10분)"
        fi
    fi
    
    # 프록시 타임아웃 확인
    local proxy_timeout=$(grep -i "ProxyTimeout" "$APACHE_VHOST" 2>/dev/null | head -1 | awk '{print $2}')
    
    if [ -z "$proxy_timeout" ]; then
        log_message "WARNING" "ProxyTimeout이 설정되지 않았습니다."
        log_message "INFO" "권장: ProxyTimeout 600"
    else
        log_message "INFO" "ProxyTimeout: ${proxy_timeout}초"
    fi
}

# SSL 인증서 확인
check_ssl_certificate() {
    log_message "INFO" "SSL 인증서 확인 중..."
    
    # VirtualHost에서 SSL 인증서 경로 추출
    local cert_file=$(grep -i "SSLCertificateFile" "$APACHE_VHOST" 2>/dev/null | head -1 | awk '{print $2}')
    
    if [ -z "$cert_file" ]; then
        log_message "INFO" "SSL 인증서가 설정되지 않았거나 HTTP만 사용 중입니다."
        return
    fi
    
    if [ ! -f "$cert_file" ]; then
        log_message "ERROR" "SSL 인증서 파일을 찾을 수 없습니다: $cert_file"
        return
    fi
    
    # 인증서 만료일 확인
    local expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$expiry_date" ]; then
        local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s 2>/dev/null)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        log_message "INFO" "SSL 인증서 만료일: $expiry_date"
        
        if [ "$days_until_expiry" -lt 0 ]; then
            log_message "CRITICAL" "SSL 인증서가 만료되었습니다!"
            send_alert "CRITICAL" "SSL 인증서가 만료되었습니다. 즉시 갱신이 필요합니다."
        elif [ "$days_until_expiry" -lt 30 ]; then
            log_message "WARNING" "SSL 인증서가 ${days_until_expiry}일 후 만료됩니다."
            send_alert "WARNING" "SSL 인증서가 ${days_until_expiry}일 후 만료됩니다. 갱신을 준비하세요."
        else
            log_message "INFO" "SSL 인증서가 ${days_until_expiry}일 후 만료됩니다. (정상)"
        fi
    fi
}

# 프록시 설정 확인
check_proxy_settings() {
    log_message "INFO" "프록시 설정 확인 중..."
    
    # /api 프록시 설정 확인
    local proxy_pass=$(grep -A 5 "ProxyPass.*/api" "$APACHE_VHOST" 2>/dev/null | head -5)
    
    if [ -z "$proxy_pass" ]; then
        log_message "WARNING" "/api 프록시 설정을 찾을 수 없습니다."
    else
        log_message "INFO" "/api 프록시 설정이 확인되었습니다:"
        echo "$proxy_pass" | while read line; do
            log_message "INFO" "  $line"
        done
    fi
}

# 보안 헤더 확인
check_security_headers() {
    log_message "INFO" "보안 헤더 설정 확인 중..."
    
    local headers_module=$(apache2ctl -M 2>/dev/null | grep headers)
    
    if [ -z "$headers_module" ]; then
        log_message "WARNING" "headers 모듈이 활성화되지 않았습니다."
        log_message "INFO" "권장: a2enmod headers"
    else
        log_message "INFO" "headers 모듈이 활성화되어 있습니다."
    fi
    
    # 보안 헤더 설정 확인
    local security_headers=("X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection" "Strict-Transport-Security")
    
    for header in "${security_headers[@]}"; do
        local header_set=$(grep -i "$header" "$APACHE_VHOST" 2>/dev/null)
        if [ -z "$header_set" ]; then
            log_message "WARNING" "$header 헤더가 설정되지 않았습니다."
        else
            log_message "INFO" "$header 헤더가 설정되어 있습니다."
        fi
    done
}

# 알림 전송
send_alert() {
    local level=$1
    shift
    local message=$*
    
    # 슬랙 웹훅 (선택적)
    local slack_webhook=${SLACK_WEBHOOK_URL:-""}
    if [ -n "$slack_webhook" ]; then
        local color="warning"
        if [ "$level" = "CRITICAL" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$level] Apache 설정 점검\",\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$slack_webhook" 2>/dev/null || true
    fi
}

# 메인 실행
main() {
    check_apache_config
}

# 스크립트 실행
main "$@"


