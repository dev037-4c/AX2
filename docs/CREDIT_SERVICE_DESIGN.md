# 크레딧 서비스 설계 문서

AX2 Caption의 크레딧 정책을 기준으로 한 서버 사이드 크레딧 처리 로직 설계 문서입니다.

---

## 📋 크레딧 정책 요약

### 크레딧 계산 방식
- **기본 자막 생성**: 분당 10 크레딧
- **번역 언어당 추가**: 분당 5 크레딧
- **영상 길이**: 분 단위로 올림 처리 (61초 → 2분)

### 예시
- 1시간 영상, 2개 언어 번역:
  - 기본: 60분 × 10 = 600 크레딧
  - 번역: 60분 × 5 × 2 = 600 크레딧
  - **총: 1,200 크레딧**

---

## 🔐 주요 기능

### 1. 크레딧 선차감(예약)

#### 1.1 프로세스
```
1. 작업 생성 요청
2. 크레딧 계산
3. 잔액 확인
4. 잔액 차감 (트랜잭션)
5. 예약 내역 저장
6. 크레딧 사용 내역 기록
```

#### 1.2 구현 특징
- **트랜잭션 처리**: 데이터베이스 트랜잭션으로 원자성 보장
- **SELECT FOR UPDATE**: 동시성 제어를 위한 행 잠금
- **예약 만료 시간**: 30분 (설정 가능)
- **상태 관리**: `reserved` → `confirmed` 또는 `refunded`

#### 1.3 API 예시
```javascript
const result = await reserveCredits(
    db,
    jobId,
    amount,
    userId,      // null: 비로그인
    deviceId,   // 비로그인 사용자
    ipAddress   // 비로그인 사용자
);
```

---

### 2. 작업 실패 시 환불

#### 2.1 환불 트리거
- 작업 상태가 `failed`로 변경될 때
- 작업이 취소될 때
- 예약이 만료될 때 (30분 경과)

#### 2.2 환불 프로세스
```
1. 예약 상태 확인 (reserved 또는 confirmed)
2. 환불 금액 계산 (전액 또는 부분)
3. 잔액 복구 (트랜잭션)
4. 예약 상태를 refunded로 변경
5. 환불 내역 기록
```

#### 2.3 부분 환불 지원
- 작업이 일부 완료된 경우 부분 환불 가능
- 예: 50% 완료 → 50% 환불

#### 2.4 API 예시
```javascript
const result = await refundCredits(
    db,
    reservationId,
    jobId,
    '작업 처리 실패',
    null  // null: 전액 환불, 숫자: 부분 환불
);
```

---

### 3. 중복 요청 방지

#### 3.1 방지 메커니즘
- **메모리 맵**: `pendingReservations` (jobId → reservationId)
- **잠금 타임스탬프**: `reservationLocks` (reservationId → timestamp)
- **데이터베이스 제약조건**: job_id + status 유니크 체크

#### 3.2 처리 로직
```javascript
// 1. 동일한 jobId로 이미 예약이 있는지 확인
if (pendingReservations.has(jobId)) {
    // 2. 기존 예약 상태 확인
    const existingReservation = await checkReservationStatus(...);
    
    // 3. 유효한 예약이 있으면 중복 요청으로 처리
    if (existingReservation.status === 'reserved' || 'confirmed') {
        return { error: 'DUPLICATE_REQUEST' };
    }
}

// 4. 새 예약 생성
const reservation = await createReservation(...);
pendingReservations.set(jobId, reservationId);
```

#### 3.3 Redis 사용 권장
- 프로덕션 환경에서는 Redis를 사용하여 분산 환경에서도 중복 방지
- TTL 설정으로 자동 정리

---

### 4. 비로그인 / 로그인 분리 처리

#### 4.1 크레딧 저장소 분리

**로그인 사용자:**
- `credits.balance`: 유료 크레딧
- `credits.free_balance`: 무료 크레딧 (사용 안 함)
- `user_id`로 조회

**비로그인 사용자:**
- `credits.free_balance`: 무료 크레딧만 사용
- `credits.balance`: 사용 안 함
- `device_id` 또는 `ip_address`로 조회

#### 4.2 잔액 조회 로직
```javascript
if (userId) {
    // 로그인: balance 사용
    const balance = await getBalanceByUserId(userId);
    return balance.balance;
} else {
    // 비로그인: free_balance 사용
    const balance = await getBalanceByDevice(deviceId, ipAddress);
    return balance.free_balance;
}
```

#### 4.3 차감/환불 로직
```javascript
if (userId) {
    // 로그인: balance 차감/복구
    UPDATE credits SET balance = balance ± amount WHERE user_id = $1;
} else {
    // 비로그인: free_balance 차감/복구
    UPDATE credits SET free_balance = free_balance ± amount 
    WHERE device_id = $1 OR ip_address = $2;
}
```

---

## 🗄️ 데이터베이스 스키마

### credits 테이블
```sql
CREATE TABLE credits (
    credit_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id),
    balance INTEGER NOT NULL DEFAULT 0,           -- 로그인 사용자 크레딧
    free_balance INTEGER NOT NULL DEFAULT 0,      -- 비로그인 사용자 크레딧
    total_charged INTEGER NOT NULL DEFAULT 0,
    device_id VARCHAR(255),
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(device_id),
    UNIQUE(ip_address)
);
```

