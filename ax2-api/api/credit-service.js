/**
 * 크레딧 서비스
 * 서버 사이드 크레딧 처리 로직 (MySQL 형식)
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

// 예약 만료 시간 (30분)
const RESERVATION_EXPIRY_MINUTES = 30;

/**
 * 크레딧 계산
 */
function calculateRequiredCredits(durationSeconds, translationLanguageCount = 0) {
    const durationMinutes = Math.ceil(durationSeconds / 60);
    const baseCredits = durationMinutes * CREDIT_PER_MINUTE;
    const translationCredits = durationMinutes * TRANSLATION_CREDIT_PER_MINUTE * translationLanguageCount;
    return baseCredits + translationCredits;
}

/**
 * 크레딧 잔액 조회
 */
async function getCreditBalance(db, userId, deviceId = null, ipAddress = null) {
    try {
        if (userId) {
            // 로그인 사용자
            const [credits] = await db.execute(
                'SELECT balance, free_balance, total_charged FROM credits WHERE user_id = ?',
                [userId]
            );
            
            if (credits.length === 0) {
                // 크레딧 레코드 생성
                await db.execute(
                    'INSERT INTO credits (user_id, balance, free_balance, total_charged) VALUES (?, 0, 0, 0)',
                    [userId]
                );
                return { balance: 0, freeBalance: 0, totalCharged: 0 };
            }
            
            return {
                balance: credits[0].balance,
                freeBalance: credits[0].free_balance,
                totalCharged: credits[0].total_charged
            };
        } else {
            // 비로그인 사용자
            let credits = [];
            
            if (deviceId) {
                [credits] = await db.execute(
                    'SELECT free_balance FROM credits WHERE device_id = ? AND user_id IS NULL',
                    [deviceId]
                );
            } else if (ipAddress) {
                [credits] = await db.execute(
                    'SELECT free_balance FROM credits WHERE ip_address = ? AND user_id IS NULL',
                    [ipAddress]
                );
            }
            
            if (credits.length === 0) {
                // 크레딧 레코드 생성
                await db.execute(
                    'INSERT INTO credits (device_id, ip_address, free_balance) VALUES (?, ?, 0)',
                    [deviceId, ipAddress]
                );
                return { balance: 0, freeBalance: 0, totalCharged: 0 };
            }
            
            return {
                balance: 0,
                freeBalance: credits[0].free_balance,
                totalCharged: 0
            };
        }
    } catch (error) {
        throw error;
    }
}

/**
 * 크레딧 예약 (선차감)
 */
