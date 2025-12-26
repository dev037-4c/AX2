/**
 * 기존 alert/confirm을 ModalUtils로 자동 교체하는 헬퍼
 * 이 파일을 로드하면 기존 alert/confirm이 자동으로 ModalUtils로 교체됩니다.
 * 
 * 주의: confirm()은 Promise를 반환하므로 async/await를 사용해야 합니다.
 * 예: const result = await confirm('정말 삭제하시겠습니까?');
 */

(function() {
    'use strict';
    
    // ModalUtils가 로드되었는지 확인
    if (typeof ModalUtils === 'undefined') {
        console.warn('ModalUtils가 로드되지 않았습니다. modal-utils.js를 먼저 로드하세요.');
        return;
    }
    
    // 원본 함수 저장 (필요시 사용)
    if (typeof window.originalAlert === 'undefined') {
        window.originalAlert = window.alert;
    }
    if (typeof window.originalConfirm === 'undefined') {
        window.originalConfirm = window.confirm;
    }
    
    // alert 오버라이드
    window.alert = function(message) {
        return ModalUtils.alert(message, '알림', { type: 'info' });
    };
    
    // confirm 오버라이드 (Promise 반환)
    window.confirm = function(message) {
        return new Promise((resolve) => {
            ModalUtils.confirm(
                message,
                '확인',
                {
                    confirmText: '확인',
                    cancelText: '취소',
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                }
            );
        });
    };
    
    // 개발 환경에서만 로그 출력
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('✅ ModalUtils가 alert/confirm을 오버라이드했습니다.');
    }
})();



