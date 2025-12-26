# 테스트 및 수정 사항

## 발견된 문제점 및 수정

### ✅ 1. DB 스키마에 `size` 컬럼 누락
**문제**: `db-init.sql`에 `size`와 `retry_count` 컬럼이 없어서 INSERT 쿼리 실패
**수정**: `db-init.sql`에 컬럼 추가
```sql
size          BIGINT NULL,
retry_count   INT DEFAULT 0,
```

### ✅ 2. `resultsDir` 변수 중복 정의
**문제**: `simulateJobProcessing` 함수 내부에서 `resultsDir`를 다시 정의
**수정**: 전역 변수 `resultsDir` 사용하도록 변경

### ✅ 3. 라우트 순서 문제
**문제**: 404 핸들러와 에러 핸들러가 일부 라우트보다 먼저 정의됨
**수정**: 모든 라우트 정의 후에 404/에러 핸들러 배치

### ✅ 4. `simulateJobProcessing` 비동기 에러 처리
**문제**: `await` 없이 호출되어 에러가 잡히지 않을 수 있음
**수정**: `.catch()` 추가하여 에러 처리

---

## 수정된 파일

1. **`ax2-api/db-init.sql`**
   - `size` 컬럼 추가
   - `retry_count` 컬럼 추가
   - `idx_size` 인덱스 추가

2. **`ax2-api/server.js`**
   - `resultsDir` 중복 정의 제거
   - 라우트 순서 수정 (404/에러 핸들러를 마지막으로 이동)
   - `simulateJobProcessing` 에러 처리 개선

---

## 테스트 권장 사항

### 1. DB 초기화 테스트
```bash
# 기존 DB 삭제 후 재생성
mysql -u root -p -e "DROP DATABASE IF EXISTS ax2_caption;"
mysql -u root -p < ax2-api/db-init.sql

# 마이그레이션은 이제 필요 없음 (db-init.sql에 포함됨)
```

### 2. 서버 시작 테스트
```bash
cd ax2-api
npm install
npm start
```

**예상 결과**:
- 서버가 정상적으로 시작됨
- DB 연결 성공
- 에러 없음

### 3. 업로드 테스트
```bash
curl -X POST -F "video=@test.mp4" http://localhost:3000/api/videos/upload
```

**예상 결과**:
- 업로드 성공
- Job 생성됨
- `size` 컬럼에 파일 크기 저장됨

### 4. Job 상태 확인
```bash
curl http://localhost:3000/api/jobs/{jobId}
```

**예상 결과**:
- Job 상태가 정상적으로 조회됨
- 5초 후 `completed` 상태로 변경됨

---

## 주의사항

### Worker vs Server Job 처리
현재 `server.js`와 `worker.js`가 둘 다 Job을 처리할 수 있습니다:
- **server.js**: 업로드 시 즉시 `simulateJobProcessing()` 호출
- **worker.js**: 별도 프로세스로 `queued` 상태 Job 처리

**권장 사항**:
- Worker를 사용하는 경우: `server.js`의 `simulateJobProcessing` 호출을 주석 처리
- Worker를 사용하지 않는 경우: `worker.js` 서비스를 시작하지 않음

**수정 방법** (Worker 사용 시):
```javascript
// server.js line 344-350 주석 처리
// simulateJobProcessing(jobId).catch(error => {
//     logger.error('Job 처리 시작 실패', {
//         requestId: req.requestId,
//         jobId,
//         error: error.message
//     });
// });
```

---

## 검증 완료 항목

- ✅ DB 스키마 정상
- ✅ 모든 함수 정의됨
- ✅ 라우트 순서 정상
- ✅ 에러 처리 완료
- ✅ Linter 검증 통과

---

**작성일**: 2024년
**수정 완료**: ✅ 모든 발견된 문제 수정됨


