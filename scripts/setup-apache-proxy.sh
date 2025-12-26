#!/bin/bash
# Apache 프록시 설정 스크립트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOMAIN="lx2.kr"
API_PORT="3000"

echo "=========================================="
echo "Apache 프록시 설정"
echo "=========================================="
echo ""

# Apache 설치 확인
if ! command -v apache2 &> /dev/null; then
    echo "❌ Apache2가 설치되지 않았습니다."
    echo "설치 방법:"
    echo "  sudo apt-get install apache2  # Ubuntu/Debian"
    echo "  sudo yum install httpd        # CentOS/RHEL"
    exit 1
fi

echo "✅ Apache2 설치 확인됨"
echo ""

# 프로젝트 경로 확인
echo "프로젝트 디렉토리: $PROJECT_DIR"
read -p "이 경로가 맞습니까? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    read -p "프로젝트 디렉토리 경로를 입력하세요: " PROJECT_DIR
fi

# 도메인 확인
read -p "도메인 (기본값: $DOMAIN): " input_domain
DOMAIN=${input_domain:-$DOMAIN}

# API 포트 확인
read -p "API 서버 포트 (기본값: $API_PORT): " input_port
API_PORT=${input_port:-$API_PORT}

echo ""
echo "설정 정보:"
echo "  도메인: $DOMAIN"
echo "  프로젝트 경로: $PROJECT_DIR"
echo "  API 포트: $API_PORT"
echo ""

# VirtualHost 설정 파일 경로 확인
if [ -d "/etc/apache2/sites-available" ]; then
    # Debian/Ubuntu
    VHOST_DIR="/etc/apache2/sites-available"
    VHOST_FILE="$VHOST_DIR/$DOMAIN.conf"
    APACHE_CONF="/etc/apache2/apache2.conf"
elif [ -d "/etc/httpd/conf.d" ]; then
    # CentOS/RHEL
    VHOST_DIR="/etc/httpd/conf.d"
    VHOST_FILE="$VHOST_DIR/$DOMAIN.conf"
    APACHE_CONF="/etc/httpd/conf/httpd.conf"
else
    echo "❌ Apache 설정 디렉토리를 찾을 수 없습니다."
    exit 1
fi

echo "VirtualHost 파일: $VHOST_FILE"
echo ""

# VirtualHost 설정 생성
echo "VirtualHost 설정 생성 중..."
sudo tee "$VHOST_FILE" > /dev/null <<EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    
    # 프론트엔드 정적 파일
    DocumentRoot $PROJECT_DIR
    
    <Directory $PROJECT_DIR>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # API 프록시
    ProxyPreserveHost On
    ProxyPass /api http://localhost:$API_PORT/api
    ProxyPassReverse /api http://localhost:$API_PORT/api
    
    # 로그
    ErrorLog \${APACHE_LOG_DIR}/${DOMAIN}_error.log
    CustomLog \${APACHE_LOG_DIR}/${DOMAIN}_access.log combined
</VirtualHost>
EOF

if [ $? -eq 0 ]; then
    echo "✅ VirtualHost 설정 파일 생성 완료"
else
    echo "❌ 설정 파일 생성 실패"
    exit 1
fi

echo ""

# Apache 모듈 활성화
echo "필요한 Apache 모듈 활성화 중..."
if [ -d "/etc/apache2" ]; then
    # Debian/Ubuntu
    sudo a2enmod proxy
    sudo a2enmod proxy_http
    sudo a2enmod rewrite
    sudo a2ensite "$DOMAIN"
elif [ -d "/etc/httpd" ]; then
    # CentOS/RHEL
    echo "LoadModule proxy_module modules/mod_proxy.so" | sudo tee -a "$APACHE_CONF" > /dev/null
    echo "LoadModule proxy_http_module modules/mod_proxy_http.so" | sudo tee -a "$APACHE_CONF" > /dev/null
fi

echo ""

# Apache 설정 테스트
echo "Apache 설정 테스트 중..."
if [ -d "/etc/apache2" ]; then
    sudo apache2ctl configtest
elif [ -d "/etc/httpd" ]; then
    sudo httpd -t
fi

if [ $? -eq 0 ]; then
    echo "✅ Apache 설정 검증 완료"
else
    echo "❌ Apache 설정에 오류가 있습니다."
    exit 1
fi

echo ""

# Apache 재시작
read -p "Apache를 재시작하시겠습니까? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "/etc/apache2" ]; then
        sudo systemctl restart apache2
    elif [ -d "/etc/httpd" ]; then
        sudo systemctl restart httpd
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Apache 재시작 완료"
    else
        echo "❌ Apache 재시작 실패"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "설정 완료"
echo "=========================================="
echo ""
echo "다음 단계:"
echo "1. API 서버가 실행 중인지 확인:"
echo "   curl http://localhost:$API_PORT/api/health"
echo ""
echo "2. 프록시 테스트:"
echo "   curl http://$DOMAIN/api/health"
echo ""
echo "3. 브라우저에서 확인:"
echo "   http://$DOMAIN"
echo ""


