        // 소셜 인증 공통 모듈 (최적화)
        (function() {
            'use strict';
            
            // 프로덕션 환경에서 console.log 비활성화
            const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const logger = {
                log: isDev ? console.log.bind(console) : () => {},
                error: console.error.bind(console),
                warn: isDev ? console.warn.bind(console) : () => {}
            };
            
            // 설정 (실제 사용 시 환경 변수나 설정 파일에서 가져와야 함)
            // OAuth 클라이언트 ID 설정 방법:
            // 1. Google: https://console.cloud.google.com/apis/credentials 에서 OAuth 2.0 클라이언트 ID 생성
            // 2. Kakao: https://developers.kakao.com/ 에서 앱 등록 후 JavaScript 키 발급
            // 3. Naver: https://developers.naver.com/apps/#/register 에서 앱 등록 후 Client ID 발급
            // 
            // 개발 환경에서는 localStorage에서 설정을 읽어올 수 있습니다:
            // localStorage.setItem('social_config', JSON.stringify({ google: { clientId: '...' }, kakao: { jsKey: '...' }, naver: { clientId: '...' } }));
            const SOCIAL_CONFIG = (function() {
                try {
                    const savedConfig = localStorage.getItem('social_config');
                    if (savedConfig) {
                        const parsed = JSON.parse(savedConfig);
                        return {
                            google: {
                                clientId: parsed.google?.clientId || 'YOUR_GOOGLE_CLIENT_ID',
                                scope: 'profile email'
                            },
                            kakao: {
                                jsKey: parsed.kakao?.jsKey || 'YOUR_KAKAO_JS_KEY',
                                redirectUri: window.location.origin + '/html/login.html'
                            },
                            naver: {
                                clientId: parsed.naver?.clientId || 'YOUR_NAVER_CLIENT_ID',
                                callbackUrl: window.location.origin + '/html/login.html'
                            }
                        };
                    }
                } catch (e) {
                    logger.warn('저장된 소셜 로그인 설정을 불러오지 못했습니다:', e);
                }
                
                return {
                    google: {
                        clientId: 'YOUR_GOOGLE_CLIENT_ID', // 실제 Google Client ID로 교체 필요 (예: '123456789-abc.apps.googleusercontent.com')
                        scope: 'profile email'
                    },
                    kakao: {
                        jsKey: 'YOUR_KAKAO_JS_KEY', // 실제 Kakao JavaScript Key로 교체 필요 (예: 'abc123def456...')
                        redirectUri: window.location.origin + '/html/login.html'
                    },
                    naver: {
                        clientId: 'YOUR_NAVER_CLIENT_ID', // 실제 Naver Client ID로 교체 필요 (예: 'abc123def456...')
                        callbackUrl: window.location.origin + '/html/login.html'
                    }
                };
            })();
            
            // SDK 로딩 상태 추적
            const sdkStatus = {
                google: false,
                kakao: false,
                naver: false
            };
            
            // 백엔드 API로 소셜 로그인 처리 (실패 시 Mock 로그인으로 fallback)
            async function handleSocialLogin(provider, token, providerId, userInfo) {
                try {
                    let apiUrl = `/api/auth/social/${provider}`;
                    
                    // 개발 환경에서 백엔드 서버가 다른 포트에 있을 수 있음
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        // 백엔드 서버가 다른 포트에 있다면 여기서 설정
                        // 예: apiUrl = 'http://localhost:3000/api/auth/social/' + provider;
                    }
                    
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            token: token,
                            providerId: providerId
                        })
                    });

                    // 네트워크 오류 처리
                    if (!response.ok) {
                        let errorMessage = '소셜 로그인에 실패했습니다.';
                        try {
                            const result = await response.json();
                            errorMessage = result.error?.message || errorMessage;
                        } catch (e) {
                            if (response.status === 0 || response.status >= 500) {
                                // 백엔드 서버가 없으면 Mock 로그인으로 fallback
                                logger.warn('백엔드 서버에 연결할 수 없습니다. Mock 로그인을 사용합니다.');
                                return handleMockLogin(provider, providerId, userInfo);
                            } else if (response.status === 404) {
                                // API 엔드포인트가 없으면 Mock 로그인으로 fallback
                                logger.warn('API 엔드포인트를 찾을 수 없습니다. Mock 로그인을 사용합니다.');
                                return handleMockLogin(provider, providerId, userInfo);
                            }
                        }
                        throw new Error(errorMessage);
                    }

                    const result = await response.json();

                    if (!result.success) {
                        throw new Error(result.error?.message || '소셜 로그인에 실패했습니다.');
                    }

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

                    // 사용자 정보 저장
                    if (result.data.user) {
                        const userData = {
                            id: result.data.user.userId,
                            email: result.data.user.email,
                            name: result.data.user.name,
                            picture: result.data.user.picture,
                            provider: result.data.user.provider || provider,
                            providerId: providerId,
                            loginTime: new Date().toISOString()
                        };
                        
                        localStorage.setItem('currentUser', JSON.stringify(userData));
                        localStorage.setItem('isLoggedIn', 'true');
                        
                        // 로그인 버튼 업데이트
                        if (window.updateLoginButton) {
                            window.updateLoginButton();
                        }
                        
                        return userData;
                    }

                    throw new Error('사용자 정보를 받아오지 못했습니다.');
                } catch (error) {
                    logger.error('백엔드 소셜 로그인 오류:', error);
                    
                    // 네트워크 오류인 경우 Mock 로그인으로 자동 fallback
                    if (error.message.includes('Failed to fetch') || 
                        error.message.includes('NetworkError') || 
                        error.message.includes('fetch')) {
                        logger.warn('백엔드 서버에 연결할 수 없습니다. Mock 로그인을 사용합니다.');
                        return handleMockLogin(provider, providerId, userInfo);
                    }
                    
                    throw error;
                }
            }
            
            // Mock 로그인 처리 (백엔드 서버 없이 작동)
            function handleMockLogin(provider, providerId, userInfo) {
                try {
                    const userData = {
                        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        email: userInfo.email || `${providerId}@${provider}.social`,
                        name: userInfo.name || `${provider} User`,
                        picture: userInfo.picture || null,
                        provider: provider,
                        providerId: providerId,
                        loginTime: new Date().toISOString(),
                        isMock: true
                    };
                    
                    // Mock 토큰 생성 (간단한 형태)
                    const mockToken = btoa(JSON.stringify({
                        userId: userData.id,
                        email: userData.email,
                        exp: Math.floor(Date.now() / 1000) + 3600
                    }));
                    
                    // TokenManager에 저장 (있는 경우)
                    if (window.TokenManager) {
                        window.TokenManager.saveAccessToken(mockToken, 3600);
                    }
                    
                    // 사용자 정보 저장
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                    localStorage.setItem('isLoggedIn', 'true');
                    
                    // 로그인 버튼 업데이트
                    if (window.updateLoginButton) {
                        window.updateLoginButton();
                    }
                    
                    logger.log('Mock 로그인 성공:', userData);
                    return userData;
                } catch (error) {
                    logger.error('Mock 로그인 처리 오류:', error);
                    throw new Error('Mock 로그인 처리 중 오류가 발생했습니다: ' + error.message);
                }
            }
            
            // 로그인 상태 저장 (기존 호환성 유지)
            function saveLoginState(user) {
                try {
                    const loginData = {
                        userId: user.id || user.userId,
                        email: user.email,
                        name: user.name,
                        provider: user.provider || 'email',
                        loginTime: new Date().toISOString()
                    };
                    localStorage.setItem('currentUser', JSON.stringify(loginData));
                    localStorage.setItem('isLoggedIn', 'true');
                    
                    // 로그인 버튼 업데이트 (auth-state.js가 로드된 경우)
                    if (window.updateLoginButton) {
                        window.updateLoginButton();
                    }
                    
                    return true;
                } catch (error) {
                    logger.error('로그인 상태 저장 오류:', error);
                    return false;
                }
            }
            
            // Google SDK 로드 (최적화: 동적 로딩)
            function loadGoogleSDK() {
                return new Promise((resolve, reject) => {
                    if (sdkStatus.google) {
                        resolve();
                        return;
                    }
                    
                    if (window.gapi && window.gapi.auth2) {
                        sdkStatus.google = true;
                        resolve();
                        return;
                    }
                    
                    // Google API 스크립트 동적 로드
                    const script = document.createElement('script');
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.async = true;
                    script.defer = true;
                    script.onload = () => {
                        logger.log('Google SDK 로드 완료');
                        sdkStatus.google = true;
                        resolve();
                    };
                    script.onerror = () => {
                        logger.error('Google SDK 로드 실패');
                        reject(new Error('Google SDK 로드 실패'));
                    };
                    document.head.appendChild(script);
                });
            }
            
            // Kakao SDK 로드 (최적화: 동적 로딩)
            function loadKakaoSDK() {
                return new Promise((resolve, reject) => {
                    if (sdkStatus.kakao) {
                        resolve();
                        return;
                    }
                    
                    if (window.Kakao && window.Kakao.isInitialized()) {
                        sdkStatus.kakao = true;
                        resolve();
                        return;
                    }
                    
                    // Kakao SDK 스크립트 동적 로드
                    const script = document.createElement('script');
                    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
                    script.integrity = 'sha384-TiCueOO6HuAI1AiZ8LKvIMLfKpLKY86hKcF84y4s1Pc5R3pYd+Nc+KPI5M9zFz';
                    script.crossOrigin = 'anonymous';
                    script.async = true;
                    script.onload = () => {
                        if (window.Kakao && SOCIAL_CONFIG.kakao.jsKey) {
                            window.Kakao.init(SOCIAL_CONFIG.kakao.jsKey);
                            logger.log('Kakao SDK 로드 및 초기화 완료');
                            sdkStatus.kakao = true;
                            resolve();
                        } else {
                            reject(new Error('Kakao SDK 초기화 실패'));
                        }
                    };
                    script.onerror = () => {
                        logger.error('Kakao SDK 로드 실패');
                        reject(new Error('Kakao SDK 로드 실패'));
                    };
                    document.head.appendChild(script);
                });
            }
            
            // Naver SDK 로드 (최적화: 동적 로딩)
            function loadNaverSDK() {
                return new Promise((resolve, reject) => {
                    if (sdkStatus.naver) {
                        resolve();
                        return;
                    }
                    
                    if (window.naver && window.naver.Login) {
                        sdkStatus.naver = true;
                        resolve();
                        return;
                    }
                    
                    // Naver Login API 스크립트 동적 로드
                    const script = document.createElement('script');
                    script.src = 'https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js';
                    script.async = true;
                    script.onload = () => {
                        logger.log('Naver SDK 로드 완료');
                        sdkStatus.naver = true;
                        resolve();
                    };
                    script.onerror = () => {
                        logger.error('Naver SDK 로드 실패');
                        reject(new Error('Naver SDK 로드 실패'));
                    };
                    document.head.appendChild(script);
                });
            }
            
            // Google 로그인 (Google Identity Services 사용)
            async function loginWithGoogle() {
                try {
                    if (!SOCIAL_CONFIG.google.clientId || SOCIAL_CONFIG.google.clientId === 'YOUR_GOOGLE_CLIENT_ID') {
                        // 개발 환경: Mock 로그인 처리
                        logger.warn('Google Client ID가 설정되지 않았습니다. Mock 로그인을 사용합니다.');
                        const mockProviderId = `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        return await handleSocialLogin(
                            'google',
                            'mock_token',
                            mockProviderId,
                            {
                                name: 'Google User (Mock)',
                                email: `google_${mockProviderId}@google.social`,
                                picture: null
                            }
                        );
                    }
                    
                    await loadGoogleSDK();
                    
                    return new Promise((resolve, reject) => {
                        if (!window.google) {
                            reject(new Error('Google SDK가 로드되지 않았습니다.'));
                            return;
                        }
                        
                        window.google.accounts.id.initialize({
                            client_id: SOCIAL_CONFIG.google.clientId,
                            callback: async (response) => {
                                try {
                                    // JWT 토큰 디코딩
                                    const payload = JSON.parse(atob(response.credential.split('.')[1]));
                                    
                                    // 백엔드 API로 소셜 로그인 처리
                                    const userData = await handleSocialLogin(
                                        'google',
                                        response.credential,
                                        payload.sub,
                                        {
                                            name: payload.name || 'Google User',
                                            email: payload.email,
                                            picture: payload.picture
                                        }
                                    );
                                    
                                    resolve(userData);
                                } catch (error) {
                                    logger.error('Google 로그인 처리 오류:', error);
                                    reject(error);
                                }
                            }
                        });
                        
                        window.google.accounts.id.prompt((notification) => {
                            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                                // 프롬프트가 표시되지 않으면 One Tap 대신 팝업 사용
                                window.google.accounts.oauth2.initTokenClient({
                                    client_id: SOCIAL_CONFIG.google.clientId,
                                    scope: SOCIAL_CONFIG.google.scope,
                                    callback: async (tokenResponse) => {
                                        try {
                                            // 사용자 정보 가져오기
                                            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                                                headers: {
                                                    'Authorization': `Bearer ${tokenResponse.access_token}`
                                                }
                                            });
                                            const userInfo = await userInfoResponse.json();
                                            
                                            // 백엔드 API로 소셜 로그인 처리
                                            const userData = await handleSocialLogin(
                                                'google',
                                                tokenResponse.access_token,
                                                userInfo.id,
                                                {
                                                    name: userInfo.name || 'Google User',
                                                    email: userInfo.email,
                                                    picture: userInfo.picture
                                                }
                                            );
                                            
                                            resolve(userData);
                                        } catch (error) {
                                            logger.error('Google 사용자 정보 가져오기 오류:', error);
                                            reject(error);
                                        }
                                    }
                                }).requestAccessToken();
                            }
                        });
                    });
                } catch (error) {
                    logger.error('Google 로그인 오류:', error);
                    throw error;
                }
            }
            
            // Kakao 로그인
            async function loginWithKakao() {
                try {
                    if (!SOCIAL_CONFIG.kakao.jsKey || SOCIAL_CONFIG.kakao.jsKey === 'YOUR_KAKAO_JS_KEY') {
                        // 개발 환경: Mock 로그인 처리
                        logger.warn('Kakao JavaScript Key가 설정되지 않았습니다. Mock 로그인을 사용합니다.');
                        const mockProviderId = `kakao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        return await handleSocialLogin(
                            'kakao',
                            'mock_token',
                            mockProviderId,
                            {
                                name: 'Kakao User (Mock)',
                                email: `kakao_${mockProviderId}@kakao.social`,
                                picture: null
                            }
                        );
                    }
                    
                    await loadKakaoSDK();
                    
                    return new Promise((resolve, reject) => {
                        if (!window.Kakao || !window.Kakao.isInitialized()) {
                            reject(new Error('Kakao SDK가 초기화되지 않았습니다.'));
                            return;
                        }
                        
                        window.Kakao.Auth.login({
                            success: async (authObj) => {
                                try {
                                    // 사용자 정보 가져오기
                                    window.Kakao.API.request({
                                        url: '/v2/user/me',
                                        success: async (res) => {
                                            try {
                                                // 백엔드 API로 소셜 로그인 처리
                                                const userData = await handleSocialLogin(
                                                    'kakao',
                                                    authObj.access_token,
                                                    res.id.toString(),
                                                    {
                                                        name: res.kakao_account.profile?.nickname || 'Kakao User',
                                                        email: res.kakao_account.email || `kakao_${res.id}@kakao.com`,
                                                        picture: res.kakao_account.profile?.profile_image_url
                                                    }
                                                );
                                                
                                                resolve(userData);
                                            } catch (error) {
                                                logger.error('Kakao 로그인 처리 오류:', error);
                                                reject(error);
                                            }
                                        },
                                        fail: (err) => {
                                            logger.error('Kakao 사용자 정보 가져오기 오류:', err);
                                            reject(err);
                                        }
                                    });
                                } catch (error) {
                                    logger.error('Kakao 로그인 처리 오류:', error);
                                    reject(error);
                                }
                            },
                            fail: (err) => {
                                logger.error('Kakao 로그인 오류:', err);
                                reject(err);
                            }
                        });
                    });
                } catch (error) {
                    logger.error('Kakao 로그인 오류:', error);
                    throw error;
                }
            }
            
            // Naver 로그인 (리다이렉트 방식)
            async function loginWithNaver() {
                try {
                    if (!SOCIAL_CONFIG.naver.clientId || SOCIAL_CONFIG.naver.clientId === 'YOUR_NAVER_CLIENT_ID') {
                        // 개발 환경: Mock 로그인 처리
                        logger.warn('Naver Client ID가 설정되지 않았습니다. Mock 로그인을 사용합니다.');
                        const mockProviderId = `naver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        return await handleSocialLogin(
                            'naver',
                            'mock_token',
                            mockProviderId,
                            {
                                name: 'Naver User (Mock)',
                                email: `naver_${mockProviderId}@naver.social`,
                                picture: null
                            }
                        );
                    }
                    
                    // Naver OAuth 인증 페이지로 리다이렉트
                    const state = Math.random().toString(36).substring(2, 15);
                    sessionStorage.setItem('naver_oauth_state', state);
                    
                    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${SOCIAL_CONFIG.naver.clientId}&redirect_uri=${encodeURIComponent(SOCIAL_CONFIG.naver.callbackUrl)}&state=${state}`;
                    
                    window.location.href = naverAuthUrl;
                } catch (error) {
                    logger.error('Naver 로그인 오류:', error);
                    throw error;
                }
            }
            
            // Naver OAuth 콜백 처리 (콜백 페이지에서 호출)
            async function handleNaverCallback(code, state) {
                try {
                    // State 검증
                    const savedState = sessionStorage.getItem('naver_oauth_state');
                    if (state !== savedState) {
                        throw new Error('State 검증 실패');
                    }
                    sessionStorage.removeItem('naver_oauth_state');
                    
                    // Access Token 가져오기 (백엔드에서 처리하거나 여기서 처리)
                    // 여기서는 간단하게 providerId만 사용
                    const providerId = code; // 실제로는 토큰에서 사용자 ID를 가져와야 함
                    
                    // 백엔드 API로 소셜 로그인 처리
                    const userData = await handleSocialLogin(
                        'naver',
                        code, // 실제로는 access token
                        providerId,
                        {
                            name: 'Naver User',
                            email: `naver_${providerId}@naver.com`,
                            picture: null
                        }
                    );
                    
                    return userData;
                } catch (error) {
                    logger.error('Naver 콜백 처리 오류:', error);
                    throw error;
                }
            }
            
            // 전역 함수로 내보내기
            window.SocialAuth = {
                loginWithGoogle,
                loginWithKakao,
                loginWithNaver,
                handleNaverCallback,
                loadGoogleSDK,
                loadKakaoSDK,
                loadNaverSDK,
                saveLoginState,
                handleSocialLogin
            };
            
            logger.log('소셜 인증 모듈 로드 완료');
        })();

