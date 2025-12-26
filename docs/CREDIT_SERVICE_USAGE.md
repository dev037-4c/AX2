# 크레딧 서비스 사용 가이드

크레딧 서비스를 실제로 사용하는 방법과 예제입니다.

---

## 📦 설치 및 설정

### 1. 데이터베이스 연결 설정

```javascript
// db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

module.exports = pool;
```

### 2. 환경 변수 설정

```bash
# .env
DB_USER=your_user
DB_HOST=localhost
DB_NAME=ax2_caption
DB_PASSWORD=your_password
DB_PORT=5432
```

---

## 🔧 기본 사용법

### 1. 크레딧 계산

```javascript
const creditService = require('./api/credit-service');

// 영상 길이: 60초, 번역 언어: 2개
const requiredCredits = creditService.calculateRequiredCredits(60, 2);
// 결과: 30 크레딧 (1분 × 10 + 1분 × 5 × 2)
```

### 2. 잔액 조회

```javascript
// 로그인 사용자
const balance = await creditService.getCreditBalance(db, userId);

// 비로그인 사용자
const balance = await creditService.getCreditBalance(
    db, 
    null, 
    deviceId, 
    ipAddress
);
```

### 3. 크레딧 예약 (선차감)

```javascript
const reservation = await creditService.reserveCredits(
    db,
    jobId,
    requiredCredits,
    userId,      // 로그인: userId, 비로그인: null
    deviceId,    // 비로그인 사용자
    ipAddress    // 비로그인 사용자
);

if (!reservation.success) {
    if (reservation.error === 'INSUFFICIENT_CREDITS') {
        // 잔액 부족
        console.log(`필요: ${reservation.required}, 보유: ${reservation.balance}`);
    } else if (reservation.error === 'DUPLICATE_REQUEST') {
        // 중복 요청
        console.log('이미 처리 중인 요청입니다.');
    }
} else {
    console.log(`예약 성공: ${reservation.reservationId}`);
    console.log(`남은 잔액: ${reservation.balance}`);
}
```

### 4. 크레딧 확정 차감

```javascript
// 작업이 성공적으로 완료된 경우
const confirmed = await creditService.confirmDeduction(
    db,
    reservationId,
    jobId
);

if (confirmed) {
    console.log('크레딧이 확정 차감되었습니다.');
}
```

### 5. 크레딧 환불

```javascript
// 작업 실패 시 전액 환불
const refundResult = await creditService.refundCredits(
    db,
    reservationId,
    jobId,
    '작업 처리 실패',
    null  // null: 전액 환불
);

if (refundResult.success) {
    console.log(`환불 완료: ${refundResult.refundAmount} 크레딧`);
    console.log(`현재 잔액: ${refundResult.balance}`);
}

// 부분 환불 (예: 50% 완료 후 실패)
const partialRefund = await creditService.refundCredits(
    db,
    reservationId,
    jobId,
    '작업 부분 완료 후 실패',
    50  // 50 크레딧 환불
);
```

---

## 🚀 Express API 통합 예제

### 1. 작업 생성 API

```javascript
const express = require('express');
const router = express.Router();
const creditService = require('./api/credit-service');
const db = require('./db');

router.post('/jobs', async (req, res) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { videoId, duration, targetLanguages } = req.body;
        const userId = req.user?.userId || null;
        const deviceId = req.headers['x-device-id'];
        const ipAddress = req.ip;
        
        // 크레딧 계산
        const requiredCredits = creditService.calculateRequiredCredits(
            duration,
            targetLanguages.length
        );
        
        // 크레딧 예약
        const reservation = await creditService.reserveCredits(
            db,
            null, // jobId는 아직 없음
            requiredCredits,
            userId,
            deviceId,
            ipAddress
        );
        
        if (!reservation.success) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: reservation.error,
                message: reservation.message
            });
        }
        
        // 작업 생성
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await client.query(
            `INSERT INTO jobs (job_id, user_id, video_id, reservation_id, required_credits, status)
             VALUES ($1, $2, $3, $4, $5, 'queued')`,
            [jobId, userId, videoId, reservation.reservationId, requiredCredits]
        );
        
        // 예약에 job_id 연결
        await client.query(
            `UPDATE credit_reservations SET job_id = $1 WHERE reservation_id = $2`,
            [jobId, reservation.reservationId]
        );
        
        await client.query('COMMIT');
        
        // 비동기 작업 처리 시작
        processJobAsync(jobId, reservation.reservationId);
        
        res.status(201).json({
            success: true,
            data: {
                jobId,
                reservationId: reservation.reservationId,
                balance: reservation.balance
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});
```

### 2. 작업 완료 처리