### credit_reservations 테이블
```sql
CREATE TABLE credit_reservations (
    reservation_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id),
    job_id VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',
    reserved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_job_id (job_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at)
);
```

### credit_history 테이블
```sql
CREATE TABLE credit_history (
    history_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id),
    type VARCHAR(20) NOT NULL,  -- reservation, use, refund, charge
    amount INTEGER NOT NULL,     -- 음수: 차감, 양수: 충전/환불
    balance_after INTEGER NOT NULL,
    description VARCHAR(255),
    job_id VARCHAR(50),
    reservation_id VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 🔄 전체 워크플로우

### 작업 생성 및 크레딧 처리 흐름

```
1. 클라이언트: 작업 생성 요청
   ↓
2. 서버: 크레딧 계산
   - durationSeconds, translationLanguageCount
   ↓
3. 서버: 중복 요청 확인
   - pendingReservations 맵 확인
   ↓
4. 서버: 잔액 조회
   - userId ? balance : free_balance
   ↓
5. 서버: 잔액 부족 확인
   - availableBalance < requiredCredits → 에러 반환
   ↓
6. 서버: 트랜잭션 시작
   ↓
7. 서버: 잔액 차감 (SELECT FOR UPDATE)
   - 동시성 제어
   ↓
8. 서버: 예약 내역 저장
   - reservation_id 생성
   - status: 'reserved'
   - expires_at: 30분 후
   ↓
9. 서버: 크레딧 사용 내역 기록
   - type: 'reservation'
   - amount: 음수
   ↓
10. 서버: 중복 방지 맵에 추가
    - pendingReservations.set(jobId, reservationId)
    ↓
11. 서버: 트랜잭션 커밋
    ↓
12. 서버: 작업 처리 시작
    ↓
13. 작업 완료 시:
    - confirmDeduction() 호출
    - status: 'confirmed'
    - type: 'use'로 변경
    ↓
14. 작업 실패 시:
    - refundCredits() 호출
    - status: 'refunded'
    - 잔액 복구
    - 환불 내역 기록
```

---

## 🛡️ 보안 및 안정성

### 1. 동시성 제어
- **SELECT FOR UPDATE**: 행 레벨 잠금으로 동시 요청 방지
- **트랜잭션**: 원자성 보장
- **낙관적 잠금**: 버전 번호로 충돌 감지

### 2. 데이터 무결성
- **외래키 제약조건**: 참조 무결성 보장
- **체크 제약조건**: amount > 0 등
- **유니크 제약조건**: 중복 방지

### 3. 에러 처리
- **트랜잭션 롤백**: 오류 시 모든 변경사항 취소
- **에러 코드**: 명확한 에러 메시지
- **로깅**: 모든 크레딧 거래 기록

### 4. 만료 처리
- **스케줄러**: 주기적으로 만료된 예약 정리
- **자동 환불**: 만료된 예약의 크레딧 자동 환불
- **TTL**: Redis 사용 시 자동 만료

---

## 📊 모니터링 및 로깅

### 1. 크레딧 거래 로그
- 모든 크레딧 거래는 `credit_history`에 기록
- 타입별 통계 가능
- 감사 추적 가능

### 2. 예약 상태 추적
- `credit_reservations` 테이블로 모든 예약 추적
- 상태별 통계
- 만료 예약 모니터링

### 3. 알림
- 잔액 부족 알림
- 환불 완료 알림
- 예약 만료 알림

---

## 🚀 성능 최적화

### 1. 인덱스
- `credits(user_id)`: 로그인 사용자 조회
- `credits(device_id)`: 비로그인 사용자 조회
- `credit_reservations(job_id)`: 작업별 예약 조회
- `credit_reservations(status)`: 상태별 필터링

### 2. 캐싱
- Redis로 잔액 캐싱 (선택사항)
- TTL 설정으로 자동 갱신

### 3. 배치 처리
- 만료된 예약 정리를 배치로 처리
- 크레딧 내역 조회 시 페이지네이션

---

## 📝 API 사용 예시

### 작업 생성 시 크레딧 예약
```javascript
// 1. 크레딧 계산
const requiredCredits = calculateRequiredCredits(
    durationSeconds,
    translationLanguageCount
);

// 2. 크레딧 예약
const reservation = await reserveCredits(
    db,
    jobId,
    requiredCredits,
    userId,      // 로그인: userId, 비로그인: null
    deviceId,    // 비로그인 사용자
    ipAddress    // 비로그인 사용자
);

if (!reservation.success) {
    // 잔액 부족 또는 중복 요청
    return { error: reservation.error };
}
```

### 작업 완료 시 확정
```javascript
await confirmDeduction(
    db,
    reservation.reservationId,
    jobId
);
```

### 작업 실패 시 환불
```javascript
await refundCredits(
    db,
    reservation.reservationId,
    jobId,
    '작업 처리 실패',
    null  // 전액 환불
);
```

---

## 🔧 설정 가능한 값

```javascript
// 크레딧 계산
const CREDIT_PER_MINUTE = 10;
const TRANSLATION_CREDIT_PER_MINUTE = 5;

// 예약 만료 시간
const RESERVATION_EXPIRY_MINUTES = 30;

// 중복 요청 방지 TTL (Redis 사용 시)
const DUPLICATE_CHECK_TTL = 300; // 5분
```

---

**작성일**: 2025년 1월  
**기준 문서**: SYSTEM_OVERVIEW.md, DATABASE_SCHEMA.md

