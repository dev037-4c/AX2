# AX2 Caption 배포 가이드

회사 공식 서비스로 운영하기 위한 배포 가이드입니다.

---

## 📋 사전 준비사항

### 1. 서버 환경
- Ubuntu 20.04 LTS 이상 (또는 동등한 Linux 배포판)
- Node.js 18.x 이상
- PostgreSQL 14.x 이상
- Nginx (리버스 프록시)

### 2. 클라우드 서비스 (선택사항)
- AWS, GCP, Azure 등
- S3 또는 동등한 객체 스토리지
- CDN 서비스

### 3. 도메인 및 SSL 인증서
- 도메인 등록
- SSL 인증서 (Let's Encrypt 권장)

---

## 🚀 배포 절차

### 1단계: 서버 설정

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 설치
sudo apt install postgresql postgresql-contrib -y

# Nginx 설치
sudo apt install nginx -y

# PM2 설치 (프로세스 관리)
sudo npm install -g pm2
```

### 2단계: 데이터베이스 설정

```bash
# PostgreSQL 사용자 생성
sudo -u postgres psql
CREATE USER ax2_caption WITH PASSWORD 'your_secure_password';
CREATE DATABASE ax2_caption OWNER ax2_caption;
GRANT ALL PRIVILEGES ON DATABASE ax2_caption TO ax2_caption;
\q
```

### 3단계: 애플리케이션 배포

```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /var/www/ax2-caption
sudo chown $USER:$USER /var/www/ax2-caption

# 코드 배포 (Git 또는 SCP)
cd /var/www/ax2-caption
git clone <repository-url> backend
cd backend

# 의존성 설치
npm install --production

# 환경 변수 설정
cp .env.example .env
nano .env  # 환경 변수 수정

# 데이터베이스 초기화
npm run init-db

# 스토리지 디렉토리 생성
mkdir -p storage/temp storage/processed
chmod 755 storage storage/temp storage/processed
```

### 4단계: 환경 변수 설정

`.env` 파일 수정:

```bash
# 프로덕션 설정
NODE_ENV=production
PORT=3000

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_USER=ax2_caption
DB_PASSWORD=your_secure_password
DB_NAME=ax2_caption

# JWT (반드시 변경!)
JWT_SECRET=your-very-secure-random-secret-key-here
JWT_REFRESH_SECRET=your-very-secure-random-refresh-secret-key-here

# CORS
ALLOWED_ORIGINS=https://ax2caption.com,https://www.ax2caption.com

# 기타 설정...
```

### 5단계: PM2로 서버 실행

```bash
# PM2로 서버 시작
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

    # SSL 인증서 설정 (Let's Encrypt)
    # certbot으로 자동 설정 권장

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
    }

    location / {
        root /var/www/ax2-caption/frontend;
        try_files $uri $uri/ /index.html;
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
sudo apt install certbot python3-certbot-nginx -y

# SSL 인증서 발급
sudo certbot --nginx -d ax2caption.com -d www.ax2caption.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

---

## 🔧 운영 관리

### 로그 확인

```bash
# 애플리케이션 로그
pm2 logs ax2-caption-api

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 시스템 로그
journalctl -u nginx -f
```

### 서버 재시작

```bash
# 애플리케이션 재시작
pm2 restart ax2-caption-api

# Nginx 재시작
sudo systemctl restart nginx
```

### 데이터베이스 백업

```bash
# 백업 스크립트 생성
cat > /usr/local/bin/backup-ax2-caption.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/ax2-caption"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U ax2_caption ax2_caption > $BACKUP_DIR/db_backup_$DATE.sql
# 30일 이상 된 백업 삭제
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-ax2-caption.sh

# Cron에 추가 (매일 새벽 2시)
crontab -e
# 추가: 0 2 * * * /usr/local/bin/backup-ax2-caption.sh
```

### 모니터링

```bash
# PM2 모니터링
pm2 monit

# 시스템 리소스 모니터링
htop
df -h  # 디스크 사용량
free -h  # 메모리 사용량
```

---

## 🔒 보안 체크리스트

- [ ] 방화벽 설정 (UFW)
  ```bash
  sudo ufw allow 22/tcp  # SSH
  sudo ufw allow 80/tcp  # HTTP
  sudo ufw allow 443/tcp # HTTPS
  sudo ufw enable
  ```

- [ ] SSH 보안 강화
  - 비밀번호 인증 비활성화
  - SSH 키 인증만 허용

- [ ] 환경 변수 보안
  - `.env` 파일 권한: `chmod 600 .env`
  - 민감한 정보는 Secrets Manager 사용 권장

- [ ] 정기적인 보안 업데이트
  ```bash
  sudo apt update && sudo apt upgrade -y
  npm audit fix
  ```

---

## 📊 성능 최적화

### 1. Nginx 캐싱

```nginx
# 정적 파일 캐싱
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 2. 데이터베이스 최적화

```sql
-- 정기적인 VACUUM
VACUUM ANALYZE;

-- 인덱스 재구성
REINDEX DATABASE ax2_caption;
```

### 3. PM2 클러스터 모드

```bash
# CPU 코어 수만큼 인스턴스 실행
pm2 start server.js -i max --name ax2-caption-api
```

---

## 🚨 장애 대응

### 서버 다운

```bash
# 서버 상태 확인
pm2 status
systemctl status nginx
systemctl status postgresql

# 로그 확인
pm2 logs ax2-caption-api --lines 100
```

### 데이터베이스 복구

```bash
# 백업에서 복구
psql -U ax2_caption ax2_caption < /var/backups/ax2-caption/db_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📝 체크리스트

배포 전 확인:

- [ ] 데이터베이스 초기화 완료
- [ ] 환경 변수 설정 완료
- [ ] SSL 인증서 설정 완료
- [ ] 방화벽 설정 완료
- [ ] 백업 스크립트 설정 완료
- [ ] 모니터링 설정 완료
- [ ] 로그 확인 경로 파악
- [ ] 장애 대응 매뉴얼 준비

---

**작성일**: 2025년 1월

