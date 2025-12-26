#!/bin/bash
# 배포 롤백 스크립트
# Git 기반 배포 실패 시 이전 버전으로 복구

set -e

# 설정
PROJECT_DIR=${PROJECT_DIR:-/data/lx2/ax2-caption-api}
BACKUP_DIR=${BACKUP_DIR:-/data/lx2/backups/deployments}
SERVICE_NAME=${SERVICE_NAME:-ax2-caption-api}

# 로그 파일
LOG_FILE=${LOG_FILE:-/var/log/ax2-caption/rollback.log}

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# 로그 함수
log_message() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# 롤백 실행
rollback() {
    local target_version=$1
    
    log_message "INFO" "=== 배포 롤백 시작 ==="
    log_message "INFO" "대상 버전: ${target_version:-'이전 커밋'}"
    log_message "INFO" "프로젝트 디렉토리: $PROJECT_DIR"
    
    # 디렉토리 확인
    if [ ! -d "$PROJECT_DIR" ]; then
        log_message "ERROR" "프로젝트 디렉토리를 찾을 수 없습니다: $PROJECT_DIR"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Git 저장소 확인
    if [ ! -d ".git" ]; then
        log_message "ERROR" "Git 저장소가 아닙니다: $PROJECT_DIR"
        return 1
    fi
    
    # 현재 버전 백업
    local current_commit=$(git rev-parse HEAD)
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)_${current_commit:0:8}"
    
    log_message "INFO" "현재 버전 백업: $backup_name"
    tar -czf "$BACKUP_DIR/$backup_name.tar.gz" . 2>/dev/null || true
    
    # 이전 커밋으로 롤백
    if [ -n "$target_version" ]; then
        log_message "INFO" "지정된 버전으로 롤백: $target_version"
        git checkout "$target_version" || {
            log_message "ERROR" "버전 체크아웃 실패: $target_version"
            return 1
        }
    else
        log_message "INFO" "이전 커밋으로 롤백"
        git checkout HEAD~1 || {
            log_message "ERROR" "이전 커밋으로 롤백 실패"
            return 1
        }
    fi
    
    local new_commit=$(git rev-parse HEAD)
    log_message "INFO" "롤백 완료: $current_commit -> $new_commit"
    
    # 패키지 재설치 (필요 시)
    if [ -f "package.json" ]; then
        log_message "INFO" "의존성 재설치 중..."
        npm install --production 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # 서비스 재시작
    log_message "INFO" "서비스 재시작 중..."
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl restart "$SERVICE_NAME" || {
            log_message "ERROR" "서비스 재시작 실패"
            return 1
        }
        
        # 서비스 상태 확인
        sleep 2
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            log_message "INFO" "서비스 재시작 성공"
        else
            log_message "ERROR" "서비스가 정상적으로 시작되지 않았습니다"
            return 1
        fi
    else
        log_message "WARNING" "서비스가 실행 중이 아닙니다"
    fi
    
    log_message "INFO" "=== 배포 롤백 완료 ==="
    return 0
}

# 사용법 표시
usage() {
    echo "사용법: $0 [버전/커밋 해시]"
    echo ""
    echo "예시:"
    echo "  $0              # 이전 커밋으로 롤백"
    echo "  $0 v1.0.0      # 특정 태그로 롤백"
    echo "  $0 abc1234      # 특정 커밋으로 롤백"
    echo ""
    echo "백업 위치: $BACKUP_DIR"
}

# 메인 실행
main() {
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        usage
        return 0
    fi
    
    rollback "$1"
}

# 스크립트 실행
main "$@"