async function reserveCredits(db, jobId, amount, userId = null, deviceId = null, ipAddress = null) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // 잔액 조회
        const creditInfo = await getCreditBalance(db, userId, deviceId, ipAddress);
        const availableBalance = userId ? creditInfo.balance : creditInfo.freeBalance;
        
        // 잔액 부족 확인
        if (availableBalance < amount) {
            await connection.rollback();
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
        
        // 잔액 차감
        if (userId) {
            const [result] = await connection.execute(
                `UPDATE credits 
                 SET balance = balance - ?, updated_at = NOW()
                 WHERE user_id = ? AND balance >= ?`,
                [amount, userId, amount]
            );
            
            if (result.affectedRows === 0) {
                await connection.rollback();
                return {
                    success: false,
                    error: 'INSUFFICIENT_CREDITS',
                    message: '크레딧이 부족합니다.'
                };
            }
        } else {
            let updateQuery;
            let updateParams;
            
            if (deviceId) {
                updateQuery = `UPDATE credits 
                               SET free_balance = free_balance - ?, updated_at = NOW()
                               WHERE device_id = ? AND user_id IS NULL AND free_balance >= ?`;
                updateParams = [amount, deviceId, amount];
            } else if (ipAddress) {
                updateQuery = `UPDATE credits 
                               SET free_balance = free_balance - ?, updated_at = NOW()
                               WHERE ip_address = ? AND user_id IS NULL AND free_balance >= ?`;
                updateParams = [amount, ipAddress, amount];
            } else {
                await connection.rollback();
                return {
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: '비로그인 사용자는 device_id 또는 ip_address가 필요합니다.'
                };
            }
            
            const [result] = await connection.execute(updateQuery, updateParams);
            
            if (result.affectedRows === 0) {
                await connection.rollback();
                return {
                    success: false,
                    error: 'INSUFFICIENT_CREDITS',
                    message: '크레딧이 부족합니다.'
                };
            }
        }
        
        // 예약 만료 시간
        const expiresAt = new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000);
        
        // 예약 내역 저장
        await connection.execute(
            `INSERT INTO credit_reservations 
             (reservation_id, user_id, job_id, amount, status, reserved_at, expires_at)
             VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
            [reservationId, userId, jobId, amount, ReservationStatus.RESERVED, expiresAt]
        );
        
        // 크레딧 사용 내역 저장
        const newCreditInfo = await getCreditBalance(db, userId, deviceId, ipAddress);
        const newBalance = userId ? newCreditInfo.balance : newCreditInfo.freeBalance;
        
        await connection.execute(
            `INSERT INTO credit_history 
             (user_id, type, amount, balance_after, description, job_id, reservation_id)
             VALUES (?, 'reservation', ?, ?, ?, ?, ?)`,
            [userId, -amount, newBalance, `작업 예약: ${jobId}`, jobId, reservationId]
        );
        
        await connection.commit();
        
        return {
            success: true,
            reservationId: reservationId,
            balance: newBalance,
            amount: amount
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 예약된 크레딧 확정 차감
 */
async function confirmDeduction(db, reservationId, jobId) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // 예약 조회
        const [reservations] = await connection.execute(
            `SELECT reservation_id, user_id, amount, status 
             FROM credit_reservations 
             WHERE reservation_id = ? AND job_id = ?`,
            [reservationId, jobId]
        );
        
        if (reservations.length === 0) {
            await connection.rollback();
            return false;
        }
        
        const reservation = reservations[0];
        
        if (reservation.status === ReservationStatus.CONFIRMED) {
            await connection.rollback();
            return true;
        }
        
        if (reservation.status === ReservationStatus.REFUNDED) {
            await connection.rollback();
            return false;
        }
        
        // 예약 상태를 확정으로 변경
        await connection.execute(
            `UPDATE credit_reservations 
             SET status = ?, confirmed_at = NOW()
             WHERE reservation_id = ?`,
            [ReservationStatus.CONFIRMED, reservationId]
        );
        
        // 크레딧 사용 내역 업데이트
        await connection.execute(
            `UPDATE credit_history 
             SET type = 'use', description = ?
             WHERE reservation_id = ? AND type = 'reservation'`,
            [`작업 완료: ${jobId}`, reservationId]
        );
        
        await connection.commit();
        return true;
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 예약된 크레딧 환불
 */
async function refundCredits(db, reservationId, jobId, reason, partialAmount = null) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // 예약 조회
        const [reservations] = await connection.execute(
            `SELECT reservation_id, user_id, amount, status 
             FROM credit_reservations 
             WHERE reservation_id = ? AND job_id = ?`,
            [reservationId, jobId]
        );
        
        if (reservations.length === 0) {
            await connection.rollback();
            return {
                success: false,
                error: 'RESERVATION_NOT_FOUND',
                message: '예약을 찾을 수 없습니다.'
            };
        }
        
        const reservation = reservations[0];
        
        if (reservation.status === ReservationStatus.REFUNDED) {
            await connection.rollback();
            return {
                success: false,
                error: 'ALREADY_REFUNDED',
                message: '이미 환불된 예약입니다.'
            };
        }
        
        const refundAmount = partialAmount !== null ? partialAmount : reservation.amount;
        
        // 잔액 복구
        if (reservation.user_id) {
            await connection.execute(
                `UPDATE credits 
                 SET balance = balance + ?, updated_at = NOW()
                 WHERE user_id = ?`,
                [refundAmount, reservation.user_id]
            );
        }
        
        // 예약 상태를 환불로 변경
        await connection.execute(
            `UPDATE credit_reservations 
             SET status = ?, refunded_at = NOW()
             WHERE reservation_id = ?`,
            [ReservationStatus.REFUNDED, reservationId]
        );
        
        // 환불 내역 저장
        const creditInfo = await getCreditBalance(db, reservation.user_id);
        const newBalance = reservation.user_id ? creditInfo.balance : creditInfo.freeBalance;
        
        await connection.execute(
            `INSERT INTO credit_history 
             (user_id, type, amount, balance_after, description, job_id, reservation_id)
             VALUES (?, 'refund', ?, ?, ?, ?, ?)`,
            [reservation.user_id, refundAmount, newBalance, reason, jobId, reservationId]
        );
        
        await connection.commit();
        
        return {
            success: true,
            reservationId: reservationId,
            refundAmount: refundAmount,
            balance: newBalance
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    calculateRequiredCredits,
    getCreditBalance,
    reserveCredits,
    confirmDeduction,
    refundCredits,
    ReservationStatus
};


