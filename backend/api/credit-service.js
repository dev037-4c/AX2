/**
 * 크레딧 서비스
 * 서버 사이드 크레딧 처리 로직
 * 
 * 기능:
 * - 크레딧 선차감(예약)
 * - 작업 실패 시 환불
 * - 중복 요청 방지
 * - 비로그인 / 로그인 분리 처리
 */

// 크레딧 계산 상수
const CREDIT_PER_MINUTE = 10; // 분당 기본 크레딧
const TRANSLATION_CREDIT_PER_MINUTE = 5; // 번역 언어당 분당 추가 크레딧

// 예약 상태
const ReservationStatus = {
    RESERVED: 'reserved',
    CONFIRMED: 'confirmed',
    REFUNDED: 'refunded',
    EXPIRED: 'expired'
};

// 중복 요청 방지를 위한 임시 저장소 (실제로는 Redis 사용 권장)
const pendingReservations = new Map(); // jobId -> reservationId
const reservationLocks = new Map(); // reservationId -> lock timestamp

// 예약 만료 시간 (30분)
const RESERVATION_EXPIRY_MINUTES = 30;

/**
 * 크레딧 계산
 * @param {number} durationSeconds - 영상 길이 (초)
 * @param {number} translationLanguageCount - 번역 언어 수
 * @returns {number} 필요한 크레딧
 */
function calculateRequiredCredits(durationSeconds, translationLanguageCount = 0) {
    // 영상 길이를 분 단위로 올림 처리 (61초 → 2분)
    const durationMinutes = Math.ceil(durationSeconds / 60);
    
    // 기본 자막 생성: 분당 10 크레딧
    const baseCredits = durationMinutes * CREDIT_PER_MINUTE;
    
    // 번역 자막: 언어당 분당 5 크레딧
    const translationCredits = durationMinutes * TRANSLATION_CREDIT_PER_MINUTE * translationLanguageCount;
    
    return baseCredits + translationCredits;
}

/**
 * 크레딧 잔액 조회
 * @param {Object} db - 데이터베이스 연결
 * @param {string|null} userId - 사용자 ID (null: 비로그인)
 * @param {string|null} deviceId - 디바이스 ID (비로그인 사용자)
 * @param {string|null} ipAddress - IP 주소 (비로그인 사용자)
 * @returns {Promise<Object>} 크레딧 정보
 */
async function getCreditBalance(db, userId, deviceId = null, ipAddress = null) {
    try {
        if (userId) {
            // 로그인 사용자: user_id로 조회
            const result = await db.query(
                'SELECT balance, free_balance, total_charged FROM credits WHERE user_id = $1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                // 크레딧 레코드가 없으면 생성
                await db.query(
                    'INSERT INTO credits (user_id, balance, free_balance, total_charged) VALUES ($1, 0, 0, 0)',
                    [userId]
                );
                return { balance: 0, freeBalance: 0, totalCharged: 0 };
            }
            
            const credit = result.rows[0];
            return {
                balance: credit.balance,
                freeBalance: credit.free_balance,
                totalCharged: credit.total_charged
            };
        } else {
            // 비로그인 사용자: device_id 또는 ip_address로 조회
            let result;
            
            if (deviceId) {
                result = await db.query(
                    'SELECT balance, free_balance FROM credits WHERE device_id = $1 AND user_id IS NULL',
                    [deviceId]
                );
            } else if (ipAddress) {
                result = await db.query(
                    'SELECT balance, free_balance FROM credits WHERE ip_address = $1 AND user_id IS NULL',
                    [ipAddress]
                );
            } else {
                throw new Error('비로그인 사용자는 device_id 또는 ip_address가 필요합니다.');
            }
            
            if (result.rows.length === 0) {
                // 크레딧 레코드가 없으면 생성
                await db.query(
                    'INSERT INTO credits (device_id, ip_address, balance, free_balance) VALUES ($1, $2, 0, 0)',
                    [deviceId, ipAddress]
                );
                return { balance: 0, freeBalance: 0, totalCharged: 0 };
            }
            
            const credit = result.rows[0];
            return {
                balance: 0, // 비로그인 사용자는 balance 사용 안 함
                freeBalance: credit.free_balance,
                totalCharged: 0
            };
        }
    } catch (error) {
        console.error('크레딧 잔액 조회 오류:', error);
        throw error;
    }
}

