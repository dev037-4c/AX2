// 전역 로딩 안전장치
// 모든 스크립트가 로드되지 않아도 페이지가 정상적으로 표시되도록 보장

(function() {
    'use strict';
    
    // 페이지 로드 완료 강제 표시 (5초 후)
    const forcePageReady = setTimeout(() => {
        console.warn('페이지 로드 타임아웃: 강제로 로딩 완료 처리');
        
        // 모든 로딩 화면 숨김
        const loadingScreens = document.querySelectorAll('[id*="loading"], [class*="loading"]');
        loadingScreens.forEach(screen => {
            if (screen.style) {
                screen.style.display = 'none';
            }
        });
        
        // body에 로드 완료 클래스 추가
        document.body.classList.add('page-ready');
        
        // 커스텀 이벤트 발생
        document.dispatchEvent(new CustomEvent('forcePageReady'));
    }, 5000);
    
    // 페이지가 정상적으로 로드되면 타임아웃 취소
    window.addEventListener('load', () => {
        clearTimeout(forcePageReady);
    });
    
    // DOMContentLoaded가 발생하면 타임아웃 연장 (추가 2초)
    document.addEventListener('DOMContentLoaded', () => {
        clearTimeout(forcePageReady);
        
        // 추가 안전장치: 2초 후에도 로딩 화면이 있으면 숨김
        setTimeout(() => {
            const loadingScreens = document.querySelectorAll('[id*="loading"], [class*="loading"]');
            loadingScreens.forEach(screen => {
                const computedStyle = window.getComputedStyle(screen);
                if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                    console.warn('로딩 화면 강제 숨김:', screen.id || screen.className);
                    if (screen.style) {
                        screen.style.display = 'none';
                    }
                }
            });
        }, 2000);
    });
    
    // 에러 발생 시에도 로딩 화면 숨김
    window.addEventListener('error', (event) => {
        console.error('페이지 에러 발생:', event.error);
        const loadingScreens = document.querySelectorAll('[id*="loading"], [class*="loading"]');
        loadingScreens.forEach(screen => {
            if (screen.style) {
                screen.style.display = 'none';
            }
        });
    });
    
    // 스크립트 로드 실패 감지
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
        script.addEventListener('error', () => {
            console.error('스크립트 로드 실패:', script.src);
        });
    });
})();