```javascript
async function processJobAsync(jobId, reservationId) {
    try {
        // 작업 처리 로직...
        
        // 작업 완료
        await db.query(
            `UPDATE jobs SET status = 'completed' WHERE job_id = $1`,
            [jobId]
        );
        
        // 크레딧 확정 차감
        await creditService.confirmDeduction(db, reservationId, jobId);
        
    } catch (error) {
        // 작업 실패
        await db.query(
            `UPDATE jobs SET status = 'failed', error_message = $1 WHERE job_id = $2`,
            [error.message, jobId]
        );
        
        // 크레딧 환불
        await creditService.refundCredits(
            db,
            reservationId,
            jobId,
            `작업 처리 실패: ${error.message}`,
            null
        );
    }
}
```

### 3. 작업 취소 API

```javascript
router.post('/jobs/:jobId/cancel', async (req, res) => {
    const { jobId } = req.params;
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // 작업 조회
        const job = await db.query(
            `SELECT job_id, status, reservation_id FROM jobs WHERE job_id = $1`,
            [jobId]
        );
        
        if (job.rows.length === 0) {
            return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
        }
        
        // 작업 취소
        await db.query(
            `UPDATE jobs SET status = 'cancelled' WHERE job_id = $1`,
            [jobId]
        );
        
        // 크레딧 환불
        if (job.rows[0].reservation_id) {
            await creditService.refundCredits(
                db,
                job.rows[0].reservation_id,
                jobId,
                '사용자 요청에 의한 취소',
                null
            );
        }
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: '작업이 취소되었습니다.' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});
```

---

## 🔄 스케줄러 설정

### 만료된 예약 정리

```javascript
// scheduler.js
const cron = require('node-cron');
const creditService = require('./api/credit-service');
const db = require('./db');

// 매 5분마다 실행
cron.schedule('*/5 * * * *', async () => {
    try {
        const cleanedCount = await creditService.cleanupExpiredReservations(db);
        console.log(`만료된 예약 ${cleanedCount}개 정리 완료`);
    } catch (error) {
        console.error('예약 정리 오류:', error);
    }
});
```

---

## 🧪 테스트 예제

### 단위 테스트

```javascript
// credit-service.test.js
const creditService = require('./api/credit-service');

describe('크레딧 계산', () => {
    test('60초 영상, 2개 언어 번역', () => {
        const credits = creditService.calculateRequiredCredits(60, 2);
        expect(credits).toBe(30); // 1분 × 10 + 1분 × 5 × 2
    });
    
    test('61초 영상은 2분으로 올림 처리', () => {
        const credits = creditService.calculateRequiredCredits(61, 0);
        expect(credits).toBe(20); // 2분 × 10
    });
});

describe('크레딧 예약', () => {
    test('잔액 부족 시 에러 반환', async () => {
        const result = await creditService.reserveCredits(
            db,
            'job_123',
            1000,
            'user_123'
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_CREDITS');
    });
    
    test('중복 요청 방지', async () => {
        // 첫 번째 요청
        const result1 = await creditService.reserveCredits(
            db,
            'job_123',
            100,
            'user_123'
        );
        
        // 두 번째 요청 (같은 jobId)
        const result2 = await creditService.reserveCredits(
            db,
            'job_123',
            100,
            'user_123'
        );
        
        expect(result2.success).toBe(false);
        expect(result2.error).toBe('DUPLICATE_REQUEST');
    });
});
```

---

## 📊 모니터링

### 크레딧 사용 통계

```javascript
// 통계 조회
async function getCreditStatistics(db, userId) {
    const stats = await db.query(`
        SELECT 
            type,
            COUNT(*) as count,
            SUM(ABS(amount)) as total_amount
        FROM credit_history
        WHERE user_id = $1
        GROUP BY type
    `, [userId]);
    
    return stats.rows;
}
```

### 예약 상태 모니터링

```javascript
// 예약 상태별 통계
async function getReservationStats(db) {
    const stats = await db.query(`
        SELECT 
            status,
            COUNT(*) as count,
            SUM(amount) as total_amount
        FROM credit_reservations
        GROUP BY status
    `);
    
    return stats.rows;
}
```

---

## ⚠️ 주의사항

1. **트랜잭션 관리**: 모든 크레딧 거래는 트랜잭션 내에서 처리
2. **에러 처리**: 환불 실패 시에도 로그 기록
3. **동시성**: SELECT FOR UPDATE로 동시 요청 방지
4. **만료 처리**: 스케줄러로 주기적으로 만료된 예약 정리
5. **로깅**: 모든 크레딧 거래는 credit_history에 기록

---

**작성일**: 2025년 1월

