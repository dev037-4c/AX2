# 빠른 시작 가이드 (즉시 적용)

**작성일**: 2025년 1월

---

## 🚀 즉시 해야 할 3가지

### 1. DB 마이그레이션 실행

```bash
# DB 접속
mysql -u ax2 -p ax2_caption

# 마이그레이션 실행
source ax2-api/db-migration-add-fields.sql

# 또는 직접 실행
mysql -u ax2 -p ax2_caption < ax2-api/db-migration-add-fields.sql
```

**추가되는 필드**:
- `retry_count` - 재시도 횟수
- `size` - 파일 크기 (쿼터 계산용)

### 2. 서버 재시작

```bash
# 서비스 재시작
sudo systemctl restart ax2-caption-api
sudo systemctl restart ax2-caption-worker

# 상태 확인
sudo systemctl status ax2-caption-api
sudo systemctl status ax2-caption-worker
```

### 3. 기능 테스트

```bash
# 업로드 테스트
curl -X POST -F "video=@test.mp4" http://localhost:3000/api/videos/upload

# 재시도 API 테스트 (실패한 Job)
curl -X POST http://localhost:3000/api/jobs/{jobId}/retry \
  -H "Authorization: Bearer {token}"

# 재처리 API 테스트 (완료된 Job)
curl -X POST http://localhost:3000/api/jobs/{jobId}/reprocess \
  -H "Authorization: Bearer {token}"
```

---

## ✅ 적용된 기능

### 1. 업로드 쿼터
- 비로그인: 100MB/일
- 무료 사용자: 1GB/월
- 유료 사용자: 10GB/월

### 2. 재시도/재처리
- 실패한 Job 재시도 (`POST /api/jobs/:id/retry`)
- 완료된 Job 재처리 (`POST /api/jobs/:id/reprocess`)
- 최대 재시도 횟수: 3회

### 3. 권한 체크
- 다운로드: 소유자만
- 삭제: 소유자만
- 조회: 소유자만

---

## 📋 다음 단계

### UI 개선 (선택)
1. 에러 메시지 표시
2. 재시도 버튼
3. 만료일 표시

### 문서 작성 (선택)
1. 이용약관
2. 개인정보 처리방침
3. 문의 가이드

---

**작성일**: 2025년 1월


