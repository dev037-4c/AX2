/**
 * 인증 API 호출 유틸리티
 * 서버 인증 API와 통신
 */

(async function() {
    'use strict';

    const API_BASE_URL = '/api/v1/auth';

    /**
     * 이메일 로그인
     * @param {string} email - 이메일
     * @param {string} password - 비밀번호
     * @returns {Promise<Object>} 로그인 결과
     */
    async function loginWithEmail(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || {
                        code: 'LOGIN_ERROR',
                        message: '로그인에 실패했습니다.'
                    }
                };
            }

            if (result.success && result.data) {
                // JWT 토큰 저장
                if (window.TokenManager && result.data.accessToken) {
                    window.TokenManager.saveAccessToken(
                        result.data.accessToken,
                        result.data.expiresIn || 3600
                    );
                    
                    if (result.data.refreshToken) {
                        window.TokenManager.saveRefreshToken(result.data.refreshToken);
                    }
                }

                // 사용자 정보 저장 (기존 방식과 호환)
                if (result.data.user) {
                    const userData = {
                        id: result.data.user.userId,
                        email: result.data.user.email,
                        name: result.data.user.name,
                        picture: result.data.user.picture,
                        provider: result.data.user.provider || 'email',
                        loginTime: new Date().toISOString()
                    };
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                    localStorage.setItem('isLoggedIn', 'true');
                }

                return {
                    success: true,
                    data: result.data.user,
                    tokens: {
                        accessToken: result.data.accessToken,
                        refreshToken: result.data.refreshToken
                    }
                };
            }

            return {
                success: false,
                error: {
                    code: 'LOGIN_ERROR',
                    message: '로그인에 실패했습니다.'
                }
            };

        } catch (error) {
            console.error('로그인 API 오류:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: '네트워크 오류가 발생했습니다.'
                }
            };
        }
    }

    /**
     * 회원가입
     * @param {string} email - 이메일
     * @param {string} password - 비밀번호
     * @param {string} name - 이름
     * @returns {Promise<Object>} 회원가입 결과
     */
    async function signupWithEmail(email, password, name) {
        try {
            const response = await fetch(`${API_BASE_URL}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, name })
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || {
                        code: 'SIGNUP_ERROR',
                        message: '회원가입에 실패했습니다.'
                    }
                };
            }

            return {
                success: true,
                data: result.data
            };

        } catch (error) {
            console.error('회원가입 API 오류:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: '네트워크 오류가 발생했습니다.'
                }
            };
        }
    }

    /**
     * 토큰 갱신
     * @returns {Promise<Object>} 갱신 결과
     */
    async function refreshToken() {
        try {
            if (!window.TokenManager) {
                return { success: false, error: { code: 'TOKEN_MANAGER_NOT_AVAILABLE' } };
            }

            const refreshToken = window.TokenManager.getRefreshToken();
            if (!refreshToken) {
                return { success: false, error: { code: 'NO_REFRESH_TOKEN' } };
            }

            const response = await fetch(`${API_BASE_URL}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            const result = await response.json();

            if (!response.ok) {
                // Refresh Token도 만료되었으면 로그아웃
                if (response.status === 401) {
                    window.TokenManager.clearTokens();
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('currentUser');
                    window.dispatchEvent(new CustomEvent('tokenExpired'));
                }
                return {
                    success: false,
                    error: result.error || {
                        code: 'REFRESH_ERROR',
                        message: '토큰 갱신에 실패했습니다.'
                    }
                };
            }

            if (result.success && result.data && result.data.accessToken) {
                window.TokenManager.saveAccessToken(
                    result.data.accessToken,
                    result.data.expiresIn || 3600
                );
                return { success: true, data: result.data };
            }

            return { success: false, error: { code: 'REFRESH_ERROR' } };

        } catch (error) {
            console.error('토큰 갱신 오류:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: '네트워크 오류가 발생했습니다.'
                }
            };
        }
    }

    /**
     * 현재 사용자 정보 조회
     * @returns {Promise<Object>} 사용자 정보
     */
    async function getCurrentUser() {
        try {
            const options = {};
            if (window.TokenManager) {
                window.TokenManager.addAuthHeader(options);
            }

            const response = await fetch(`${API_BASE_URL}/me`, options);

            if (!response.ok) {
                if (response.status === 401) {
                    // 토큰 만료 시 갱신 시도
                    const refreshed = await refreshToken();
                    if (refreshed.success) {
                        // 갱신 후 재시도
                        const retryOptions = {};
                        window.TokenManager.addAuthHeader(retryOptions);
                        const retryResponse = await fetch(`${API_BASE_URL}/me`, retryOptions);
                        if (retryResponse.ok) {
                            const retryResult = await retryResponse.json();
                            return { success: true, data: retryResult.data };
                        }
                    }
                }
                return {
                    success: false,
                    error: {
                        code: 'USER_FETCH_ERROR',
                        message: '사용자 정보를 가져올 수 없습니다.'
                    }
                };
            }

            const result = await response.json();
            return {
                success: true,
                data: result.data
            };

        } catch (error) {
            console.error('사용자 정보 조회 오류:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: '네트워크 오류가 발생했습니다.'
                }
            };
        }
    }

    /**
     * 이메일로 사용자 확인 (비밀번호 없이)
     * @param {string} email - 이메일
     * @returns {Promise<Object>} 사용자 존재 여부 및 정보
     */
    async function checkUserByEmail(email) {
        try {
            // 먼저 LocalStorage에서 확인
            try {
                const users = JSON.parse(localStorage.getItem('users') || '[]');
                const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
                if (user) {
                    return {
                        success: true,
                        exists: true,
                        user: {
                            userId: user.id,
                            email: user.email,
                            name: user.name,
                            picture: user.picture,
                            provider: user.provider || 'email'
                        }
                    };
                }
            } catch (e) {
                // LocalStorage 오류 무시
            }
            
            // 백엔드 API로 확인 시도
            // 백엔드에 이메일만으로 사용자 확인하는 API가 있다면 사용
            try {
                // 백엔드 API 경로 확인 (실제 API가 있다면 사용)
                // 현재는 /api/auth/check-email 같은 엔드포인트가 없으므로
                // LocalStorage만 사용
            } catch (apiError) {
                // API 오류 무시하고 LocalStorage 결과 반환
            }
            
            return {
                success: true,
                exists: false
            };

        } catch (error) {
            console.error('사용자 확인 오류:', error);
            return {
                success: false,
                exists: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: '사용자 확인 중 오류가 발생했습니다.'
                }
            };
        }
    }

    /**
     * 로그아웃
     */
    function logout() {
        // 토큰 제거
        if (window.TokenManager) {
            window.TokenManager.clearTokens();
        }
        
        // 로그인 상태 제거
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('currentUser');
        
        // 로그인 버튼 업데이트
        if (window.updateLoginButton) {
            window.updateLoginButton();
        }
    }

    // 전역으로 노출
    window.AuthAPI = {
        loginWithEmail,
        signupWithEmail,
        refreshToken,
        getCurrentUser,
        checkUserByEmail,
        logout
    };

})();


