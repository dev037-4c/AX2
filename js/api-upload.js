async function uploadVideoToServer(file) {
    try {
        const formData = new FormData();
        formData.append('video', file);

        // 인증된 요청 (토큰 자동 포함)
        const options = {
            method: 'POST',
            body: formData,
            headers: {}
        };
        
        // 로그인 토큰이 있으면 헤더에 추가
        if (window.TokenManager) {
            window.TokenManager.addAuthHeader(options);
        }
        
        // 게스트 토큰 처리 (비로그인 사용자)
        if (!options.headers['Authorization']) {
            // 저장된 게스트 토큰 확인
            let guestToken = localStorage.getItem('guestToken');
            if (guestToken) {
                options.headers['X-Guest-Token'] = guestToken;
            }
        }

        const response = await fetch('/api/videos/upload', options);

        // 게스트 토큰이 응답 헤더에 있으면 저장
        const responseGuestToken = response.headers.get('X-Guest-Token');
        if (responseGuestToken) {
            localStorage.setItem('guestToken', responseGuestToken);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error || {
                    code: 'UPLOAD_ERROR',
                    message: '파일 업로드에 실패했습니다.'
                }
            };
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('업로드 오류:', error);
        return {
            success: false,
            error: {
                code: 'NETWORK_ERROR',
                message: '네트워크 오류가 발생했습니다.'
            }
        };
    }
}


