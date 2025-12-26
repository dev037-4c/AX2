/**
 * 업로드 쿼터 미들웨어
 * 사용자별 업로드 용량 제한
 */

const db = require('../db');
const { AppError, ERROR_CODES } = require('./error-handler');
const logger = require('../utils/logger');

// 쿼터 설정 (바이트 단위)
const QUOTA_LIMITS = {
    // 비로그인 사용자: 100MB/일
    guest: {
        daily: 100 * 1024 * 1024,  // 100MB
        monthly: 0  // 월별 제한 없음 (일별만)
    },
    // 무료 사용자: 1GB/월
    free: {
        daily: 0,  // 일별 제한 없음
        monthly: 1 * 1024 * 1024 * 1024  // 1GB
    },
    // 유료 사용자: 10GB/월
    paid: {
        daily: 0,
        monthly: 10 * 1024 * 1024 * 1024  // 10GB
    }
};

/**
 * 사용자 타입 결정
 */
function getUserType(user) {
    if (!user) {
        return 'guest';
    }
    
    // TODO: 실제 요금제 정보를 DB에서 가져오기
    // 현재는 기본값으로 'free' 반환
    const plan = user.plan || 'free';
    return plan === 'paid' ? 'paid' : 'free';
}

/**
 * 일별 사용량 계산
 */
async function getDailyUsage(userId, date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    
    const [rows] = await db.execute(
        `SELECT COALESCE(SUM(size), 0) as total_size
         FROM video_jobs
         WHERE user_id = ? 
         AND DATE(created_at) = ?
         AND status != 'deleted'`,
        [userId, dateStr]
    );
    
    return rows[0]?.total_size || 0;
}

/**
 * 월별 사용량 계산
 */
async function getMonthlyUsage(userId, date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    const [rows] = await db.execute(
        `SELECT COALESCE(SUM(size), 0) as total_size
         FROM video_jobs
         WHERE user_id = ?
         AND YEAR(created_at) = ?
         AND MONTH(created_at) = ?
         AND status != 'deleted'`,
        [userId, year, month]
    );
    
    return rows[0]?.total_size || 0;
}

/**
 * 비로그인 사용자 일별 사용량 계산 (IP 기반)
 */
async function getGuestDailyUsage(ip, date = new Date()) {
    // 비로그인 사용자는 IP로 추적 (간단한 구현)
    // 실제로는 더 정교한 추적 필요
    const dateStr = date.toISOString().split('T')[0];
    
    // TODO: IP 기반 사용량 추적 테이블 필요
    // 현재는 간단히 user_id가 NULL인 작업만 확인
    const [rows] = await db.execute(
        `SELECT COALESCE(SUM(size), 0) as total_size
         FROM video_jobs
         WHERE user_id IS NULL
         AND DATE(created_at) = ?
         AND status != 'deleted'`,
        [dateStr]
    );
    
    return rows[0]?.total_size || 0;
}

/**
 * 업로드 쿼터 검증 미들웨어
 */
async function checkUploadQuota(req, res, next) {
    try {
        const user = req.user;
        const userType = getUserType(user);
        const quota = QUOTA_LIMITS[userType];
        
        if (!quota) {
            logger.warn('알 수 없는 사용자 타입', {
                requestId: req.requestId,
                userId: user?.userId || null,
                userType
            });
            return next();
        }
        
        // 파일 크기 (아직 업로드 전이므로 req.body에서 추정)
        // 실제로는 multer에서 req.file.size로 확인
        const fileSize = req.file?.size || 0;
        
        if (fileSize === 0) {
            // 파일이 아직 업로드되지 않았으면 다음 미들웨어로
            return next();
        }
        
        // 일별 제한 확인
        if (quota.daily > 0) {
            let dailyUsage = 0;
            
            if (user) {
                dailyUsage = await getDailyUsage(user.userId);
            } else {
                // 비로그인 사용자는 IP 기반
                const ip = req.ip || req.connection.remoteAddress;
                dailyUsage = await getGuestDailyUsage(ip);
            }
            
            if (dailyUsage + fileSize > quota.daily) {
                const remaining = quota.daily - dailyUsage;
                const remainingMB = Math.round(remaining / 1024 / 1024);
                
                logger.warn('일별 업로드 쿼터 초과', {
                    requestId: req.requestId,
                    userId: user?.userId || null,
                    userType,
                    dailyUsage,
                    fileSize,
                    quota: quota.daily
                });
                
                return res.status(429).json({
                    success: false,
                    error: {
                        code: 'QUOTA_EXCEEDED',
                        message: `일별 업로드 용량을 초과했습니다. 남은 용량: ${remainingMB}MB`,
                        details: {
                            limit: quota.daily,
                            used: dailyUsage,
                            remaining: remaining
                        }
                    }
                });
            }
        }
        
        // 월별 제한 확인
        if (quota.monthly > 0 && user) {
            const monthlyUsage = await getMonthlyUsage(user.userId);
            
            if (monthlyUsage + fileSize > quota.monthly) {
                const remaining = quota.monthly - monthlyUsage;
                const remainingGB = (remaining / 1024 / 1024 / 1024).toFixed(2);
                
                logger.warn('월별 업로드 쿼터 초과', {
                    requestId: req.requestId,
                    userId: user.userId,
                    userType,
                    monthlyUsage,
                    fileSize,
                    quota: quota.monthly
                });
                
                return res.status(429).json({
                    success: false,
                    error: {
                        code: 'QUOTA_EXCEEDED',
                        message: `월별 업로드 용량을 초과했습니다. 남은 용량: ${remainingGB}GB`,
                        details: {
                            limit: quota.monthly,
                            used: monthlyUsage,
                            remaining: remaining
                        }
                    }
                });
            }
        }
        
        next();
        
    } catch (error) {
        logger.error('업로드 쿼터 검증 오류', {
            requestId: req.requestId,
            error: error.message
        });
        
        // 오류 발생 시 업로드 허용 (안전 장치)
        next();
    }
}

module.exports = {
    checkUploadQuota,
    getUserType,
    getDailyUsage,
    getMonthlyUsage,
    QUOTA_LIMITS
};


