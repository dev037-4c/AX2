async function getJobStatus(jobId) {
    try {
        // Job ID 검증
        if (!jobId || typeof jobId !== 'string') {
            return { success: false, error: { code: 'INVALID_INPUT', message: '유효하지 않은 Job ID입니다.' } };
        }
        
        // 안전한 Job ID 정제
        const sanitizedId = window.SecurityUtils ? window.SecurityUtils.sanitizeJobId(jobId) : jobId;
        if (!sanitizedId) {
            return { success: false, error: { code: 'INVALID_INPUT', message: '유효하지 않은 Job ID 형식입니다.' } };
        }
        
        // URL 인코딩
        const encodedId = window.SecurityUtils ? window.SecurityUtils.encodeURL(sanitizedId) : encodeURIComponent(sanitizedId);
        
        // 인증된 요청
        const options = {};
        if (window.TokenManager) {
            window.TokenManager.addAuthHeader(options);
        }
        
        const response = await fetch(`/api/jobs/${encodedId}`, options);
        
        if (!response.ok) {
            return { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } };
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Job 상태 조회 오류:', error);
        return { success: false, error: { code: 'NETWORK_ERROR', message: '네트워크 오류가 발생했습니다.' } };
    }
}

async function getJobSubtitles(jobId, originalLang = 'ko', targetLangs = ['en'], duration = 60) {
    try {
        // Job ID 검증
        if (!jobId || typeof jobId !== 'string') {
            return { success: false, error: { code: 'INVALID_INPUT', message: '유효하지 않은 Job ID입니다.' } };
        }
        
        // 안전한 Job ID 정제
        const sanitizedId = window.SecurityUtils ? window.SecurityUtils.sanitizeJobId(jobId) : jobId;
        if (!sanitizedId) {
            return { success: false, error: { code: 'INVALID_INPUT', message: '유효하지 않은 Job ID 형식입니다.' } };
        }
        
        // 언어 코드 검증 (영문자, 하이픈만 허용)
        const langRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
        if (!langRegex.test(originalLang)) {
            originalLang = 'ko'; // 기본값으로 대체
        }
        
        // targetLangs 검증
        const safeTargetLangs = Array.isArray(targetLangs) 
            ? targetLangs.filter(lang => langRegex.test(lang))
            : (langRegex.test(targetLangs) ? [targetLangs] : ['en']);
        
        // duration 검증 (숫자, 양수)
        const safeDuration = Math.max(0, Math.min(3600, parseInt(duration) || 60));
        
        // URL 파라미터 인코딩
        const encodedId = window.SecurityUtils ? window.SecurityUtils.encodeURL(sanitizedId) : encodeURIComponent(sanitizedId);
        const targetLangsStr = safeTargetLangs.join(',');
        const encodedOriginalLang = window.SecurityUtils ? window.SecurityUtils.encodeURL(originalLang) : encodeURIComponent(originalLang);
        const encodedTargetLangs = window.SecurityUtils ? window.SecurityUtils.encodeURL(targetLangsStr) : encodeURIComponent(targetLangsStr);
        
        // 인증된 요청
        const options = {};
        if (window.TokenManager) {
            window.TokenManager.addAuthHeader(options);
        }
        
        const response = await fetch(`/api/jobs/${encodedId}/subtitles?originalLang=${encodedOriginalLang}&targetLangs=${encodedTargetLangs}&duration=${safeDuration}`, options);
        
        if (!response.ok) {
            return { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } };
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('자막 데이터 조회 오류:', error);
        return { success: false, error: { code: 'NETWORK_ERROR', message: '네트워크 오류가 발생했습니다.' } };
    }
}

async function getCompletedJobs() {
    try {
        const response = await fetch('/api/jobs?status=completed');
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('완료된 Job 목록 조회 오류:', error);
        return { success: false, error: { code: 'NETWORK_ERROR', message: '네트워크 오류가 발생했습니다.' } };
    }
}


