# 프로덕션 배포 체크리스트

**작성일**: 2025년 1월

---

## ✅ 배포 전 필수 체크리스트

### 1. 환경 설정

- [ ] `.env` 파일 생성 및 설정
  - [ ] `JWT_SECRET` (최소 32자)
  - [ ] `JWT_REFRESH_SECRET` (최소 32자)
  - [ ] `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
  - [ ] `ALLOWED_ORIGINS` (CORS 설정)
  - [ ] `LOG_LEVEL` (INFO 또는 WARN 권장)

- [ ] 로그 디렉토리 생성
  ```bash
  mkdir -p /data/lx2/ax2-caption-api/logs
  chmod 755 /data/lx2/ax2-caption-api/logs
  ```

### 2. 데이터베이스

- [ ] 데이터베이스 생성
  ```bash
  mysql -u root -p
  CREATE DATABASE ax2_caption CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```

- [ ] 테이블 생성
  ```bash
  mysql -u ax2 -p ax2_caption < ax2-api/db-init.sql
  ```

- [ ] DB 사용자 권한 확인
  ```bash
  mysql -u ax2 -p ax2_caption -e "SHOW GRANTS;"
  ```

### 3. 파일 시스템

- [ ] 업로드 디렉토리 생성
  ```bash
  mkdir -p /data/lx2/ax2-caption-storage/uploads
  mkdir -p /data/lx2/ax2-caption-storage/results
  chown -R ax2:ax2 /data/lx2/ax2-caption-storage
  chmod -R 755 /data/lx2/ax2-caption-storage
  ```

- [ ] 디스크 용량 확인
  ```bash
  ./scripts/check-disk-usage.sh
  ```

### 4. Apache 설정

- [ ] Apache 설정 점검
  ```bash
  ./scripts/check-apache-config.sh
  ```

- [ ] 필수 설정 확인
  - [ ] `LimitRequestBody` (2GB 이상)
  - [ ] `Timeout` (600초 이상)
  - [ ] `ProxyTimeout` (600초 이상)
  - [ ] `/api` 프록시 설정
  - [ ] SSL 인증서 설정

- [ ] Apache 모듈 활성화
  ```bash
  sudo a2enmod proxy
  sudo a2enmod proxy_http
  sudo a2enmod headers
  sudo a2enmod ssl
  sudo systemctl restart apache2
  ```

### 5. Node.js 서비스

- [ ] 패키지 설치
  ```bash
  cd /data/lx2/ax2-caption-api
  npm install --production
  ```

- [ ] systemd 서비스 등록 (API 서버)
  ```bash
  sudo cp ax2-api/systemd/ax2-caption-api.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable ax2-caption-api
  sudo systemctl start ax2-caption-api
  sudo systemctl status ax2-caption-api
  ```

- [ ] systemd 서비스 등록 (워커)
  ```bash
  sudo cp ax2-api/systemd/ax2-caption-worker.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable ax2-caption-worker
  sudo systemctl start ax2-caption-worker
  sudo systemctl status ax2-caption-worker
  ```

### 6. 보안 설정

- [ ] 파일 권한 확인
  ```bash
  # 업로드 디렉토리는 웹에서 직접 접근 불가
  chmod 750 /data/lx2/ax2-caption-storage/uploads
  ```

- [ ] 방화벽 설정 (필요 시)
  ```bash
  # 포트 3000은 localhost에서만 접근 가능해야 함
  sudo ufw allow from 127.0.0.1 to any port 3000
  ```

- [ ] SSL 인증서 확인
  ```bash
  openssl x509 -in /path/to/cert.pem -noout -dates
  ```

### 7. 모니터링 설정

- [ ] cron 작업 등록
  ```bash
  # 디스크 용량 모니터링 (매시간)
  0 * * * * /path/to/scripts/check-disk-usage.sh >> /var/log/ax2-caption/disk-usage.log 2>&1
  
  # Apache 설정 점검 (매일 오전 9시)
  0 9 * * * /path/to/scripts/check-apache-config.sh >> /var/log/ax2-caption/apache-check.log 2>&1
  ```

- [ ] 로그 로테이션 설정
  ```bash
  sudo cp ax2-api/logrotate/ax2-caption /etc/logrotate.d/
  ```

- [ ] 알림 설정 (선택)
  - [ ] 슬랙 웹훅 URL 설정
  - [ ] 관리자 이메일 설정

---

## ✅ 배포 후 검증

### 1. 서비스 상태 확인

- [ ] API 서버 실행 확인
  ```bash
  curl http://localhost:3000/api/health
  ```

- [ ] 워커 프로세스 실행 확인
  ```bash
  systemctl status ax2-caption-worker
  journalctl -u ax2-caption-worker -f
  ```

### 2. 기능 테스트

- [ ] 파일 업로드 테스트
  ```bash
  curl -X POST -F "video=@test.mp4" http://localhost:3000/api/videos/upload
  ```

- [ ] Job 상태 조회 테스트
  ```bash
  curl http://localhost:3000/api/jobs/{jobId}
  ```

- [ ] 자막 다운로드 테스트
  ```bash
  curl http://localhost:3000/api/jobs/{jobId}/subtitle?format=srt
  ```

### 3. 로그 확인

- [ ] 에러 로그 확인
  ```bash
  tail -f /data/lx2/ax2-caption-api/logs/error.log
  ```

- [ ] 접근 로그 확인
  ```bash
  tail -f /data/lx2/ax2-caption-api/logs/access.log
  ```

---

## ✅ 운영 중 정기 점검

### 매일

- [ ] 디스크 용량 확인
- [ ] 에러 로그 확인
- [ ] 서비스 상태 확인

### 매주

- [ ] Apache 설정 점검
- [ ] SSL 인증서 만료일 확인
- [ ] 백업 확인

### 매월

- [ ] 로그 파일 정리
- [ ] 성능 모니터링
- [ ] 보안 업데이트

---

## 🚨 장애 대응 절차

### 1. 서비스 다운

1. 서비스 상태 확인
   ```bash
   systemctl status ax2-caption-api
   systemctl status ax2-caption-worker
   ```

2. 로그 확인
   ```bash
   journalctl -u ax2-caption-api -n 100
   tail -100 /data/lx2/ax2-caption-api/logs/error.log
   ```

3. 서비스 재시작
   ```bash
   sudo systemctl restart ax2-caption-api
   sudo systemctl restart ax2-caption-worker
   ```

### 2. 디스크 용량 부족

1. 용량 확인
   ```bash
   df -h /data/lx2/ax2-caption-storage
   ```

2. 오래된 파일 삭제
   ```bash
   # 30일 이상 된 파일 찾기
   find /data/lx2/ax2-caption-storage -type f -mtime +30
   ```

3. 만료된 Job 정리 (자동 스케줄러 확인)

### 3. 데이터베이스 오류

1. DB 연결 확인
   ```bash
   mysql -u ax2 -p ax2_caption -e "SELECT 1;"
   ```

2. DB 상태 확인
   ```bash
   mysql -u ax2 -p ax2_caption -e "SHOW PROCESSLIST;"
   ```

3. 백업에서 복구 (필요 시)

---

## 📞 연락처

- **개발팀**: dev@example.com
- **운영팀**: ops@example.com
- **긴급 연락**: emergency@example.com

---

**작성일**: 2025년 1월


