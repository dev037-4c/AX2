/**
 * Job 처리 워커 프로세스
 * 별도 프로세스로 실행하여 API 서버 부하 분산
 */

require('dotenv').config();
const db = require('./db');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// 동시 처리 제한
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');
let currentProcessingCount = 0;

// Job 처리 함수
async function processJob(jobId) {
    try {
        logger.logEvent('JOB_STARTED', { jobId });
        
        // Job 상태를 processing으로 변경
        await db.execute(
            `UPDATE video_jobs 
             SET status = 'processing', progress = 10, updated_at = NOW() 
             WHERE id = ? AND status = 'queued'`,
            [jobId]
        );
        
        // 실제 작업 처리 (Mock)
        // TODO: 실제 STT/번역 엔진 연동
        await simulateJobProcessing(jobId);
        
        // 완료 처리
        const completedAt = new Date();
        const expiresAt = new Date(completedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        await db.execute(
            `UPDATE video_jobs 
             SET status = 'completed', 
                 progress = 100, 
                 completed_at = ?, 
                 expires_at = ?,
                 updated_at = NOW() 
             WHERE id = ?`,
            [completedAt, expiresAt, jobId]
        );
        
        // 자막 데이터 생성 및 저장
        const subtitles = generateMockSubtitles();
        const resultsDir = path.join(__dirname, process.env.RESULTS_DIR || 'results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const jsonFilePath = path.join(resultsDir, `${jobId}.json`);
        fs.writeFileSync(jsonFilePath, JSON.stringify(subtitles, null, 2));
        
        // job_results에 저장
        await db.execute(
            `INSERT INTO job_results (job_id, format, file_path) 
             VALUES (?, 'json', ?)
             ON DUPLICATE KEY UPDATE file_path = ?`,
            [jobId, jsonFilePath, jsonFilePath]
        );
        
        logger.logEvent('JOB_COMPLETED', { jobId });
        
    } catch (error) {
        logger.logEvent('JOB_FAILED', {
            jobId,
            error: error.message
        });
        
        // 실패 상태로 업데이트
        await db.execute(
            `UPDATE video_jobs 
             SET status = 'failed', 
                 error_message = ?, 
                 updated_at = NOW() 
             WHERE id = ?`,
            [error.message, jobId]
        );
    } finally {
        currentProcessingCount--;
    }
}

// Mock 작업 처리 (실제로는 STT/번역 엔진 호출)
async function simulateJobProcessing(jobId) {
    // 5초 대기 (실제 작업 시뮬레이션)
    await new Promise(resolve => setTimeout(resolve, 5000));
}

// 더미 자막 생성
function generateMockSubtitles() {
    return [
        {
            id: 1,
            startTime: 0,
            endTime: 3,
            ko: "안녕하세요, 오늘 강의를 시작하겠습니다.",
            en: "Hello, let's start today's lecture."
        },
        {
            id: 2,
            startTime: 3,
            endTime: 6,
            ko: "오늘은 AI 기술에 대해 알아보겠습니다.",
            en: "Today, we will learn about AI technology."
        }
    ];
}

// 큐에서 Job 가져와서 처리
async function processQueue() {
    try {
        // 동시 처리 제한 확인
        if (currentProcessingCount >= MAX_CONCURRENT_JOBS) {
            logger.debug('동시 처리 제한에 도달했습니다.', {
                current: currentProcessingCount,
                max: MAX_CONCURRENT_JOBS
            });
            return;
        }
        
        // 대기 중인 Job 조회
        const [rows] = await db.execute(
            `SELECT id FROM video_jobs 
             WHERE status = 'queued' 
             ORDER BY created_at ASC 
             LIMIT ?`,
            [MAX_CONCURRENT_JOBS - currentProcessingCount]
        );
        
        if (rows.length === 0) {
            return;
        }
        
        // 각 Job 처리 (병렬)
        const promises = rows.map(async (row) => {
            currentProcessingCount++;
            await processJob(row.id);
        });
        
        await Promise.all(promises);
        
    } catch (error) {
        logger.error('큐 처리 오류', {
            error: error.message,
            stack: error.stack
        });
    }
}

// 워커 시작
function startWorker() {
    logger.info('워커 프로세스 시작', {
        maxConcurrentJobs: MAX_CONCURRENT_JOBS
    });
    
    // 주기적으로 큐 확인 (5초마다)
    const interval = setInterval(processQueue, 5000);
    
    // 시작 시 즉시 한 번 실행
    processQueue();
    
    // 종료 시그널 처리
    process.on('SIGTERM', () => {
        logger.info('워커 프로세스 종료 신호 수신');
        clearInterval(interval);
        
        // 진행 중인 작업 완료 대기
        const checkInterval = setInterval(() => {
            if (currentProcessingCount === 0) {
                clearInterval(checkInterval);
                logger.info('워커 프로세스 종료');
                process.exit(0);
            }
        }, 1000);
    });
    
    process.on('SIGINT', () => {
        logger.info('워커 프로세스 중단 신호 수신');
        clearInterval(interval);
        process.exit(0);
    });
}

// 워커 시작
startWorker();


