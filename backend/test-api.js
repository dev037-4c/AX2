/**
 * API 테스트 스크립트
 * Node.js로 직접 API를 테스트하는 예제
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3000/api/v1';

// HTTP 요청 헬퍼 함수
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE_URL);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// 테스트 실행
async function runTests() {
    console.log('=================================');
    console.log('AX2 Caption API 테스트');
    console.log('=================================\n');

    try {
        // 1. 헬스 체크
        console.log('1. 헬스 체크 테스트...');
        const healthCheck = await makeRequest('GET', '/health');
        console.log('   상태:', healthCheck.status);
        console.log('   응답:', JSON.stringify(healthCheck.data, null, 2));
        console.log('');

        // 2. 작업 생성
        console.log('2. 작업 생성 테스트...');
        const createJobResponse = await makeRequest('POST', '/jobs', {
            videoId: 'video_test_123',
            originalLanguage: 'auto',
            targetLanguages: ['en', 'ja'],
            speakers: 1,
            duration: 60
        });
        console.log('   상태:', createJobResponse.status);
        console.log('   응답:', JSON.stringify(createJobResponse.data, null, 2));
        
        if (!createJobResponse.data.success) {
            console.error('   ❌ 작업 생성 실패');
            return;
        }
        
        const jobId = createJobResponse.data.data.jobId;
        console.log('   ✅ 작업 생성 성공 - jobId:', jobId);
        console.log('');

        // 3. 작업 조회 (처리 중)
        console.log('3. 작업 조회 테스트 (처리 중)...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        const getJobResponse1 = await makeRequest('GET', `/jobs/${jobId}`);
        console.log('   상태:', getJobResponse1.status);
        console.log('   작업 상태:', getJobResponse1.data.data.status);
        console.log('   진행률:', getJobResponse1.data.data.progress + '%');
        console.log('   현재 단계:', getJobResponse1.data.data.currentStep);
        console.log('');

        // 4. 작업 조회 (완료 대기)
        console.log('4. 작업 완료 대기 중...');
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30; // 최대 30번 시도 (약 30초)
        
        while (!completed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            attempts++;
            
            const getJobResponse = await makeRequest('GET', `/jobs/${jobId}`);
            const status = getJobResponse.data.data.status;
            const progress = getJobResponse.data.data.progress;
            
            console.log(`   [${attempts}초] 상태: ${status}, 진행률: ${progress}%`);
            
            if (status === 'completed') {
                completed = true;
                console.log('   ✅ 작업 완료!');
                console.log('');
                
                // 5. 완료된 작업 결과 조회
                console.log('5. 완료된 작업 결과 조회...');
                const finalResponse = getJobResponse;
                const result = finalResponse.data.data.result;
                
                console.log('   감지된 언어:', result.detectedLanguage);
                console.log('   원본 자막 수:', result.originalSubtitles.length);
                console.log('   번역 언어:', Object.keys(result.translatedSubtitles));
                
                // 첫 번째 자막 샘플 출력
                if (result.originalSubtitles.length > 0) {
                    const firstSubtitle = result.originalSubtitles[0];
                    console.log('   첫 번째 자막 샘플:');
                    console.log(`     시간: ${firstSubtitle.startTime}s - ${firstSubtitle.endTime}s`);
                    console.log(`     텍스트: ${firstSubtitle.text}`);
                }
                console.log('');
                
                // 번역 자막 샘플 출력
                for (const [lang, subtitles] of Object.entries(result.translatedSubtitles)) {
                    if (subtitles.length > 0) {
                        console.log(`   ${lang} 번역 자막 샘플:`);
                        console.log(`     시간: ${subtitles[0].startTime}s - ${subtitles[0].endTime}s`);
                        console.log(`     텍스트: ${subtitles[0].text}`);
                    }
                }
                console.log('');
            } else if (status === 'failed') {
                console.error('   ❌ 작업 실패:', getJobResponse.data.data.error);
                break;
            }
        }
        
        if (!completed) {
            console.log('   ⚠️  작업이 아직 완료되지 않았습니다.');
        }

        // 6. 작업 목록 조회
        console.log('6. 작업 목록 조회 테스트...');
        const getJobsResponse = await makeRequest('GET', '/jobs?limit=5');
        console.log('   상태:', getJobsResponse.status);
        console.log('   작업 수:', getJobsResponse.data.data.jobs.length);
        console.log('   총 작업 수:', getJobsResponse.data.data.pagination.total);
        console.log('');

        console.log('=================================');
        console.log('✅ 모든 테스트 완료!');
        console.log('=================================');

    } catch (error) {
        console.error('❌ 테스트 오류:', error);
    }
}

// 서버가 실행 중인지 확인 후 테스트 실행
console.log('서버가 실행 중인지 확인 중...');
console.log('서버가 실행되지 않은 경우: npm start 또는 npm run dev\n');

// 2초 후 테스트 시작 (서버 시작 시간 확보)
setTimeout(() => {
    runTests();
}, 2000);



