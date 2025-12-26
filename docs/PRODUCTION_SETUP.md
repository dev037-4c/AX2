# AX2 Caption 프로덕션 설정 가이드

회사 공식 서비스로 운영하기 위한 전체 설정 가이드입니다.

---

## 📋 개요

이 문서는 AX2 Caption을 프로덕션 환경에서 운영하기 위한 단계별 가이드를 제공합니다.

**대상 독자:**
- DevOps 엔지니어
- 백엔드 개발자
- 시스템 관리자

**예상 소요 시간:**
- 초기 설정: 2-4시간
- 테스트 및 검증: 1-2시간

---

## 🎯 목표

- 안정적이고 확장 가능한 백엔드 서버 구축
- 보안이 강화된 프로덕션 환경 구성
- 모니터링 및 로깅 시스템 구축
- 자동화된 백업 및 복구 시스템

---

## 📚 사전 준비

### 1. 문서 검토

다음 문서들을 먼저 검토하세요:

- [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md) - 준비 체크리스트
- [PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) - 시스템 아키텍처
- [backend/DEPLOYMENT_GUIDE.md](./backend/DEPLOYMENT_GUIDE.md) - 배포 가이드
- [backend/OPERATIONS_MANUAL.md](./backend/OPERATIONS_MANUAL.md) - 운영 매뉴얼

### 2. 인프라 요구사항

**최소 사양:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 100GB SSD
- Network: 100Mbps

**권장 사양:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 500GB+ SSD
- Network: 1Gbps

### 3. 소프트웨어 요구사항

- Ubuntu 20.04 LTS 이상
- Node.js 18.x 이상
- PostgreSQL 14.x 이상
- Nginx 1.18 이상

---

## 🚀 단계별 설정

### 1단계: 서버 초기 설정

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y curl wget git build-essential

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 설치
sudo apt install -y postgresql postgresql-contrib

# Nginx 설치
sudo apt install -y nginx

# PM2 설치
sudo npm install -g pm2
```

### 2단계: 데이터베이스 설정

```bash
# PostgreSQL 사용자 및 데이터베이스 생성
sudo -u postgres psql << EOF
CREATE USER ax2_caption WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE ax2_caption OWNER ax2_caption;
GRANT ALL PRIVILEGES ON DATABASE ax2_caption TO ax2_caption;
\q
EOF

# 데이터베이스 초기화 (애플리케이션 코드 배포 후)
cd /var/www/ax2-caption/backend
npm run init-db
```

### 3단계: 애플리케이션 배포

```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /var/www/ax2-caption
sudo chown $USER:$USER /var/www/ax2-caption

# 코드 배포
cd /var/www/ax2-caption
git clone <repository-url> .
cd backend

# 의존성 설치
npm install --production

# 환경 변수 설정
cp .env.example .env
nano .env  # 환경 변수 수정

# 스토리지 디렉토리 생성
mkdir -p storage/temp storage/processed logs
chmod 755 storage storage/temp storage/processed logs
```

### 4단계: 환경 변수 설정

`.env` 파일을 다음과 같이 설정:

```bash
# 서버
NODE_ENV=production
PORT=3000
APP_VERSION=1.0.0

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_USER=ax2_caption
DB_PASSWORD=your_secure_password_here
DB_NAME=ax2_caption
DB_MAX_CONNECTIONS=20

# JWT (반드시 강력한 랜덤 값으로 변경!)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=https://ax2caption.com,https://www.ax2caption.com

# 파일 업로드
MAX_FILE_SIZE=2147483648
TEMP_PATH=./storage/temp
PROCESSED_PATH=./storage/processed

# 크레딧
CREDIT_PER_MINUTE=10
TRANSLATION_CREDIT_PER_MINUTE=5
RESERVATION_EXPIRY_MINUTES=30

# 보관 정책
RETENTION_DAYS=7
CLEANUP_SCHEDULE=0 2 * * *

