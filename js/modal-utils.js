/**
 * 통합 모달 유틸리티
 * 모든 팝업을 깔끔한 카드 형태로 통일
 */

class ModalUtils {
    /**
     * 알림 모달 표시
     * @param {string} message - 메시지
     * @param {string} title - 제목 (선택)
     * @param {Object} options - 옵션
     */
    static alert(message, title = '알림', options = {}) {
        return new Promise((resolve) => {
            const {
                type = 'info', // info, success, warning, error
                confirmText = '확인',
                onClose = null
            } = options;

            const modal = this.createModal({
                title,
                message,
                type,
                buttons: [{
                    text: confirmText,
                    action: 'confirm',
                    primary: true
                }],
                onClose: () => {
                    if (onClose) onClose();
                    resolve();
                }
            });

            document.body.appendChild(modal);
            this.showModal(modal);
        });
    }

    /**
     * 확인 모달 표시
     * @param {string} message - 메시지
     * @param {string} title - 제목 (선택)
     * @param {Object} options - 옵션
     */
    static confirm(message, title = '확인', options = {}) {
        return new Promise((resolve) => {
            const {
                confirmText = '확인',
                cancelText = '취소',
                confirmType = 'primary',
                onConfirm = null,
                onCancel = null
            } = options;

            const modal = this.createModal({
                title,
                message,
                type: 'warning',
                buttons: [
                    {
                        text: cancelText,
                        action: 'cancel',
                        primary: false
                    },
                    {
                        text: confirmText,
                        action: 'confirm',
                        primary: true,
                        type: confirmType
                    }
                ],
                onConfirm: () => {
                    if (onConfirm) onConfirm();
                    this.hideModal(modal);
                    resolve(true);
                },
                onCancel: () => {
                    if (onCancel) onCancel();
                    this.hideModal(modal);
                    resolve(false);
                }
            });

            document.body.appendChild(modal);
            this.showModal(modal);
        });
    }

    /**
     * 커스텀 모달 생성
     * @param {Object} config - 모달 설정
     * @param {string} config.title - 모달 제목
     * @param {string} config.message - 모달 메시지
     * @param {string} config.type - 모달 타입 (info, success, warning, error)
     * @param {Array} config.buttons - 버튼 배열
     * @param {Function} config.onConfirm - 확인 콜백
     * @param {Function} config.onCancel - 취소 콜백
     * @param {Function} config.onClose - 닫기 콜백
     * @param {boolean} config.showCloseButton - 닫기 버튼 표시 여부
     * @param {boolean} config.closeOnBackdrop - 배경 클릭 시 닫기 여부
     * @returns {HTMLElement} 모달 오버레이 요소
     */
    static createModal(config) {
        const {
            title = '',
            message = '',
            type = 'info', // info, success, warning, error
            buttons = [],
            onConfirm = null,
            onCancel = null,
            onClose = null,
            showCloseButton = true,
            closeOnBackdrop = true
        } = config;

        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'modal-card-overlay';
        
        // 모달 카드 생성
        const modalCard = document.createElement('div');
        modalCard.className = 'modal-card';
        
        // 아이콘 및 타입별 스타일
        const iconMap = {
            info: '<i class="fas fa-info-circle"></i>',
            success: '<i class="fas fa-check-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            error: '<i class="fas fa-times-circle"></i>'
        };

        // 헤더
        const header = document.createElement('div');
        header.className = 'modal-card-header';
        
        if (title) {
            const titleEl = document.createElement('h3');
            titleEl.className = 'modal-card-title';
            titleEl.innerHTML = `<span class="modal-card-icon modal-card-icon-${type}">${iconMap[type] || iconMap.info}</span>${title}`;
            header.appendChild(titleEl);
        }
        
        if (showCloseButton) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-card-close';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.addEventListener('click', () => {
                if (onClose) onClose();
                this.hideModal(overlay);
                if (onCancel) onCancel();
            });
            header.appendChild(closeBtn);
        }
        
        // 본문
        const body = document.createElement('div');
        body.className = 'modal-card-body';
        body.innerHTML = `<p class="modal-card-message">${message.replace(/\n/g, '<br>')}</p>`;
        
        // 푸터 (버튼)
        const footer = document.createElement('div');
        footer.className = 'modal-card-footer';
        
        buttons.forEach((btn, index) => {
            const button = document.createElement('button');
            button.className = `modal-card-button ${btn.primary ? 'modal-card-button-primary' : 'modal-card-button-secondary'}`;
            if (btn.type) {
                button.classList.add(`modal-card-button-${btn.type}`);
            }
            button.textContent = btn.text;
            button.addEventListener('click', () => {
                if (btn.action === 'confirm' && onConfirm) {
                    onConfirm();
                } else if (btn.action === 'cancel' && onCancel) {
                    onCancel();
                }
                if (btn.action === 'confirm' || btn.action === 'cancel') {
                    this.hideModal(overlay);
                }
            });
            footer.appendChild(button);
        });
        
        // 조립
        modalCard.appendChild(header);
        modalCard.appendChild(body);
        if (buttons.length > 0) {
            modalCard.appendChild(footer);
        }
        overlay.appendChild(modalCard);
        
        // 배경 클릭 시 닫기
        if (closeOnBackdrop) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    if (onClose) onClose();
                    this.hideModal(overlay);
                    if (onCancel) onCancel();
                }
            });
        }
        
        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape' && document.body.contains(overlay)) {
                if (onClose) onClose();
                this.hideModal(overlay);
                if (onCancel) onCancel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        return overlay;
    }

    /**
     * 모달 표시
     * @param {HTMLElement} modal - 모달 오버레이 요소
     */
    static showModal(modal) {
        if (!modal) return;
        
        requestAnimationFrame(() => {
            modal.classList.add('modal-card-show');
            document.body.style.overflow = 'hidden';
        });
    }

    /**
     * 모달 숨기기
     * @param {HTMLElement} modal - 모달 오버레이 요소
     */
    static hideModal(modal) {
        if (!modal) return;
        
        modal.classList.remove('modal-card-show');
        modal.classList.add('modal-card-hide');
        
        setTimeout(() => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            document.body.style.overflow = '';
        }, 300);
    }
}

// 전역으로 사용할 수 있도록 설정
window.ModalUtils = ModalUtils;

// alert와 confirm을 오버라이드 (선택사항)
if (typeof window.originalAlert === 'undefined') {
    window.originalAlert = window.alert;
    window.originalConfirm = window.confirm;
    
    // 필요시 기본 alert/confirm을 커스텀 모달로 교체
    // window.alert = (message) => ModalUtils.alert(message);
    // window.confirm = (message) => ModalUtils.confirm(message);
}



