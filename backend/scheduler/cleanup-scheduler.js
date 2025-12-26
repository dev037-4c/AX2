/**
 * 정리 스케줄러
 * 만료된 영상 파일을 주기적으로 삭제
 */

const cron = require('node-cron');
const videoUpload = require('../api/video-upload');
const db = require('../db/index');

/**
 * 만료된 파일 정리 작업
 */
async function cleanupExpiredFiles() {
    try {
        console.log(`[${new Date().toISOString()}] 만료된 파일 정리 시작...`);
        
        const deletedCount = await videoUpload.deleteExpiredFiles(db);
        
        console.log(`[${new Date().toISOString()}] 만료된 파일 ${deletedCount}개 삭제 완료`);
        
        return deletedCount;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 만료된 파일 정리 오류:`, error);
        throw error;
    }
}

/**
 * 스케줄러 시작
 * 매일 새벽 2시에 실행
 */
function startScheduler() {
    // 매일 새벽 2시에 실행
    cron.schedule('0 2 * * *', async () => {
        await cleanupExpiredFiles();
    });
    
    // 개발 환경에서는 1시간마다 실행 (테스트용)
    if (process.env.NODE_ENV === 'development') {
        cron.schedule('0 * * * *', async () => {
            await cleanupExpiredFiles();
        });
    }
    
    console.log('정리 스케줄러가 시작되었습니다.');
    console.log('  - 프로덕션: 매일 새벽 2시');
    console.log('  - 개발: 매시간');
}

/**
 * 수동 실행 (테스트용)
 */
async function runManually() {
    console.log('수동으로 만료된 파일 정리 실행...');
    await cleanupExpiredFiles();
}

module.exports = {
    startScheduler,
    cleanupExpiredFiles,
    runManually
};



