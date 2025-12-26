#!/bin/bash
# systemd 서비스 등록 스크립트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
API_DIR="$PROJECT_DIR/ax2-api"
SERVICE_NAME="ax2-caption-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "=========================================="
echo "AX2 Caption API systemd 서비스 등록"
echo "=========================================="
echo ""

# 현재 사용자 확인
CURRENT_USER=$(whoami)
echo "현재 사용자: $CURRENT_USER"
echo "프로젝트 디렉토리: $PROJECT_DIR"
echo "API 디렉토리: $API_DIR"
echo ""

# Node.js 경로 확인
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "❌ Node.js를 찾을 수 없습니다."
    echo "Node.js를 설치하세요: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js 경로: $NODE_PATH"
echo ""

# .env 파일 확인
if [ ! -f "$API_DIR/.env" ]; then
    echo "⚠️  .env 파일이 없습니다."
    echo "env.example을 복사하여 .env 파일을 생성하세요:"
    echo "  cd $API_DIR"
    echo "  cp env.example .env"
    echo "  nano .env"
    read -p "계속하시겠습니까? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 서비스 파일 생성
echo "서비스 파일 생성 중..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=AX2 Caption API Server
After=network.target mysql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$API_DIR
Environment="NODE_ENV=production"
EnvironmentFile=$API_DIR/.env
ExecStart=$NODE_PATH $API_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

if [ $? -eq 0 ]; then
    echo "✅ 서비스 파일 생성 완료: $SERVICE_FILE"
else
    echo "❌ 서비스 파일 생성 실패"
    exit 1
fi

echo ""

# systemd 재로드
echo "systemd 재로드 중..."
sudo systemctl daemon-reload
if [ $? -eq 0 ]; then
    echo "✅ systemd 재로드 완료"
else
    echo "❌ systemd 재로드 실패"
    exit 1
fi

echo ""

# 서비스 활성화
echo "서비스 활성화 중..."
sudo systemctl enable "$SERVICE_NAME"
if [ $? -eq 0 ]; then
    echo "✅ 서비스 자동 시작 설정 완료"
else
    echo "❌ 서비스 활성화 실패"
    exit 1
fi

echo ""

# 서비스 시작
read -p "서비스를 지금 시작하시겠습니까? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "서비스 시작 중..."
    sudo systemctl start "$SERVICE_NAME"
    sleep 2
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✅ 서비스 시작 완료"
        echo ""
        echo "서비스 상태:"
        sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -10
    else
        echo "❌ 서비스 시작 실패"
        echo ""
        echo "로그 확인:"
        echo "  sudo journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "설정 완료"
echo "=========================================="
echo ""
echo "유용한 명령어:"
echo "  서비스 상태 확인: sudo systemctl status $SERVICE_NAME"
echo "  서비스 시작:      sudo systemctl start $SERVICE_NAME"
echo "  서비스 중지:      sudo systemctl stop $SERVICE_NAME"
echo "  서비스 재시작:    sudo systemctl restart $SERVICE_NAME"
echo "  로그 확인:        sudo journalctl -u $SERVICE_NAME -f"
echo ""


