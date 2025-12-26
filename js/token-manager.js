/**
 * JWT 토큰 관리 유틸리티
 * 토큰 저장, 갱신, API 요청 헤더 추가
 */

(function() {
    'use strict';

    const TOKEN_KEY = 'ax2_access_token';
    const REFRESH_TOKEN_KEY = 'ax2_refresh_token';
    const TOKEN_EXPIRY_KEY = 'ax2_token_expiry';

    /**
     * Access Token 저장
     * @param {string} token - JWT Access Token
     * @param {number} expiresIn - 만료 시간 (초)
     */
    function saveAccessToken(token, expiresIn = 3600) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
            const expiryTime = Date.now() + (expiresIn * 1000);
            localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        } catch (error) {
            console.error('토큰 저장 오류:', error);
        }
    }

    /**
     * Refresh Token 저장
     * @param {string} token - JWT Refresh Token
     */
    function saveRefreshToken(token) {
        try {
            localStorage.setItem(REFRESH_TOKEN_KEY, token);
        } catch (error) {
            console.error('Refresh Token 저장 오류:', error);
        }
    }

    /**
     * Access Token 가져오기
     * @returns {string|null} Access Token 또는 null
     */
    function getAccessToken() {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) {
                return null;
            }

            // 만료 확인
            const expiryTime = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
            if (Date.now() >= expiryTime) {
                // 만료된 토큰 제거
                clearTokens();
                return null;
            }

            return token;
        } catch (error) {
            console.error('토큰 가져오기 오류:', error);
            return null;
        }
    }

    /**
     * Refresh Token 가져오기
     * @returns {string|null} Refresh Token 또는 null
     */
    function getRefreshToken() {
        try {
            return localStorage.getItem(REFRESH_TOKEN_KEY);
        } catch (error) {
            console.error('Refresh Token 가져오기 오류:', error);
            return null;
        }
    }

    /**
     * 토큰이 유효한지 확인
     * @returns {boolean} 유효성 여부
     */
    function isTokenValid() {
        const token = getAccessToken();
        return token !== null;
    }

    /**
     * 토큰 만료까지 남은 시간 (초)
     * @returns {number} 남은 시간 (초), 만료되었으면 0
     */
    function getTokenExpiryTime() {
        try {
            const expiryTime = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
            const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
            return remaining;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 토큰 갱신
     * @returns {Promise<boolean>} 갱신 성공 여부
     */
    async function refreshAccessToken() {
        try {
            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                return false;
            }

            const response = await fetch('/api/v1/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                // Refresh Token도 만료되었으면 로그아웃
                if (response.status === 401) {
                    clearTokens();
                    // 로그아웃 이벤트 발생
                    window.dispatchEvent(new CustomEvent('tokenExpired'));
                }
                return false;
            }

            const result = await response.json();
            if (result.success && result.data && result.data.accessToken) {
                saveAccessToken(result.data.accessToken, result.data.expiresIn || 3600);
                return true;
            }

            return false;
        } catch (error) {
            console.error('토큰 갱신 오류:', error);
            return false;
        }
    }

    /**
     * 모든 토큰 제거
     */
    function clearTokens() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            localStorage.removeItem(TOKEN_EXPIRY_KEY);
        } catch (error) {
            console.error('토큰 제거 오류:', error);
        }
    }

    /**
     * API 요청 헤더에 토큰 추가
     * @param {Object} options - fetch 옵션
     * @returns {Object} 토큰이 추가된 옵션
     */
    function addAuthHeader(options = {}) {
        const token = getAccessToken();
        if (token) {
            if (!options.headers) {
                options.headers = {};
            }
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        return options;
    }

    /**
     * 인증된 fetch 요청 (자동 토큰 갱신 포함)
     * @param {string} url - 요청 URL
     * @param {Object} options - fetch 옵션
     * @returns {Promise<Response>} fetch 응답
     */
    async function authenticatedFetch(url, options = {}) {
        // 토큰이 만료되기 전에 자동 갱신 (5분 전)
        const expiryTime = getTokenExpiryTime();
        if (expiryTime > 0 && expiryTime < 300) {
            await refreshAccessToken();
        }

        // 헤더에 토큰 추가
        const optionsWithAuth = addAuthHeader(options);

        let response = await fetch(url, optionsWithAuth);

        // 401 에러 시 토큰 갱신 시도
        if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // 토큰 갱신 후 재시도
                const retryOptions = addAuthHeader(options);
                response = await fetch(url, retryOptions);
            }
        }

        return response;
    }

    // 전역으로 노출
    window.TokenManager = {
        saveAccessToken,
        saveRefreshToken,
        getAccessToken,
        getRefreshToken,
        isTokenValid,
        getTokenExpiryTime,
        refreshAccessToken,
        clearTokens,
        addAuthHeader,
        authenticatedFetch
    };

    // 토큰 만료 이벤트 리스너
    window.addEventListener('tokenExpired', () => {
        // 로그아웃 처리
        if (window.handleLogout) {
            window.handleLogout();
        } else {
            // 로그인 페이지로 리디렉션
            const isInHtmlFolder = window.location.pathname.includes('/html/');
            window.location.href = isInHtmlFolder ? 'login.html' : 'html/login.html';
        }
    });

    // 주기적으로 토큰 만료 확인 (1분마다)
    setInterval(() => {
        const expiryTime = getTokenExpiryTime();
        if (expiryTime === 0 && getAccessToken()) {
            // 만료된 토큰 제거
            clearTokens();
            window.dispatchEvent(new CustomEvent('tokenExpired'));
        }
    }, 60000);

})();