/**
 * 크레딧 예약 (선차감)
 * @param {Object} db - 데이터베이스 연결
 * @param {string} jobId - 작업 ID
 * @param {number} amount - 예약할 크레딧
 * @param {string|null} userId - 사용자 ID (null: 비로그인)
 * @param {string|null} deviceId - 디바이스 ID (비로그인 사용자)
 * @param {string|null} ipAddress - IP 주소 (비로그인 사용자)
 * @returns {Promise<Object>} 예약 결과
 */
async function reserveCredits(db, jobId, amount, userId = null, deviceId = null, ipAddress = null) {
    // 트랜잭션 시작
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // 중복 요청 방지: 동일한 jobId로 이미 예약이 있는지 확인
        if (pendingReservations.has(jobId)) {
            const existingReservationId = pendingReservations.get(jobId);
            
            // 기존 예약이 유효한지 확인
            const existingReservation = await client.query(
                'SELECT reservation_id, status FROM credit_reservations WHERE reservation_id = $1',
                [existingReservationId]
            );
            
            if (existingReservation.rows.length > 0) {
                const reservation = existingReservation.rows[0];
                if (reservation.status === ReservationStatus.RESERVED || reservation.status === ReservationStatus.CONFIRMED) {
                    await client.query('ROLLBACK');
                    return {
                        success: false,
                        error: 'DUPLICATE_REQUEST',
                        message: '이미 처리 중인 요청입니다.',
                        existingReservationId: existingReservationId
                    };
                }
            }
        }
        
        // 잔액 조회
        const creditInfo = await getCreditBalance(db, userId, deviceId, ipAddress);
        
        // 사용할 크레딧 결정 (로그인: balance, 비로그인: free_balance)
        const availableBalance = userId ? creditInfo.balance : creditInfo.freeBalance;
        
        // 잔액 부족 확인
        if (availableBalance < amount) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: 'INSUFFICIENT_CREDITS',
                message: '크레딧이 부족합니다.',
                required: amount,
                balance: availableBalance
            };
        }
        
        // 예약 ID 생성
        const reservationId = `reserve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 잔액 차감 (SELECT FOR UPDATE로 동시성 제어)
        if (userId) {
            const updateResult = await client.query(
                `UPDATE credits 
                 SET balance = balance - $1, updated_at = NOW()
                 WHERE user_id = $2 AND balance >= $1
                 RETURNING balance`,
                [amount, userId]
            );
            
            if (updateResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'INSUFFICIENT_CREDITS',
                    message: '크레딧이 부족합니다.'
                };
            }
        } else {
            // 비로그인 사용자: device_id 또는 ip_address로 업데이트
            let updateQuery;
            let updateParams;
            
            if (deviceId) {
                updateQuery = `UPDATE credits 
                               SET free_balance = free_balance - $1, updated_at = NOW()
                               WHERE device_id = $2 AND user_id IS NULL AND free_balance >= $1
                               RETURNING free_balance`;
                updateParams = [amount, deviceId];
            } else if (ipAddress) {
                updateQuery = `UPDATE credits 
                               SET free_balance = free_balance - $1, updated_at = NOW()
                               WHERE ip_address = $2 AND user_id IS NULL AND free_balance >= $1
                               RETURNING free_balance`;
                updateParams = [amount, ipAddress];
            } else {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: '비로그인 사용자는 device_id 또는 ip_address가 필요합니다.'
                };
            }
            
            const updateResult = await client.query(updateQuery, updateParams);
            
            if (updateResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'INSUFFICIENT_CREDITS',
                    message: '크레딧이 부족합니다.'
                };
            }
        }
        
        // 예약 만료 시간 계산
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + RESERVATION_EXPIRY_MINUTES);
        
        // 예약 내역 저장
        await client.query(
            `INSERT INTO credit_reservations 
             (reservation_id, user_id, job_id, amount, status, reserved_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [reservationId, userId, jobId, amount, ReservationStatus.RESERVED, expiresAt]
        );
        
        // 크레딧 사용 내역 저장 (예약)
        const newBalance = userId ? 
            (await getCreditBalance(db, userId)).balance :
            (await getCreditBalance(db, null, deviceId, ipAddress)).freeBalance;
        
        await client.query(
            `INSERT INTO credit_history 
             (user_id, type, amount, balance_after, description, job_id, reservation_id)
             VALUES ($1, 'reservation', $2, $3, $4, $5, $6)`,
            [
                userId,
                -amount, // 음수: 차감
                newBalance,
                `작업 예약: ${jobId}`,
                jobId,
                reservationId
            ]
        );
        
        // 중복 요청 방지 맵에 추가
        pendingReservations.set(jobId, reservationId);
        reservationLocks.set(reservationId, Date.now());
        
        await client.query('COMMIT');
        
        return {
            success: true,
            reservationId: reservationId,
            balance: newBalance,
            amount: amount
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('크레딧 예약 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 예약된 크레딧 확정 차감
 * @param {Object} db - 데이터베이스 연결
 * @param {string} reservationId - 예약 ID
 * @param {string} jobId - 작업 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function confirmDeduction(db, reservationId, jobId) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // 예약 조회 및 상태 확인
        const reservationResult = await client.query(
            `SELECT reservation_id, user_id, amount, status 
             FROM credit_reservations 
             WHERE reservation_id = $1 AND job_id = $2`,
            [reservationId, jobId]
        );
        
        if (reservationResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return false;
        }
        
        const reservation = reservationResult.rows[0];
        
        // 이미 확정되었거나 환불된 경우
        if (reservation.status === ReservationStatus.CONFIRMED) {
            await client.query('ROLLBACK');
            return true; // 이미 확정됨
        }
        
        if (reservation.status === ReservationStatus.REFUNDED) {
            await client.query('ROLLBACK');
            return false; // 이미 환불됨
        }
        
        // 예약 상태를 확정으로 변경
        await client.query(
            `UPDATE credit_reservations 
             SET status = $1, confirmed_at = NOW()
             WHERE reservation_id = $2`,
            [ReservationStatus.CONFIRMED, reservationId]
        );
        
        // 크레딧 사용 내역 업데이트 (예약 → 사용)
        await client.query(
            `UPDATE credit_history 
             SET type = 'use', description = $1
             WHERE reservation_id = $2 AND type = 'reservation'`,
            [`작업 완료: ${jobId}`, reservationId]
        );
        
        // 중복 요청 방지 맵에서 제거
        pendingReservations.delete(jobId);
        reservationLocks.delete(reservationId);
        
        await client.query('COMMIT');
        return true;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('크레딧 확정 차감 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 예약된 크레딧 환불
 * @param {Object} db - 데이터베이스 연결
 * @param {string} reservationId - 예약 ID
 * @param {string} jobId - 작업 ID
 * @param {string} reason - 환불 사유
 * @param {number|null} partialAmount - 부분 환불 금액 (전액 환불 시 null)
 * @returns {Promise<Object>} 환불 결과
 */
async function refundCredits(db, reservationId, jobId, reason, partialAmount = null) {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // 예약 조회 및 상태 확인
        const reservationResult = await client.query(
            `SELECT reservation_id, user_id, amount, status 
             FROM credit_reservations 
             WHERE reservation_id = $1 AND job_id = $2`,
            [reservationId, jobId]
        );
        
        if (reservationResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: 'RESERVATION_NOT_FOUND',
                message: '예약을 찾을 수 없습니다.'
            };
        }
        
        const reservation = reservationResult.rows[0];
        
        // 이미 환불된 경우
        if (reservation.status === ReservationStatus.REFUNDED) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: 'ALREADY_REFUNDED',
                message: '이미 환불된 예약입니다.'
            };
        }
        
        // 환불할 크레딧 계산
        const refundAmount = partialAmount !== null ? partialAmount : reservation.amount;
        
        if (refundAmount > reservation.amount) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: 'INVALID_REFUND_AMOUNT',
                message: '환불 금액이 예약 금액을 초과할 수 없습니다.'
            };
        }
        
        // 잔액 복구
        if (reservation.user_id) {
            // 로그인 사용자: balance 복구
            await client.query(
                `UPDATE credits 
                 SET balance = balance + $1, updated_at = NOW()
                 WHERE user_id = $2`,
                [refundAmount, reservation.user_id]
            );
        } else {
            // 비로그인 사용자: free_balance 복구
            // user_id가 null이므로 job_id로 credit_reservations에서 device_id나 ip_address를 찾아야 함
            // 실제로는 credit_reservations 테이블에 device_id, ip_address를 추가하거나
            // credits 테이블과 조인하여 찾아야 함
            // 여기서는 간단히 처리 (실제 구현 시 수정 필요)
            await client.query(
                `UPDATE credits 
                 SET free_balance = free_balance + $1, updated_at = NOW()
                 WHERE credit_id IN (
                     SELECT credit_id FROM credits c
                     JOIN credit_reservations cr ON c.user_id = cr.user_id
                     WHERE cr.reservation_id = $2
                 )`,
                [refundAmount, reservationId]
            );
        }
        
        // 예약 상태를 환불로 변경
        await client.query(
            `UPDATE credit_reservations 
             SET status = $1, refunded_at = NOW()
             WHERE reservation_id = $2`,
            [ReservationStatus.REFUNDED, reservationId]
        );
        
        // 환불 내역 저장
        const creditInfo = await getCreditBalance(db, reservation.user_id);
        const newBalance = reservation.user_id ? creditInfo.balance : creditInfo.freeBalance;
        
        await client.query(
            `INSERT INTO credit_history 
             (user_id, type, amount, balance_after, description, job_id, reservation_id)
             VALUES ($1, 'refund', $2, $3, $4, $5, $6)`,
            [
                reservation.user_id,
                refundAmount, // 양수: 환불
                newBalance,
                reason,
                jobId,
                reservationId
            ]
        );
        
        // 중복 요청 방지 맵에서 제거
        pendingReservations.delete(jobId);
        reservationLocks.delete(reservationId);
        
        await client.query('COMMIT');
        
        return {
            success: true,
            reservationId: reservationId,
            refundAmount: refundAmount,
            balance: newBalance
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('크레딧 환불 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 만료된 예약 정리 (스케줄러에서 주기적으로 실행)
 * @param {Object} db - 데이터베이스 연결
 * @returns {Promise<number>} 정리된 예약 수
 */
async function cleanupExpiredReservations(db) {
    try {
        const result = await db.query(
            `UPDATE credit_reservations 
             SET status = $1
             WHERE status = $2 AND expires_at < NOW()`,
            [ReservationStatus.EXPIRED, ReservationStatus.RESERVED]
        );
        
        // 만료된 예약의 크레딧 환불
        const expiredReservations = await db.query(
            `SELECT reservation_id, user_id, job_id, amount 
             FROM credit_reservations 
             WHERE status = $1`,
            [ReservationStatus.EXPIRED]
        );
        
        let refundedCount = 0;
        for (const reservation of expiredReservations.rows) {
            const refundResult = await refundCredits(
                db,
                reservation.reservation_id,
                reservation.job_id,
                '예약 만료로 인한 자동 환불'
            );
            
            if (refundResult.success) {
                refundedCount++;
            }
        }
        
        return refundedCount;
    } catch (error) {
        console.error('만료된 예약 정리 오류:', error);
        throw error;
    }
}

module.exports = {
    calculateRequiredCredits,
    getCreditBalance,
    reserveCredits,
    confirmDeduction,
    refundCredits,
    cleanupExpiredReservations,
    ReservationStatus
};