# 로깅
LOG_LEVEL=info
LOG_DIR=./logs
```

### 5단계: 서버 실행

```bash
# PM2로 서버 시작
cd /var/www/ax2-caption/backend
pm2 start server.js --name ax2-caption-api

# 자동 시작 설정
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs ax2-caption-api
```

### 6단계: Nginx 설정

```nginx
# /etc/nginx/sites-available/ax2-caption
server {
    listen 80;
    server_name ax2caption.com www.ax2caption.com;

    # SSL 설정은 certbot으로 자동 설정

    # API 프록시
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 프론트엔드
    location / {
        root /var/www/ax2-caption/frontend;
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐싱
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Nginx 설정 활성화
sudo ln -s /etc/nginx/sites-available/ax2-caption /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7단계: SSL 인증서 설정

```bash
# Let's Encrypt 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d ax2caption.com -d www.ax2caption.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

### 8단계: 방화벽 설정

```bash
# UFW 설정
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# 상태 확인
sudo ufw status
```

### 9단계: 백업 설정

```bash
# 백업 스크립트 생성
sudo nano /usr/local/bin/backup-ax2-caption.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ax2-caption"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 데이터베이스 백업
pg_dump -U ax2_caption ax2_caption > $BACKUP_DIR/db_backup_$DATE.sql
gzip $BACKUP_DIR/db_backup_$DATE.sql

# 30일 이상 된 백업 삭제
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

```bash
# 실행 권한 부여
sudo chmod +x /usr/local/bin/backup-ax2-caption.sh

# Cron에 추가 (매일 새벽 2시)
sudo crontab -e
# 추가: 0 2 * * * /usr/local/bin/backup-ax2-caption.sh
```

---

## ✅ 검증 체크리스트

설정 완료 후 다음을 확인하세요:

### 기본 기능
- [ ] 서버가 정상적으로 시작됨
- [ ] 데이터베이스 연결 성공
- [ ] API 엔드포인트 응답 확인
- [ ] 헬스 체크 통과

### 보안
- [ ] HTTPS 설정 완료
- [ ] 방화벽 설정 완료
- [ ] 환경 변수 보안 확인
- [ ] SSH 보안 강화

### 모니터링
- [ ] 로그 파일 생성 확인
- [ ] PM2 모니터링 동작 확인
- [ ] 디스크 사용량 모니터링 설정

### 백업
- [ ] 백업 스크립트 실행 테스트
- [ ] 백업 파일 생성 확인
- [ ] 복구 절차 테스트

---

## 🔧 추가 설정 (선택사항)

### 모니터링 도구

**Prometheus + Grafana:**
```bash
# Prometheus 설치 및 설정
# Grafana 설치 및 설정
# 대시보드 구성
```

**Sentry (에러 추적):**
```bash
npm install @sentry/node
# Sentry 설정 추가
```

### 로그 수집

**ELK Stack:**
- Elasticsearch
- Logstash
- Kibana

### CDN 설정

- Cloudflare
- AWS CloudFront
- Google Cloud CDN

---

## 🚨 문제 해결

### 일반적인 문제

**1. 서버가 시작되지 않음**
```bash
# 로그 확인
pm2 logs ax2-caption-api

# 포트 확인
lsof -i :3000

# 환경 변수 확인
cat .env
```

**2. 데이터베이스 연결 실패**
```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 연결 테스트
psql -U ax2_caption -d ax2_caption -c "SELECT 1;"
```

**3. 파일 업로드 실패**
```bash
# 디스크 공간 확인
df -h

# 디렉토리 권한 확인
ls -la storage/
```

---

## 📞 지원

문제가 발생하면 다음을 참고하세요:

- [운영 매뉴얼](./backend/OPERATIONS_MANUAL.md)
- [배포 가이드](./backend/DEPLOYMENT_GUIDE.md)
- 개발팀 연락처

---

**작성일**: 2025년 1월  
**최종 업데이트**: 2025년 1월

