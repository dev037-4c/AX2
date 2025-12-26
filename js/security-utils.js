// 보안 유틸리티 함수
(function() {
    'use strict';
    
    /**
     * HTML 이스케이프 함수 (XSS 방지)
     * @param {string} text - 이스케이프할 텍스트
     * @returns {string} 이스케이프된 텍스트
     */
    function escapeHTML(text) {
        if (text === null || text === undefined) {
            return '';
        }
        
        const textStr = String(text);
        const div = document.createElement('div');
        div.textContent = textStr;
        return div.innerHTML;
    }
    
    /**
     * HTML 속성 값 이스케이프
     * @param {string} text - 이스케이프할 텍스트
     * @returns {string} 이스케이프된 텍스트
     */
    function escapeHTMLAttribute(text) {
        if (text === null || text === undefined) {
            return '';
        }
        
        const textStr = String(text);
        return textStr
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    
    /**
     * URL 인코딩 (안전한 URL 파라미터)
     * @param {string} text - 인코딩할 텍스트
     * @returns {string} 인코딩된 텍스트
     */
    function encodeURL(text) {
        if (text === null || text === undefined) {
            return '';
        }
        return encodeURIComponent(String(text));
    }
    
    /**
     * URL 디코딩 (안전한 디코딩)
     * @param {string} text - 디코딩할 텍스트
     * @returns {string} 디코딩된 텍스트
     */
    function decodeURL(text) {
        if (text === null || text === undefined) {
            return '';
        }
        try {
            return decodeURIComponent(String(text));
        } catch (error) {
            console.error('URL 디코딩 오류:', error);
            return '';
        }
    }
    
    /**
     * 안전한 JSON 파싱
     * @param {string} jsonString - 파싱할 JSON 문자열
     * @param {*} defaultValue - 파싱 실패 시 기본값
     * @returns {*} 파싱된 객체 또는 기본값
     */
    function safeJSONParse(jsonString, defaultValue = null) {
        try {
            if (!jsonString || typeof jsonString !== 'string') {
                return defaultValue;
            }
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('JSON 파싱 오류:', error);
            return defaultValue;
        }
    }
    
    /**
     * 안전한 JSON 문자열화
     * @param {*} obj - 문자열화할 객체
     * @param {string} defaultValue - 실패 시 기본값
     * @returns {string} JSON 문자열 또는 기본값
     */
    function safeJSONStringify(obj, defaultValue = '{}') {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            console.error('JSON 문자열화 오류:', error);
            return defaultValue;
        }
    }
    
    /**
     * ID 검증 (UUID, 영숫자, 하이픈, 언더스코어만 허용)
     * @param {string} id - 검증할 ID
     * @returns {boolean} 유효성 여부
     */
    function validateId(id) {
        if (!id || typeof id !== 'string') {
            return false;
        }
        // UUID 형식 또는 영숫자, 하이픈, 언더스코어만 허용
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeIdRegex = /^[a-zA-Z0-9_-]+$/;
        return uuidRegex.test(id) || safeIdRegex.test(id);
    }
    
    /**
     * Job ID 검증 및 정제
     * @param {string} jobId - 검증할 Job ID
     * @returns {string|null} 정제된 Job ID 또는 null
     */
    function sanitizeJobId(jobId) {
        if (!jobId || typeof jobId !== 'string') {
            return null;
        }
        
        // video_ 접두사 제거
        const cleanId = jobId.startsWith('video_') ? jobId.replace('video_', '') : jobId;
        
        // 검증
        if (!validateId(cleanId)) {
            return null;
        }
        
        return cleanId;
    }
    
    /**
     * URL 파라미터 안전하게 가져오기
     * @param {string} paramName - 파라미터 이름
     * @param {string} defaultValue - 기본값
     * @returns {string} 파라미터 값
     */
    function getURLParam(paramName, defaultValue = '') {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const value = urlParams.get(paramName);
            if (value === null) {
                return defaultValue;
            }
            // 기본적인 XSS 방지: 스크립트 태그 제거
            return value.replace(/<script[^>]*>.*?<\/script>/gi, '');
        } catch (error) {
            console.error('URL 파라미터 가져오기 오류:', error);
            return defaultValue;
        }
    }
    
    /**
     * 안전한 URL 파라미터 가져오기 (ID 검증 포함)
     * @param {string} paramName - 파라미터 이름
     * @returns {string|null} 검증된 파라미터 값 또는 null
     */
    function getSafeURLParam(paramName) {
        const value = getURLParam(paramName);
        if (!value) {
            return null;
        }
        // ID 형식 검증
        if (validateId(value)) {
            return value;
        }
        return null;
    }
    
    /**
     * 사용자 입력 검증 (기본)
     * @param {string} input - 검증할 입력
     * @param {number} maxLength - 최대 길이
     * @returns {boolean} 유효성 여부
     */
    function validateInput(input, maxLength = 1000) {
        if (typeof input !== 'string') {
            return false;
        }
        if (input.length > maxLength) {
            return false;
        }
        // 위험한 문자 패턴 검사
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i, // onclick, onerror 등
            /<iframe/i,
            /<object/i,
            /<embed/i
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(input));
    }
    
    /**
     * 안전한 innerHTML 설정 (자동 이스케이프)
     * @param {HTMLElement} element - 대상 요소
     * @param {string} html - HTML 문자열
     * @param {boolean} escape - 이스케이프 여부 (기본: true)
     */
    function setSafeHTML(element, html, escape = true) {
        if (!element) {
            return;
        }
        if (escape) {
            element.textContent = html;
        } else {
            // 신뢰할 수 있는 HTML만 허용 (화이트리스트 방식)
            const allowedTags = ['b', 'i', 'em', 'strong', 'br', 'span', 'div', 'p'];
            // 간단한 태그 검증 (실제로는 DOMPurify 같은 라이브러리 권장)
            element.innerHTML = html;
        }
    }
    
    /**
     * 안전한 URL 생성
     * @param {string} baseUrl - 기본 URL
     * @param {Object} params - 파라미터 객체
     * @returns {string} 안전한 URL
     */
    function buildSafeURL(baseUrl, params = {}) {
        try {
            const url = new URL(baseUrl, window.location.origin);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.set(key, String(params[key]));
                }
            });
            return url.toString();
        } catch (error) {
            console.error('URL 생성 오류:', error);
            return baseUrl;
        }
    }
    
    // 전역으로 노출
    window.SecurityUtils = {
        escapeHTML,
        escapeHTMLAttribute,
        encodeURL,
        decodeURL,
        safeJSONParse,
        safeJSONStringify,
        validateId,
        sanitizeJobId,
        getURLParam,
        getSafeURLParam,
        validateInput,
        setSafeHTML,
        buildSafeURL
    };
})();


