// AX2 실시간 번역·자막 생성 인터페이스 JavaScript

// 프로덕션 환경에서 console.log 비활성화
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const logger = {
    log: isDev ? console.log.bind(console) : () => {},
    error: console.error.bind(console), // 에러는 항상 표시
    warn: isDev ? console.warn.bind(console) : () => {}
};

// 안전한 JSON 파싱 (전역 유틸리티)
function safeJSONParse(jsonString, defaultValue = null) {
    try {
        if (!jsonString || typeof jsonString !== 'string') {
            return defaultValue;
        }
        return JSON.parse(jsonString);
    } catch (error) {
        logger.error('JSON 파싱 오류:', error);
        return defaultValue;
    }
}

// ============================================
// 크레딧 관리 시스템
// ============================================
const CreditSystem = {
    // 크레딧 단위: 기본 자막 생성 1분당 10크레딧, 번역 언어 추가 1분당 5크레딧 (언어당)
    CREDIT_PER_MINUTE: 10, // 기본 자막 생성: 1분당 10 크레딧
    TRANSLATION_CREDIT_PER_MINUTE: 5, // 번역 언어 추가: 1분당 5 크레딧 (언어당)
    
    /**
     * 영상 길이와 번역 언어 수를 기반으로 필요한 크레딧 계산
     * @param {number} durationSeconds - 영상 길이 (초)
     * @param {number} translationLanguageCount - 번역 언어 수
     * @returns {number} 필요한 크레딧
     */
    calculateRequiredCredits(durationSeconds, translationLanguageCount = 0) {
        // 영상 길이를 분 단위로 올림 처리 (예: 61초 → 2분)
        const durationMinutes = Math.ceil(durationSeconds / 60);
        
        // 기본 자막 생성: 1분당 10크레딧
        const baseCredits = durationMinutes * this.CREDIT_PER_MINUTE;
        
        // 번역 언어 추가: 1분당 5 크레딧 (언어당)
        const translationCredits = durationMinutes * this.TRANSLATION_CREDIT_PER_MINUTE * translationLanguageCount;
        
        return baseCredits + translationCredits;
    },
    
    /**
     * 크레딧 잔액 조회
     * 로그인 상태에 따라 다른 크레딧을 반환
     * @returns {number} 현재 크레딧 잔액
     */
    getBalance() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            // 로그인 상태: 로그인 후 크레딧 사용
            return parseInt(localStorage.getItem('creditBalance') || '0');
        } else {
            // 비로그인 상태: 무료 크레딧 사용
            // 신규 사용자에게 무료 100 크레딧 제공
            this.giveFreeCreditsToGuest();
            return parseInt(localStorage.getItem('freeCreditBalance') || '0');
        }
    },
    
    /**
     * 비로그인 사용자에게 무료 크레딧 제공 (한번만)
     */
    giveFreeCreditsToGuest() {
        const freeCreditGiven = localStorage.getItem('freeCreditGiven');
        if (freeCreditGiven === 'true') {
            return; // 이미 제공됨
        }
        
        // 무료 100 크레딧 제공
        const currentBalance = parseInt(localStorage.getItem('freeCreditBalance') || '0');
        const newBalance = currentBalance + 100;
        localStorage.setItem('freeCreditBalance', newBalance.toString());
        localStorage.setItem('freeCreditGiven', 'true');
        
        // 크레딧 정보 업데이트
        if (typeof window.updateFreeCreditInfo === 'function') {
            window.updateFreeCreditInfo();
        }
    },
    
    /**
     * 크레딧 예약 (선차감)
     * @param {string} jobId - 작업 ID
     * @param {number} amount - 예약할 크레딧
     * @returns {Object} 예약 결과 {success: boolean, reservedId: string, balance: number}
     */
    reserveCredits(jobId, amount) {
        const currentBalance = this.getBalance();
        
        if (currentBalance < amount) {
            return {
                success: false,
                error: 'INSUFFICIENT_CREDITS',
                required: amount,
                balance: currentBalance
            };
        }
        
        // 예약 ID 생성
        const reservedId = `reserve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 잔액 차감 (로그인 상태에 따라 다른 크레딧 차감)
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const newBalance = currentBalance - amount;
        if (isLoggedIn) {
            localStorage.setItem('creditBalance', newBalance.toString());
        } else {
            localStorage.setItem('freeCreditBalance', newBalance.toString());
        }
        
        // 무료 크레딧 정보 업데이트
        if (typeof updateFreeCreditInfo === 'function') {
            updateFreeCreditInfo();
        }
        
        // 예약 내역 저장
        const reservations = safeJSONParse(localStorage.getItem('creditReservations'), []);
        reservations.push({
            id: reservedId,
            jobId: jobId,
            amount: amount,
            reservedAt: new Date().toISOString(),
            status: 'reserved'
        });
        localStorage.setItem('creditReservations', JSON.stringify(reservations));
        
        logger.log(`크레딧 예약: ${amount} 크레딧 (작업 ID: ${jobId}, 예약 ID: ${reservedId})`);
        
        return {
            success: true,
            reservedId: reservedId,
            balance: newBalance
        };
    },
    
    /**
     * 예약된 크레딧 확정 차감
     * @param {string} reservedId - 예약 ID
     * @param {string} jobId - 작업 ID
     * @param {string} description - 설명
     */
    confirmDeduction(reservedId, jobId, description) {
        const reservations = safeJSONParse(localStorage.getItem('creditReservations'), []);
        const reservation = reservations.find(r => r.id === reservedId && r.jobId === jobId);
        
        if (!reservation) {
            logger.error('예약을 찾을 수 없습니다:', reservedId);
            return false;
        }
        
        // 예약 상태를 확정으로 변경
        reservation.status = 'confirmed';
        reservation.confirmedAt = new Date().toISOString();
        localStorage.setItem('creditReservations', JSON.stringify(reservations));
        
        // 크레딧 사용 내역 저장
        const creditHistory = safeJSONParse(localStorage.getItem('creditHistory'), []);
        const currentBalance = this.getBalance();
        creditHistory.unshift({
            date: new Date().toISOString(),
            type: '사용',
            description: description,
            amount: reservation.amount,
            balance: currentBalance,
            jobId: jobId,
            reservedId: reservedId
        });
        localStorage.setItem('creditHistory', JSON.stringify(creditHistory));
        
        logger.log(`크레딧 확정 차감: ${reservation.amount} 크레딧 (작업 ID: ${jobId})`);
        return true;
    },
    
    /**
     * 예약된 크레딧 환불
     * @param {string} reservedId - 예약 ID
     * @param {string} jobId - 작업 ID
     * @param {string} reason - 환불 사유
     * @param {number} partialAmount - 부분 환불 금액 (전액 환불 시 null)
     */
    refundCredits(reservedId, jobId, reason, partialAmount = null) {
        const reservations = safeJSONParse(localStorage.getItem('creditReservations'), []);
        const reservation = reservations.find(r => r.id === reservedId && r.jobId === jobId);
        
        if (!reservation) {
            logger.error('예약을 찾을 수 없습니다:', reservedId);
            return false;
        }
        
        // 환불할 크레딧 계산
        const refundAmount = partialAmount !== null ? partialAmount : reservation.amount;
        
        // 잔액 복구 (로그인 상태에 따라 다른 크레딧 복구)
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const currentBalance = this.getBalance();
        const newBalance = currentBalance + refundAmount;
        if (isLoggedIn) {
            localStorage.setItem('creditBalance', newBalance.toString());
        } else {
            localStorage.setItem('freeCreditBalance', newBalance.toString());
        }
        
        // 무료 크레딧 정보 업데이트
        if (typeof updateFreeCreditInfo === 'function') {
            updateFreeCreditInfo();
        }
        
        // 예약 상태를 환불로 변경
        reservation.status = 'refunded';
        reservation.refundedAt = new Date().toISOString();
        reservation.refundReason = reason;
        reservation.refundAmount = refundAmount;
        localStorage.setItem('creditReservations', JSON.stringify(reservations));
        
        // 환불 내역 저장
        const creditHistory = safeJSONParse(localStorage.getItem('creditHistory'), []);
        creditHistory.unshift({
            date: new Date().toISOString(),
            type: '환불',
            description: reason,
            amount: refundAmount,
            balance: newBalance,
            jobId: jobId,
            reservedId: reservedId
        });
        localStorage.setItem('creditHistory', JSON.stringify(creditHistory));
        
        logger.log(`크레딧 환불: ${refundAmount} 크레딧 (작업 ID: ${jobId}, 사유: ${reason})`);
        return true;
    }
};

// ============================================
// 무료 크레딧 관리 시스템 (계정 당 1회 제공)
// ============================================
const FreeTrialSystem = {
    FREE_TRIAL_CREDITS: 100,
    FREE_TRIAL_MAX_DURATION: 600, // 10분 (초)
    FREE_TRIAL_MAX_LANGUAGES: 1,
    FREE_TRIAL_STORAGE_HOURS: 3,
    
    /**
     * 무료 크레딧 사용 여부 확인
     * @returns {boolean} 무료 크레딧 사용 여부
     */
    isUsed() {
        return localStorage.getItem('freeTrialUsed') === 'true';
    },
    
    /**
     * 무료 크레딧 사용 표시 (계정 당 1회)
     */
    markAsUsed() {
        localStorage.setItem('freeTrialUsed', 'true');
        localStorage.setItem('freeTrialUsedAt', new Date().toISOString());
    },
    
    /**
     * 무료 크레딧 자격 확인
     * @param {number} durationSeconds - 영상 길이 (초)
     * @param {number} languageCount - 번역 언어 수
     * @returns {Object} {eligible: boolean, reason: string}
     */
    checkEligibility(durationSeconds, languageCount) {
        if (this.isUsed()) {
            return {
                eligible: false,
                reason: '이미 무료 크레딧을 사용하셨습니다. 계정 당 1회만 제공됩니다.'
            };
        }
        
        if (durationSeconds > this.FREE_TRIAL_MAX_DURATION) {
            return {
                eligible: false,
                reason: `무료 크레딧은 최대 ${this.FREE_TRIAL_MAX_DURATION / 60}분까지 가능합니다.`
            };
        }
        
        if (languageCount > this.FREE_TRIAL_MAX_LANGUAGES) {
            return {
                eligible: false,
                reason: `무료 크레딧은 최대 ${this.FREE_TRIAL_MAX_LANGUAGES}개 언어까지 가능합니다.`
            };
        }
        
        return { eligible: true };
    },
    
    /**
     * 무료 크레딧 지급 (계정 당 1회)
     * 무료 크레딧은 freeCreditBalance에 별도로 저장
     */
    grantFreeCredits() {
        const currentBalance = parseInt(localStorage.getItem('freeCreditBalance') || '0');
        const newBalance = currentBalance + this.FREE_TRIAL_CREDITS;
        localStorage.setItem('freeCreditBalance', newBalance.toString());
        
        // 크레딧 내역 저장
        const creditHistory = safeJSONParse(localStorage.getItem('creditHistory'), []);
        creditHistory.unshift({
            date: new Date().toISOString(),
            type: 'charge',
            description: '계정 당 1회 무료 크레딧',
            amount: this.FREE_TRIAL_CREDITS,
            balance: newBalance
        });
        localStorage.setItem('creditHistory', JSON.stringify(creditHistory));
        
        this.markAsUsed();
        logger.log(`무료 크레딧 지급: ${this.FREE_TRIAL_CREDITS} 크레딧`);
        
        // 무료 크레딧 정보 업데이트
        if (typeof updateFreeCreditInfo === 'function') {
            updateFreeCreditInfo();
        }
    }
};

// ============================================
// 작업 상태 관리 시스템
// ============================================
const JobStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

const JobManager = {
    /**
     * 작업 생성
     * @param {string} videoId - 비디오 ID
     * @param {Object} jobData - 작업 데이터
     * @returns {string} 작업 ID
     */
    createJob(videoId, jobData) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job = {
            id: jobId,
            videoId: videoId,
            status: JobStatus.PENDING,
            createdAt: new Date().toISOString(),
            ...jobData
        };
        
        const jobs = safeJSONParse(localStorage.getItem('jobs'), []);
        jobs.push(job);
        localStorage.setItem('jobs', JSON.stringify(jobs));
        
        logger.log('작업 생성:', jobId);
        return jobId;
    },
    
    /**
     * 작업 상태 업데이트
     * @param {string} jobId - 작업 ID
     * @param {string} status - 새 상태
     * @param {Object} data - 추가 데이터
     */
    updateJobStatus(jobId, status, data = {}) {
        const jobs = safeJSONParse(localStorage.getItem('jobs'), []);
        const job = jobs.find(j => j.id === jobId);
        
        if (!job) {
            logger.error('작업을 찾을 수 없습니다:', jobId);
            return false;
        }
        
        job.status = status;
        job.updatedAt = new Date().toISOString();
        Object.assign(job, data);
        
        localStorage.setItem('jobs', JSON.stringify(jobs));
        logger.log(`작업 상태 업데이트: ${jobId} → ${status}`);
        return true;
    },
    
    /**
     * 작업 조회
     * @param {string} jobId - 작업 ID
     * @returns {Object|null} 작업 데이터
     */
    getJob(jobId) {
        const jobs = safeJSONParse(localStorage.getItem('jobs'), []);
        return jobs.find(j => j.id === jobId) || null;
    }
};

// ============================================
// 보관 기간 관리 시스템
// ============================================
const StorageManager = {
    /**
     * 크레딧 충전 여부 확인
     * @returns {boolean} 크레딧 충전 여부
     */
    hasChargedCredits() {
        const totalCharged = parseInt(localStorage.getItem('totalCharged') || '0');
        return totalCharged > 0;
    },
    
    /**
     * 보관 용량 조회
     * @returns {number} 보관 용량 (GB)
     */
    getStorageCapacity() {
        const baseCapacity = this.hasChargedCredits() ? 5 : 1; // 충전 사용자: 5GB, 무료: 1GB
        
        // 확장 옵션 확인 (만료 확인 포함)
        const storageExtension = safeJSONParse(localStorage.getItem('storageExtension'), null);
        if (storageExtension && storageExtension.expiresAt) {
            const expiryDate = new Date(storageExtension.expiresAt);
            const now = new Date();
            if (expiryDate > now) {
                // 활성 확장 옵션
                if (storageExtension.type === 'plus') {
                    return baseCapacity + 5; // +5GB
                } else if (storageExtension.type === 'pro') {
                    return baseCapacity + 20; // +20GB
                }
            } else {
                // 만료된 확장 옵션 제거
                localStorage.removeItem('storageExtension');
            }
        }
        
        return baseCapacity;
    },
    
    /**
     * 보관 기간 조회 (일 단위)
     * @returns {number} 보관 기간 (일)
     */
    getStoragePeriod() {
        // 확장 옵션 확인 (만료 확인 포함)
        const storageExtension = safeJSONParse(localStorage.getItem('storageExtension'), null);
        if (storageExtension && storageExtension.expiresAt) {
            const expiryDate = new Date(storageExtension.expiresAt);
            const now = new Date();
            if (expiryDate > now) {
                // 활성 확장 옵션
                if (storageExtension.type === 'plus') {
                    return 30; // Storage Plus: 30일
                } else if (storageExtension.type === 'pro') {
                    return 90; // Storage Pro: 90일
                }
            } else {
                // 만료된 확장 옵션 제거
                localStorage.removeItem('storageExtension');
            }
        }
        
        // 기본 보관 기간: 모든 영상 7일
        return 7;
    },
    
    /**
     * 보관 만료 시간 계산
     * @param {boolean} isFreeTrial - 무료 크레딧 여부
     * @returns {Date} 만료 시간
     */
    calculateExpiryDate(isFreeTrial = false) {
        const now = new Date();
        
        // 모든 영상 7일 보관 (확장 옵션 제외)
        const storagePeriod = this.getStoragePeriod();
        now.setDate(now.getDate() + storagePeriod);
        
        return now.toISOString();
    },
    
    /**
     * 만료된 영상 자동 삭제
     */
    cleanupExpiredVideos() {
        const savedVideos = safeJSONParse(localStorage.getItem('savedVideos'), []);
        const now = new Date();
        let deletedCount = 0;
        
        const activeVideos = savedVideos.filter(video => {
            if (!video.expiresAt) {
                return true; // 만료 시간이 없으면 유지
            }
            
            const expiryDate = new Date(video.expiresAt);
            if (expiryDate <= now) {
                deletedCount++;
                logger.log(`만료된 영상 삭제: ${video.id} (${video.title})`);
                return false;
            }
            return true;
        });
        
        if (deletedCount > 0) {
            localStorage.setItem('savedVideos', JSON.stringify(activeVideos));
            logger.log(`만료된 영상 ${deletedCount}개 삭제 완료`);
        }
        
        return deletedCount;
    }
};

// 보관 기간 관리 초기화 (페이지 로드 시 실행)
if (typeof window !== 'undefined') {
    // 만료된 영상 정리 (페이지 로드 시)
    StorageManager.cleanupExpiredVideos();
    
    // 주기적으로 만료된 영상 정리 (1시간마다)
    setInterval(() => {
        StorageManager.cleanupExpiredVideos();
    }, 60 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    // 드롭다운 스크롤 문제 해결 (드롭다운 크기 고정 및 모달 스크롤 차단)
    const originalLangSelect = document.getElementById('originalLang');
    const translationLangSelect = document.getElementById('translationLang');
    const modalContentWrapper = document.querySelector('.modal-content-wrapper');
    
    let isSelectActive = false;
    let modalScrollPosition = 0;
    
    // select가 포커스를 받을 때 (드롭다운이 열릴 때)
    const handleSelectFocus = (e) => {
        if (e.target === originalLangSelect || e.target === translationLangSelect) {
            isSelectActive = true;
            // 현재 모달 스크롤 위치 저장
            if (modalContentWrapper) {
                modalScrollPosition = modalContentWrapper.scrollTop;
                // 모달 스크롤을 막기 위해 overflow를 임시로 조정
                modalContentWrapper.style.overflow = 'hidden';
                // 모달 위치 고정 (드롭다운이 위로 커지지 않도록)
                modalContentWrapper.style.position = 'fixed';
                const rect = modalContentWrapper.getBoundingClientRect();
                modalContentWrapper.style.top = rect.top + 'px';
                modalContentWrapper.style.left = rect.left + 'px';
                modalContentWrapper.style.width = rect.width + 'px';
            }
        }
    };
    
    // select가 포커스를 잃을 때 (드롭다운이 닫힐 때)
    const handleSelectBlur = (e) => {
        if (e.target === originalLangSelect || e.target === translationLangSelect) {
            // 약간의 지연을 두어 드롭다운이 완전히 닫힐 때까지 대기
            setTimeout(() => {
                isSelectActive = false;
                if (modalContentWrapper) {
                    // 원래 상태로 복원
                    modalContentWrapper.style.overflow = '';
                    modalContentWrapper.style.position = '';
                    modalContentWrapper.style.top = '';
                    modalContentWrapper.style.left = '';
                    modalContentWrapper.style.width = '';
                    // 스크롤 위치 복원
                    modalContentWrapper.scrollTop = modalScrollPosition;
                }
            }, 300);
        }
    };
    
    // 모달의 wheel 이벤트를 캡처하여 select가 포커스되어 있을 때 완전 차단
    if (modalContentWrapper) {
        modalContentWrapper.addEventListener('wheel', (e) => {
            if (isSelectActive) {
                // select가 포커스되어 있으면 모달 스크롤 완전 차단
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, { passive: false, capture: true });
    }
    
    // select 요소에 포커스/블러 이벤트 추가
    if (originalLangSelect) {
        originalLangSelect.addEventListener('focus', handleSelectFocus);
        originalLangSelect.addEventListener('blur', handleSelectBlur);
    }
    
    if (translationLangSelect) {
        translationLangSelect.addEventListener('focus', handleSelectFocus);
        translationLangSelect.addEventListener('blur', handleSelectBlur);
    }
    
    // 모바일 메뉴 토글
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (mobileMenuBtn && sidebar && sidebarOverlay) {
        // 모바일에서만 버튼 표시
        if (window.innerWidth <= 768) {
            mobileMenuBtn.style.display = 'block';
        }
        
        // 윈도우 리사이즈 이벤트 (throttle 적용)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth <= 768) {
                    mobileMenuBtn.style.display = 'block';
                } else {
                    mobileMenuBtn.style.display = 'none';
                    sidebar.classList.remove('mobile-open');
                    sidebarOverlay.classList.remove('active');
                }
            }, 150);
        });
        
        // 메뉴 버튼 클릭
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('active');
        });
        
        // 오버레이 클릭 시 메뉴 닫기
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
        
        // 사이드바 링크 클릭 시 메뉴 닫기 (모바일)
        const sidebarLinks = sidebar.querySelectorAll('.sidebar-item');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('mobile-open');
                    sidebarOverlay.classList.remove('active');
                }
            });
        });
    }
    
    // 드래그 앤 드롭
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const translationModal = document.getElementById('translationModal');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const closeTranslationModal = document.getElementById('closeTranslationModal');
    
    // 선택된 파일 저장
    let selectedFile = null;
    let currentVideoDuration = 0; // 현재 선택된 영상의 길이 (초)
    
    // 클릭으로 업로드 (드롭존 영역 클릭 시)
    dropZone.addEventListener('click', (e) => {
        fileInput.click();
    });
    
    // 드래그 오버
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    // 드롭
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    // 파일 선택
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    
    // 로그인 상태 확인 함수
    function checkLoginStatus() {
        try {
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            const currentUser = localStorage.getItem('currentUser');
            return isLoggedIn && currentUser;
        } catch (error) {
            logger.error('로그인 상태 확인 오류:', error);
            return false;
        }
    }
    
    // 로그인 페이지로 리디렉션
    function redirectToLogin() {
        // 현재 페이지 URL을 저장하여 로그인 후 돌아올 수 있도록
        const currentUrl = window.location.href;
        sessionStorage.setItem('redirectAfterLogin', currentUrl);
        window.location.href = 'html/login.html';
    }
    
    async function handleFile(file) {
        if (file.type.startsWith('video/')) {
            selectedFile = file;
            
            // 서버에 업로드
            let serverJobId = null;
            try {
                if (typeof uploadVideoToServer === 'function') {
                    const uploadResult = await uploadVideoToServer(file);
                    if (uploadResult.success) {
                        serverJobId = uploadResult.data.jobId;
                        file.serverJobId = serverJobId;
                        logger.log('서버 업로드 성공:', serverJobId);
                        
                        // Job 상태 확인 및 자막 데이터 로드 (비동기)
                        checkJobAndLoadSubtitles(serverJobId, file);
                    }
                }
            } catch (error) {
                logger.error('서버 업로드 오류:', error);
            }
            
            // 파일 업로드 시 즉시 저장 (작업 이력에 표시되도록)
            await saveUploadedVideo(file);
            
            // 저장 완료 플래그 설정 (작업 이력 페이지에서 새로고침하도록)
            localStorage.setItem('videoSaved', 'true');
            localStorage.setItem('lastSavedVideoId', selectedFile.uploadVideoId);
            
            // 번역 설정 모달 팝업 표시
            showTranslationModal();
        } else {
            ModalUtils.alert('영상 파일을 먼저 업로드해주세요.', '영상 파일 필요', { type: 'warning' });
        }
    }
    
    // 업로드된 비디오 즉시 저장 함수
    async function saveUploadedVideo(file) {
        try {
            // 비디오 메타데이터 추출
            const videoUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = videoUrl;
            
            // 비디오 메타데이터 로드 대기
            await new Promise((resolve, reject) => {
                video.addEventListener('loadedmetadata', () => {
                    resolve();
                }, { once: true });
                video.addEventListener('error', reject, { once: true });
            });
            
            const duration = video.duration || 0;
            const fileSizeGB = file.size / (1024 * 1024 * 1024);
            
            // localStorage에서 기존 영상 확인
            const savedVideos = safeJSONParse(localStorage.getItem('savedVideos'), []);
            const existingIndex = savedVideos.findIndex(v => 
                v.fileName === file.name && v.fileSize === file.size
            );
            
            let videoId;
            if (existingIndex !== -1) {
                // 기존 영상이 있으면 기존 ID 사용
                videoId = savedVideos[existingIndex].id;
                logger.log('기존 영상 ID 사용:', videoId);
            } else {
                // 새 비디오 ID 생성
                videoId = 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            
            // 파일 객체에 videoId 저장 (번역 완료 후 사용)
            file.uploadVideoId = videoId;
            
            // 비디오 데이터 생성 (번역 전 상태)
            const videoData = {
                id: videoId,
                title: file.name.replace(/\.[^/.]+$/, '') || '새 강의',
                description: '업로드된 영상',
                videoUrl: videoUrl,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                duration: duration,
                size: fileSizeGB,
                createdAt: new Date().toISOString(),
                savedAt: new Date().toISOString(),
                translated: false,
                category: '',
                tags: []
            };
            
            // localStorage에 저장
            if (existingIndex !== -1) {
                // 기존 영상 업데이트
                savedVideos[existingIndex] = { ...savedVideos[existingIndex], ...videoData };
                logger.log('기존 영상 업데이트:', videoId);
            } else {
                // 새 영상 추가
                savedVideos.push(videoData);
                logger.log('새 영상 추가:', videoId);
            }
            
            localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
            
            // IndexedDB에 저장 (백그라운드)
            saveFileToIndexedDB(videoId, file)
                .then(() => {
                    logger.log('IndexedDB 저장 완료:', videoId);
                })
                .catch((error) => {
                    logger.error('IndexedDB 저장 오류:', error);
                });
            
            // 저장 완료 플래그 설정 (작업 이력 페이지에서 새로고침하도록)
            localStorage.setItem('videoSaved', 'true');
            localStorage.setItem('lastSavedVideoId', videoId);
            localStorage.setItem('lastSavedVideoTitle', videoData.title);
            localStorage.setItem('lastSavedVideoTime', new Date().toISOString());
            
            logger.log('업로드된 영상 저장 완료 (작업 이력에 추가됨):', videoId);
            
        } catch (error) {
            logger.error('영상 저장 오류:', error);
        }
    }
    
    // Job 상태 확인 및 자막 데이터 로드
    async function checkJobAndLoadSubtitles(jobId, file) {
        try {
            if (typeof getJobStatus !== 'function') return;
            
            const checkInterval = setInterval(async () => {
                const statusResult = await getJobStatus(jobId);
                if (statusResult.success && statusResult.data) {
                    const job = statusResult.data;
                    logger.log('Job 상태:', job.status, job.progress);
                    
                    if (job.status === 'completed') {
                        clearInterval(checkInterval);
                        
                        if (typeof getJobSubtitles === 'function') {
                            const videoId = file.uploadVideoId;
                            if (!videoId) return;
                            
                            const savedVideos = safeJSONParse(localStorage.getItem('savedVideos'), []);
                            const video = savedVideos.find(v => v.id === videoId);
                            if (!video) return;
                            
                            const originalLang = video.originalLang || 'ko';
                            const targetLangs = (video.targetLanguages || []).map(t => t.code || t);
                            const duration = video.duration || 60;
                            
                            const subtitlesResult = await getJobSubtitles(jobId, originalLang, targetLangs, duration);
                            if (subtitlesResult.success && subtitlesResult.data) {
                                video.transcriptions = subtitlesResult.data.subtitles;
                                video.jobId = jobId;
                                video.translated = true;
                                
                                localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
                                logger.log('자막 데이터 로드 완료:', videoId);
                            }
                        }
                    }
                }
            }, 2000);
            
            setTimeout(() => clearInterval(checkInterval), 60000);
        } catch (error) {
            logger.error('Job 상태 확인 오류:', error);
        }
    }
    
    // 번역 설정 모달 표시 함수
    function showTranslationModal() {
        if (translationModal) {
            // 이전 비디오 미리보기 정리
            clearVideoPreview();
            
            // 비디오 미리보기 설정
            if (selectedFile) {
                setupVideoPreview(selectedFile);
            }
            
            translationModal.style.display = 'flex';
            
            // 크레딧 정보 초기화 (비디오 로드 후 자동 업데이트됨)
            const creditInfoEl = document.getElementById('creditInfo');
            if (creditInfoEl) {
                creditInfoEl.style.display = 'none';
            }
            
            // 기본 언어 추가 (영어, 일본어, 중국어 간체)
            setTimeout(() => {
                // addLanguageBtn과 modalLanguageItems가 정의되어 있는지 확인
                const addLanguageBtn = document.querySelector('.add-language-btn');
                const modalLanguageItems = document.querySelectorAll('.modal-language-item');
                
                if (addLanguageBtn && modalLanguageItems.length > 0) {
                    // 기존 번역 언어 칩 제거 (원본 언어 제외)
                    const existingTranslationChips = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'));
                    existingTranslationChips.forEach(chip => chip.remove());
                    
                    // 기본 언어 추가
                    if (typeof addLanguageChip === 'function') {
                        addLanguageChip('en', false); // 영어
                        addLanguageChip('ja', false); // 일본어
                        addLanguageChip('zh', false); // 중국어 간체
                    } else {
                        // addLanguageChip 함수가 아직 정의되지 않은 경우 직접 추가
                        ['en', 'ja', 'zh'].forEach(lang => {
                            const existingChips = Array.from(document.querySelectorAll('.language-chip'));
                            const alreadyAdded = existingChips.some(chip => chip.dataset.lang === lang);
                            
                            if (!alreadyAdded) {
                                const chip = document.createElement('div');
                                chip.className = 'language-chip';
                                chip.dataset.lang = lang;
                                const displayName = getLanguageDisplayName(lang);
                                
                                const durationMinutes = currentVideoDuration ? Math.ceil(currentVideoDuration / 60) : 0;
                                const translationCredits = durationMinutes * 5;
                                
                                chip.innerHTML = `
                                    <span>${displayName}</span>
                                    <img src="assets/image/credit.png" alt="크레딧" class="credit-icon">
                                    <span class="chip-credit">${translationCredits}</span>
                                    <i class="fas fa-times"></i>
                                `;
                                
                                chip.addEventListener('click', (e) => {
                                    if (e.target.classList.contains('fa-times')) {
                                        chip.remove();
                                        updateLanguageArrow();
                                        updateCreditInfo();
                                        updateLanguageChipCredits();
                                        updateTranslateButtonVisibility();
                                    }
                                });
                                
                                addLanguageBtn.parentElement.insertBefore(chip, addLanguageBtn);
                            }
                        });
                    }
                    
                    // 모달의 선택 상태 업데이트
                    modalLanguageItems.forEach(item => {
                        const lang = item.dataset.lang;
                        if (lang === 'en' || lang === 'ja' || lang === 'zh') {
                            item.classList.add('selected');
                        } else {
                            item.classList.remove('selected');
                        }
                    });
                }
                
                // 언어 칩 크레딧 정보 업데이트
                updateLanguageChipCredits();
                updateTranslateButtonVisibility();
                updateCreditInfo(); // 크레딧 정보 및 충전하기 버튼 업데이트
            }, 100);
            
            // 보유 크레딧 업데이트
            updateUserCreditDisplay();
        }
    }
    
    // 사용자 보유 크레딧 표시 업데이트
    function updateUserCreditDisplay() {
        const creditAmountValue = document.querySelector('.credit-amount-value');
        if (creditAmountValue) {
            // CreditSystem.getBalance()를 사용하여 로그인/비로그인 상태에 따라 올바른 크레딧 가져오기
            const creditBalance = CreditSystem.getBalance();
            creditAmountValue.textContent = creditBalance.toLocaleString();
        }
    }
    
    // 비디오 미리보기 설정
    function setupVideoPreview(file) {
        const videoPreviewContainer = document.getElementById('videoPreviewContainer');
        const videoPreview = document.getElementById('videoPreview');
        const videoPreviewName = document.getElementById('videoPreviewName');
        const videoPreviewSize = document.getElementById('videoPreviewSize');
        
        if (!videoPreviewContainer || !videoPreview || !file) {
            logger.error('비디오 미리보기 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 이전 이벤트 리스너 제거
        const newVideoPreview = videoPreview.cloneNode(true);
        videoPreview.parentNode.replaceChild(newVideoPreview, videoPreview);
        
        // 비디오 URL 생성
        const videoUrl = URL.createObjectURL(file);
        newVideoPreview.src = videoUrl;
        newVideoPreview.id = 'videoPreview';
        
        // 파일 정보 표시
        if (videoPreviewName) {
            let fileName = file.name || '영상 파일';
            // 파일명이 너무 길면 자르기 (이미지처럼 긴 파일명 처리)
            if (fileName.length > 60) {
                fileName = fileName.substring(0, 57) + '...';
            }
            videoPreviewName.textContent = fileName;
        }
        
        if (videoPreviewSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            videoPreviewSize.textContent = `${fileSizeMB} MB`;
        }
        
        // 미리보기 컨테이너 표시
        videoPreviewContainer.style.display = 'block';
        
        // 비디오 정보 영역 아래에 있는 모든 상태 텍스트 즉시 숨김
        setTimeout(() => {
            const videoPreviewInfo = videoPreviewContainer.querySelector('.video-preview-info');
            if (videoPreviewInfo) {
                let nextSibling = videoPreviewInfo.nextElementSibling;
                while (nextSibling) {
                    if (nextSibling.textContent && 
                        (nextSibling.textContent.includes('자막') || 
                         nextSibling.textContent.includes('생성') || 
                         nextSibling.textContent.includes('%') ||
                         nextSibling.classList.contains('progress') ||
                         nextSibling.id && nextSibling.id.includes('progress'))) {
                        nextSibling.style.display = 'none';
                        nextSibling.style.visibility = 'hidden';
                        nextSibling.style.position = 'absolute';
                        nextSibling.style.left = '-9999px';
                        nextSibling.style.opacity = '0';
                        nextSibling.style.height = '0';
                        nextSibling.style.width = '0';
                        nextSibling.style.overflow = 'hidden';
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
            }
        }, 0);
        
        // 비디오 메타데이터 로드 후 재생 시간 표시
        newVideoPreview.addEventListener('loadedmetadata', () => {
            const duration = newVideoPreview.duration;
            if (duration && !isNaN(duration)) {
                // 영상 길이 저장
                currentVideoDuration = duration;
                // 언어 칩 크레딧 정보 업데이트
                updateLanguageChipCredits();
                
                if (videoPreviewSize) {
                    const minutes = Math.floor(duration / 60);
                    const seconds = Math.floor(duration % 60);
                    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    // 크기와 재생시간 표시 (이미지 형식: "36.88 MB • 1:09")
                    videoPreviewSize.textContent = `${fileSizeMB} MB • ${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
                
                // 크레딧 정보 업데이트
                updateCreditInfo();
            }
        });
        
        // 비디오 로드 오류 처리
        newVideoPreview.addEventListener('error', (e) => {
            logger.error('비디오 로드 오류:', e);
            if (videoPreviewSize) {
                videoPreviewSize.textContent = '로드 실패';
            }
        });
    }
    
    // 번역 설정 모달 닫기 함수
    function closeTranslationModalFunc() {
        if (translationModal) {
            // 비디오 미리보기 정리
            clearVideoPreview();
            
            // 크레딧 정보 숨기기
            const creditInfoEl = document.getElementById('creditInfo');
            if (creditInfoEl) {
                creditInfoEl.style.display = 'none';
            }
            
            // 영상 길이 초기화
            currentVideoDuration = 0;
            
            translationModal.style.opacity = '0';
            translationModal.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                translationModal.style.display = 'none';
            }, 300);
        }
    }
    
    // 비디오 미리보기 정리
    function clearVideoPreview() {
        const videoPreviewContainer = document.getElementById('videoPreviewContainer');
        const videoPreview = document.getElementById('videoPreview');
        
        if (videoPreview && videoPreview.src) {
            // Blob URL 해제
            if (videoPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoPreview.src);
            }
            videoPreview.src = '';
        }
        
        if (videoPreviewContainer) {
            videoPreviewContainer.style.display = 'none';
        }
        
        const videoPreviewName = document.getElementById('videoPreviewName');
        const videoPreviewSize = document.getElementById('videoPreviewSize');
        if (videoPreviewName) videoPreviewName.textContent = '';
        if (videoPreviewSize) videoPreviewSize.textContent = '';
    }
    
    // 모달 닫기 이벤트
    if (closeTranslationModal) {
        closeTranslationModal.addEventListener('click', closeTranslationModalFunc);
    }
    
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', closeTranslationModalFunc);
    }
    
    // 크레딧 사용 안내 버튼 클릭 이벤트
    const creditGuideToggleBtn = document.getElementById('creditGuideToggleBtn');
    const creditUsageGuidePopup = document.getElementById('creditUsageGuidePopup');
    
    if (creditGuideToggleBtn && creditUsageGuidePopup) {
        creditGuideToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 버블링 방지
            const isVisible = creditUsageGuidePopup.style.display === 'block';
            creditUsageGuidePopup.style.display = isVisible ? 'none' : 'block';
        });
        
        // 팝업 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (creditUsageGuidePopup && 
                !creditGuideToggleBtn.contains(e.target) && 
                !creditUsageGuidePopup.contains(e.target)) {
                creditUsageGuidePopup.style.display = 'none';
            }
        });
    }
    
    // 크레딧 충전 모달 관련
    const creditChargeModal = document.getElementById('creditChargeModal');
    const creditChargeModalBackdrop = document.getElementById('creditChargeModalBackdrop');
    const closeCreditChargeModal = document.getElementById('closeCreditChargeModal');
    const creditChargePackages = document.getElementById('creditChargePackages');
    
    // 크레딧 패키지 데이터
    const creditPackages = [
        { id: 1, credit: 500, price: 5000, originalPrice: 5000, discount: 0, description: '약 50분 분량 처리 가능 (기본 자막 생성 기준)' },
        { id: 2, credit: 1000, price: 8000, originalPrice: 10000, discount: 20, description: '약 100분 분량 처리 가능 (기본 자막 생성 기준)' },
        { id: 3, credit: 5000, price: 35000, originalPrice: 50000, discount: 30, description: '약 500분 분량 처리 가능 (기본 자막 생성 기준)', popular: true }
    ];
    
    // 크레딧 충전 모달 열기
    async function openCreditChargeModal() {
        // 로그인 상태 확인
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        if (!isLoggedIn) {
            // 비로그인 상태: 로그인 유도
            const goToLogin = await ModalUtils.confirm(
                '크레딧을 충전하려면 로그인이 필요합니다.\n\n로그인 페이지로 이동하시겠습니까?',
                '로그인 필요',
                { confirmText: '로그인하기', cancelText: '취소', confirmType: 'primary' }
            );
            if (goToLogin) {
                const isInHtmlFolder = window.location.pathname.includes('/html/');
                const loginPath = isInHtmlFolder ? 'login.html' : 'html/login.html';
                window.location.href = loginPath;
            }
            return;
        }
        
        console.log('openCreditChargeModal 호출됨'); // 디버깅
        if (!creditChargeModal) {
            console.error('creditChargeModal을 찾을 수 없습니다.');
            return;
        }
        if (!creditChargePackages) {
            console.error('creditChargePackages를 찾을 수 없습니다.');
            return;
        }
        
        // 패키지 카드 렌더링
        creditChargePackages.innerHTML = '';
        creditPackages.forEach((pkg, index) => {
            const card = document.createElement('div');
            card.className = 'credit-charge-package-card';
            if (pkg.popular) {
                card.classList.add('popular');
            }
            
            // 분량 숫자만 강조
            const descriptionHtml = pkg.description ? 
                pkg.description.replace(/(\d+)분/, '<span class="credit-duration-number">$1</span>분') : '';
            
            // 배지 표시 (할인 배지: 왼쪽, 인기 배지: 오른쪽)
            let badges = '';
            if (pkg.discount > 0) {
                badges += `<div class="credit-package-badge discount">${pkg.discount}% 할인</div>`;
            }
            if (pkg.popular) {
                badges += `<div class="credit-package-badge popular-badge">인기</div>`;
            }
            
            // 가격 HTML (할인 정보 명확하게 표시)
            let priceHtml = '';
            if (pkg.discount > 0 && pkg.originalPrice > pkg.price) {
                priceHtml = `
                    <div class="credit-package-price">
                        <div class="credit-package-price-row">
                            <span class="credit-package-original-price">${pkg.originalPrice.toLocaleString()}<span class="credit-price-unit">원</span></span>
                            <span class="credit-package-discounted-price">${pkg.price.toLocaleString()}<span class="credit-price-unit">원</span></span>
                        </div>
                    </div>
                `;
            } else {
                priceHtml = `
                    <div class="credit-package-price">
                        <div class="credit-package-price-row">
                            <span class="credit-package-discounted-price">${pkg.price.toLocaleString()}<span class="credit-price-unit">원</span></span>
                        </div>
                    </div>
                `;
            }
            
            card.innerHTML = `
                ${badges}
                <div class="credit-package-description">${descriptionHtml}</div>
                <div class="credit-package-amount">${pkg.credit.toLocaleString()} 크레딧</div>
                ${priceHtml}
                <button class="credit-package-charge-btn" data-package-id="${pkg.id}">
                    충전하기
                </button>
            `;
            
            creditChargePackages.appendChild(card);
        });
        
        creditChargeModal.style.display = 'flex';
        console.log('모달 표시됨'); // 디버깅
    }
    
    // 크레딧 충전 모달 닫기
    function closeCreditChargeModalFunc() {
        if (creditChargeModal) {
            creditChargeModal.style.display = 'none';
            // 크레딧 충전 모달이 닫힐 때 backdrop도 완전히 제거하고 pointer-events 차단
            const creditChargeModalBackdrop = document.getElementById('creditChargeModalBackdrop');
            if (creditChargeModalBackdrop) {
                creditChargeModalBackdrop.style.display = 'none';
                creditChargeModalBackdrop.style.pointerEvents = 'none';
            }
            // 모달 자체도 pointer-events 차단
            creditChargeModal.style.pointerEvents = 'none';
        }
    }
    
    // 충전하기 버튼 클릭 이벤트
    const chargeCreditBtn = document.getElementById('chargeCreditBtn');
    if (chargeCreditBtn) {
        chargeCreditBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('충전하기 버튼 클릭됨'); // 디버깅
            await openCreditChargeModal();
        });
    } else {
        console.warn('chargeCreditBtn을 찾을 수 없습니다.'); // 디버깅
    }
    
    // 모달 닫기 이벤트
    if (closeCreditChargeModal) {
        closeCreditChargeModal.addEventListener('click', closeCreditChargeModalFunc);
    }
    
    if (creditChargeModalBackdrop) {
        creditChargeModalBackdrop.addEventListener('click', closeCreditChargeModalFunc);
    }
    
    // 선택된 패키지 전역 변수
    let selectedPaymentPackage = null;

    // 패키지 선택 및 결제 모달 열기
    function selectPaymentPackage(packageId) {
        // 로그인 상태 확인
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        if (!isLoggedIn) {
            // 비로그인 상태: 로그인 유도
            if (confirm('크레딧을 충전하려면 로그인이 필요합니다.\n로그인 페이지로 이동하시겠습니까?')) {
                const isInHtmlFolder = window.location.pathname.includes('/html/');
                const loginPath = isInHtmlFolder ? 'login.html' : 'html/login.html';
                window.location.href = loginPath;
            }
            return;
        }
        
        selectedPaymentPackage = creditPackages.find(pkg => pkg.id === packageId);
        if (!selectedPaymentPackage) return;

        // 크레딧 충전 모달 완전히 닫기
        closeCreditChargeModalFunc();
        // 약간의 지연을 두어 모달이 완전히 닫힌 후 결제 모달 열기
        setTimeout(() => {
            // 주문 요약 업데이트
            const summaryPackageName = document.getElementById('summary-package-name');
            const summaryPackagePrice = document.getElementById('summary-package-price');
            if (summaryPackageName) {
                summaryPackageName.textContent = `${(selectedPaymentPackage.credit + (selectedPaymentPackage.bonus || 0)).toLocaleString()} 크레딧`;
            }
            if (summaryPackagePrice) {
                summaryPackagePrice.textContent = `${selectedPaymentPackage.price.toLocaleString()}원`;
            }

            // 결제 방법 선택 초기화
            const paymentMethods = document.querySelectorAll('.payment-method-btn');
            paymentMethods.forEach(btn => btn.classList.remove('active'));

            // 약관 동의 체크박스 초기화
            const termsCheckbox = document.getElementById('terms-agree');
            if (termsCheckbox) {
                termsCheckbox.checked = false;
            }

            // 결제 버튼 상태 확인
            checkPaymentButtonState();

            // 결제 모달 열기
            const paymentModalOverlay = document.getElementById('payment-modal-overlay');
            if (paymentModalOverlay) {
                paymentModalOverlay.classList.add('active');
                paymentModalOverlay.style.zIndex = '30000'; // 크레딧 충전 모달보다 높게 설정
                paymentModalOverlay.style.pointerEvents = 'auto'; // 클릭 가능하도록 설정
                document.body.style.overflow = 'hidden';
                
                // 결제 모달 내부 요소들이 클릭 가능하도록 보장
                const paymentModal = paymentModalOverlay.querySelector('.payment-modal');
                if (paymentModal) {
                    paymentModal.style.pointerEvents = 'auto';
                }
                
                // 모달이 열린 후 버튼 상태 확인 (약간의 지연을 두어 DOM 업데이트 보장)
                setTimeout(() => {
                    checkPaymentButtonState();
                }, 100);
            }
        }, 50);
    }

    // 결제 모달 닫기
    function closePaymentModal() {
        const paymentModalOverlay = document.getElementById('payment-modal-overlay');
        if (paymentModalOverlay) {
            paymentModalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        selectedPaymentPackage = null;
    }

    // 결제 버튼 활성화 상태 확인
    function checkPaymentButtonState() {
        const paymentMethods = document.querySelectorAll('.payment-method-btn');
        const termsCheckbox = document.getElementById('terms-agree');
        const submitBtn = document.getElementById('payment-submit-btn');
        
        if (!submitBtn) {
            console.warn('결제하기 버튼을 찾을 수 없습니다.');
            return;
        }
        
        const isPaymentMethodSelected = Array.from(paymentMethods).some(btn => btn.classList.contains('active'));
        const isTermsAgreed = termsCheckbox ? termsCheckbox.checked : false;
        
        const shouldEnable = isPaymentMethodSelected && isTermsAgreed;
        submitBtn.disabled = !shouldEnable;
        
        // 디버깅용 로그
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('결제 버튼 상태:', {
                isPaymentMethodSelected,
                isTermsAgreed,
                shouldEnable,
                disabled: submitBtn.disabled
            });
        }
    }

    // 결제 처리
    function processPayment() {
        if (!selectedPaymentPackage) return;

        // 결제 방법 선택 확인
        const paymentMethods = document.querySelectorAll('.payment-method-btn');
        const isPaymentMethodSelected = Array.from(paymentMethods).some(btn => btn.classList.contains('active'));
        if (!isPaymentMethodSelected) {
            alert('결제 방법을 선택해주세요.');
            return;
        }

        // 약관 동의 확인
        const termsCheckbox = document.getElementById('terms-agree');
        if (!termsCheckbox || !termsCheckbox.checked) {
            alert('약관에 동의해주세요.');
            return;
        }

        // 크레딧 충전
        const currentBalance = parseInt(localStorage.getItem('creditBalance') || '0');
        const bonus = selectedPaymentPackage.bonus || 0;
        const newBalance = currentBalance + selectedPaymentPackage.credit + bonus;
        localStorage.setItem('creditBalance', newBalance.toString());

        // 총 충전 금액 업데이트
        const totalCharged = parseInt(localStorage.getItem('totalCharged') || '0');
        localStorage.setItem('totalCharged', (totalCharged + selectedPaymentPackage.credit + bonus).toString());

        // 사용 내역 추가
        const creditHistory = JSON.parse(localStorage.getItem('creditHistory') || '[]');
        creditHistory.unshift({
            date: new Date().toISOString(),
            type: 'charge',
            description: `크레딧 충전`,
            amount: selectedPaymentPackage.credit + bonus,
            balance: newBalance
        });
        localStorage.setItem('creditHistory', JSON.stringify(creditHistory));

        // 결제 내역 저장
        const paymentMethod = document.querySelector('.payment-method-btn.active')?.textContent.trim() || '신용카드';
        const paymentHistory = JSON.parse(localStorage.getItem('paymentHistory') || '[]');
        paymentHistory.unshift({
            type: 'credit',
            credit: selectedPaymentPackage.credit + bonus,
            price: selectedPaymentPackage.price,
            paymentDate: new Date().toISOString(),
            paymentMethod: paymentMethod
        });
        localStorage.setItem('paymentHistory', JSON.stringify(paymentHistory));

        // 결제 완료 모달 표시
        showPaymentSuccessModal(selectedPaymentPackage, newBalance);
        
        // 결제 모달 닫기
        closePaymentModal();

        // 크레딧 표시 업데이트
        if (typeof updateUserCreditDisplay === 'function') {
            updateUserCreditDisplay();
        }
    }

    // 결제 완료 모달 표시
    function showPaymentSuccessModal(package, balance) {
        const modal = document.getElementById('payment-success-modal-overlay');
        const creditElement = document.getElementById('success-credit');
        const priceElement = document.getElementById('success-price');
        const balanceElement = document.getElementById('success-balance');

        if (modal && creditElement && priceElement && balanceElement) {
            const bonus = package.bonus || 0;
            creditElement.textContent = (package.credit + bonus).toLocaleString() + ' 크레딧';
            priceElement.textContent = package.price.toLocaleString() + '원';
            balanceElement.textContent = balance.toLocaleString() + ' 크레딧';

            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
        }
    }

    // 결제 완료 모달 닫기
    function closePaymentSuccessModal() {
        const modal = document.getElementById('payment-success-modal-overlay');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    // 간편결제 더보기 토글
    function toggleEasyPaymentMore(event) {
        if (event) event.preventDefault();
        const moreLink = document.getElementById('easy-payment-more');
        const moreItems = document.querySelectorAll('.payment-method-more');
        if (!moreLink || !moreItems.length) return;

        const isExpanded = moreLink.getAttribute('data-expanded') === 'true';
        const icon = moreLink.querySelector('i');

        if (isExpanded) {
            moreItems.forEach(item => {
                item.style.display = 'none';
            });
            if (icon) {
                icon.className = 'fas fa-chevron-down';
            }
            moreLink.setAttribute('data-expanded', 'false');
        } else {
            moreItems.forEach(item => {
                item.style.display = 'flex';
            });
            if (icon) {
                icon.className = 'fas fa-chevron-up';
            }
            moreLink.setAttribute('data-expanded', 'true');
        }
    }

    // 신용·체크카드 더보기 토글
    function toggleCardPaymentMore(event) {
        if (event) event.preventDefault();
        const moreLink = document.getElementById('card-payment-more');
        const moreItems = document.querySelectorAll('.payment-card-more');
        if (!moreLink || !moreItems.length) return;

        const isExpanded = moreLink.getAttribute('data-expanded') === 'true';
        const icon = moreLink.querySelector('i');

        if (isExpanded) {
            moreItems.forEach(item => {
                item.style.display = 'none';
            });
            if (icon) {
                icon.className = 'fas fa-chevron-down';
            }
            moreLink.setAttribute('data-expanded', 'false');
        } else {
            moreItems.forEach(item => {
                item.style.display = 'flex';
            });
            if (icon) {
                icon.className = 'fas fa-chevron-up';
            }
            moreLink.setAttribute('data-expanded', 'true');
        }
    }

    // 패키지 충전하기 버튼 클릭 이벤트 (동적으로 추가된 버튼들)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('credit-package-charge-btn') || e.target.closest('.credit-package-charge-btn')) {
            const btn = e.target.classList.contains('credit-package-charge-btn') ? e.target : e.target.closest('.credit-package-charge-btn');
            const packageId = parseInt(btn.dataset.packageId);
            selectPaymentPackage(packageId);
        }
    });

    // 결제 모달 이벤트 리스너 설정 (전역 이벤트 위임 사용)
    // DOMContentLoaded와 관계없이 항상 작동하도록 document에 직접 등록
    document.addEventListener('click', function(e) {
        // 결제 모달이 열려있을 때만 처리
        const paymentModalOverlayEl = document.getElementById('payment-modal-overlay');
        if (!paymentModalOverlayEl || !paymentModalOverlayEl.classList.contains('active')) {
            return;
        }
        
        // 결제 방법 버튼 클릭 처리
        const clickedBtn = e.target.closest('.payment-method-btn');
        if (clickedBtn) {
            e.stopPropagation();
            e.preventDefault();
            const paymentMethods = document.querySelectorAll('.payment-method-btn');
            paymentMethods.forEach(btn => btn.classList.remove('active'));
            clickedBtn.classList.add('active');
            checkPaymentButtonState();
            return;
        }
        
        // 결제 모달 닫기 버튼 클릭 처리
        if (e.target.closest('.payment-modal-close') || e.target.classList.contains('payment-modal-close')) {
            e.stopPropagation();
            e.preventDefault();
            closePaymentModal();
            return;
        }
        
        // 모달 외부 클릭 시 닫기 (결제 방법 버튼이나 모달 내부가 아닐 때만)
        if (e.target === paymentModalOverlayEl) {
            closePaymentModal();
        }
    }, true); // capture phase에서 처리하여 다른 이벤트보다 먼저 실행

    // 약관 동의 체크박스 (이벤트 위임 사용)
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'terms-agree') {
            checkPaymentButtonState();
        }
    });

    // 결제 모달 닫기 버튼 (이벤트 위임으로 처리 - 이미 위에서 처리됨)
    
    // 결제하기 버튼 (이벤트 위임 사용)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'payment-submit-btn') {
            e.stopPropagation();
            e.preventDefault();
            processPayment();
        }
    });

    // 결제 완료 모달 닫기 버튼
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'payment-success-close-btn') {
            e.stopPropagation();
            e.preventDefault();
            closePaymentSuccessModal();
        }
    });

    // 결제 완료 모달 외부 클릭 시 닫기
    document.addEventListener('click', function(e) {
        const paymentSuccessModalOverlay = document.getElementById('payment-success-modal-overlay');
        if (paymentSuccessModalOverlay && e.target === paymentSuccessModalOverlay) {
            closePaymentSuccessModal();
        }
    });

    // 간편결제 더보기
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'easy-payment-more') {
            e.preventDefault();
            toggleEasyPaymentMore(e);
        }
    });

    // 신용·체크카드 더보기
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'card-payment-more') {
            e.preventDefault();
            toggleCardPaymentMore(e);
        }
    });
    
    // 원본 언어 칩 클릭 이벤트 (언어 선택 모달 열기)
    const originalLanguageChip = document.getElementById('originalLanguageChipItem');
    if (originalLanguageChip) {
        originalLanguageChip.addEventListener('click', (e) => {
            // 제거 버튼 클릭이 아닌 경우에만 모달 열기
            if (!e.target.classList.contains('fa-times')) {
                openOriginalLanguageModal();
            }
        });
    }
    
    // 원본 언어 선택 모달 열기 함수
    function openOriginalLanguageModal() {
        const languageModal = document.getElementById('languageModal');
        if (!languageModal) return;
        
        // 현재 원본 언어 가져오기
        const originalLangSelect = document.getElementById('originalLang');
        const currentLang = originalLangSelect ? originalLangSelect.value : 'ko';
        
        // 현재 번역 언어로 추가된 언어들 가져오기
        const translationChips = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'));
        const translationLangs = translationChips.map(chip => chip.dataset.lang);
        
        // 모달의 언어 아이템들에 현재 원본 언어 표시 및 중복 방지
        modalLanguageItems.forEach(item => {
            const lang = item.dataset.lang;
            if (lang === currentLang) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
            
            // 이미 번역 언어로 추가된 언어는 원본 언어로 선택 불가
            if (translationLangs.includes(lang)) {
                item.classList.add('disabled');
                item.style.opacity = '0.5';
                item.style.cursor = 'not-allowed';
            } else {
                item.classList.remove('disabled');
                item.style.opacity = '1';
                item.style.cursor = 'pointer';
            }
        });
        
        // 원본 언어 선택 모드로 설정
        languageModal.dataset.mode = 'original';
        languageModal.style.display = 'flex';
    }
    
    // 언어 칩 제거 (번역 언어만, 원본 언어는 제거 불가)
    const languageChips = document.querySelectorAll('.language-chip:not(.original-language-chip)');
    languageChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-times')) {
                chip.remove();
                // 크레딧 정보 업데이트
                updateCreditInfo();
                updateLanguageChipCredits();
                updateLanguageArrow();
            }
        });
    });
    
    // 언어 추가 모달
    const addLanguageBtn = document.querySelector('.add-language-btn');
    const languageModal = document.getElementById('languageModal');
    const closeModal = document.getElementById('closeModal');
    const modalLanguageItems = document.querySelectorAll('.modal-language-item');
    
    // 모달이 열릴 때 현재 선택된 언어들을 표시
    addLanguageBtn.addEventListener('click', () => {
        // 번역 언어 모드로 설정
        if (languageModal) {
            languageModal.dataset.mode = 'translation';
        }
        
        // 10개 제한 체크 (원본 언어 포함)
        const existingChips = Array.from(document.querySelectorAll('.language-chip'));
        if (existingChips.length >= 10) {
            ModalUtils.alert('언어는 원본 언어를 포함하여 최대 10개까지 선택할 수 있습니다.', '언어 선택 제한', { type: 'warning' });
            return;
        }
        
        // 현재 선택된 언어 칩들 가져오기 (원본 언어 칩 제외)
        const existingChipsList = Array.from(document.querySelectorAll('.language-chip'));
        const selectedLangs = existingChipsList.map(chip => chip.dataset.lang);
        
        // 원본 언어 가져오기
        const originalLangSelect = document.getElementById('originalLang');
        const originalLang = originalLangSelect ? originalLangSelect.value : 'ko';
        
        // 모달의 언어 아이템들에 선택 상태 표시 및 중복 방지
        modalLanguageItems.forEach(item => {
            const lang = item.dataset.lang;
            if (selectedLangs.includes(lang)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
            
            // 비활성화 상태 초기화
            item.classList.remove('disabled');
            item.style.opacity = '1';
            item.style.cursor = 'pointer';
            
            // 원본 언어는 번역 언어로 선택 불가
            if (lang === originalLang) {
                item.classList.add('disabled');
                item.style.opacity = '0.5';
                item.style.cursor = 'not-allowed';
            }
        });
        
        languageModal.style.display = 'flex';
    });
    
    closeModal.addEventListener('click', () => {
        languageModal.style.display = 'none';
    });
    
    languageModal.addEventListener('click', (e) => {
        if (e.target === languageModal) {
            languageModal.style.display = 'none';
        }
    });
    
    // 해당 언어 원어 이름 매핑
    function getLanguageDisplayName(langCode) {
        const langMap = {
            'ko': '한국어',
            'en': 'English',
            'ja': '日本語',
            'zh': '中文(간체)',
            'zh-TW': '中文(번체)',
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'pt': 'Português',
            'it': 'Italiano',
            'ru': 'Русский',
            'vi': 'Tiếng Việt',
            'th': 'ไทย',
            'id': 'Bahasa Indonesia',
            'hi': 'हिन्दी',
            'ar': 'العربية',
            'tr': 'Türkçe',
            'pl': 'Polski',
            'nl': 'Nederlands',
            'sv': 'Svenska',
            'no': 'Norsk',
            'da': 'Dansk',
            'fi': 'Suomi',
            'cs': 'Čeština',
            'hu': 'Magyar',
            'el': 'Ελληνικά',
            'he': 'עברית',
            'uk': 'Українська',
            'ms': 'Bahasa Melayu',
            'ro': 'Română'
        };
        return langMap[langCode] || langCode;
    }
    
    // 크레딧 정보 업데이트 함수
    function updateCreditInfo() {
        const creditInfoEl = document.getElementById('creditInfo');
        const translateBtn = document.getElementById('translateBtn');
        
        // 비디오가 없거나 길이가 0인 경우
        if (!currentVideoDuration || currentVideoDuration === 0) {
            if (creditInfoEl) creditInfoEl.style.display = 'none';
            // 버튼 텍스트도 초기화
            if (translateBtn) {
                translateBtn.innerHTML = '<span>자막 생성하기</span>';
            }
            return;
        }
        
        // 선택된 언어 수 계산 (번역 언어만, 원본 언어 제외)
        const selectedLanguages = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'));
        const translationCount = selectedLanguages.length;
        
        // 크레딧 계산
        const requiredCredits = CreditSystem.calculateRequiredCredits(currentVideoDuration, translationCount);
        
        // 사용자 보유 크레딧 가져오기
        const userCredits = parseInt(localStorage.getItem('creditBalance') || '0');
        
        // 크레딧 정보 표시 (creditInfoEl이 있는 경우)
        if (creditInfoEl) {
            creditInfoEl.textContent = `${requiredCredits.toLocaleString()} 크레딧`;
            creditInfoEl.style.display = 'inline-block';
        }
        
        // 자막 생성하기 버튼에 크레딧 정보 추가
        if (translateBtn) {
            // 버튼이 "번역 중..." 상태가 아닐 때만 업데이트
            const currentText = translateBtn.textContent.trim();
            const hasSpinner = translateBtn.querySelector('.fa-spinner');
            if (!currentText.includes('번역 중') && !hasSpinner) {
                translateBtn.innerHTML = `
                    <span>자막 생성하기</span>
                    <span class="credit-info">
                        <img src="assets/image/credit.png" alt="크레딧" class="credit-icon">
                        ${requiredCredits.toLocaleString()}
                    </span>
                `;
            }
        }
        
        // 충전하기 버튼은 항상 표시 (제거하지 않음)
    }
    
    // 언어 칩 크레딧 정보 업데이트 함수
    function updateLanguageChipCredits() {
        if (!currentVideoDuration || currentVideoDuration === 0) return;
        
        const durationMinutes = Math.ceil(currentVideoDuration / 60);
        const baseCredits = durationMinutes * 10; // 기본 자막 크레딧
        const translationCredits = durationMinutes * 5; // 번역 언어당 크레딧
        
        // 원어 칩 크레딧 업데이트
        const originalChip = document.getElementById('originalLanguageChipItem');
        if (originalChip) {
            const existingCredit = originalChip.querySelector('.chip-credit');
            if (existingCredit) {
                existingCredit.textContent = baseCredits;
            } else {
                const langText = originalChip.querySelector('span');
                if (langText) {
                    langText.insertAdjacentHTML('afterend', `
                        <img src="assets/image/credit.png" alt="크레딧" class="credit-icon">
                        <span class="chip-credit">${baseCredits}</span>
                    `);
                }
            }
        }
        
        // 번역 언어 칩 크레딧 업데이트
        const translationChips = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'));
        translationChips.forEach(chip => {
            const existingCredit = chip.querySelector('.chip-credit');
            if (existingCredit) {
                existingCredit.textContent = translationCredits;
            } else {
                const span = chip.querySelector('span');
                if (span && !span.classList.contains('chip-credit')) {
                    span.insertAdjacentHTML('afterend', `
                        <img src="assets/image/credit.png" alt="크레딧" class="credit-icon">
                        <span class="chip-credit">${translationCredits}</span>
                    `);
                }
            }
        });
    }
    
    // 언어 칩 추가 함수
    function addLanguageChip(lang, updateModalState = true) {
        // 10개 제한 체크 (원본 언어 포함)
        const existingChips = Array.from(document.querySelectorAll('.language-chip'));
        if (existingChips.length >= 10) {
            ModalUtils.alert('언어는 원본 언어를 포함하여 최대 10개까지 선택할 수 있습니다.', '언어 선택 제한', { type: 'warning' });
            return;
        }
        
        // 현재 언어 칩들 가져오기
        const alreadyAdded = existingChips.some(chip => chip.dataset.lang === lang);
        
        if (alreadyAdded) {
            return; // 이미 추가된 언어면 리턴
        }
        
        // 언어 칩 생성
        const chip = document.createElement('div');
        chip.className = 'language-chip';
        chip.dataset.lang = lang;
        const displayName = getLanguageDisplayName(lang);
        
        // 번역 언어 크레딧 계산 (1분당 5 크레딧)
        const durationMinutes = currentVideoDuration ? Math.ceil(currentVideoDuration / 60) : 0;
        const translationCredits = durationMinutes * 5;
        
        chip.innerHTML = `
            <span>${displayName}</span>
            <img src="assets/image/credit.png" alt="크레딧" class="credit-icon">
            <span class="chip-credit">${translationCredits}</span>
            <i class="fas fa-times"></i>
        `;
        
        chip.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-times')) {
                chip.remove();
                // 칩 제거 시 모달의 선택 상태도 업데이트
                if (updateModalState) {
                    const modalItem = Array.from(modalLanguageItems).find(i => i.dataset.lang === lang);
                    if (modalItem) {
                        modalItem.classList.remove('selected');
                    }
                }
                // 화살표 표시/숨김 업데이트
                updateLanguageArrow();
                // 크레딧 정보 업데이트
                updateCreditInfo();
                updateLanguageChipCredits();
                // 번역 버튼 표시/숨김 업데이트
                updateTranslateButtonVisibility();
            }
        });
        
        addLanguageBtn.parentElement.insertBefore(chip, addLanguageBtn);
        
        // 모달의 선택 상태 업데이트
        if (updateModalState) {
            const modalItem = Array.from(modalLanguageItems).find(i => i.dataset.lang === lang);
            if (modalItem) {
                modalItem.classList.add('selected');
            }
        }
        
        // 화살표 표시/숨김 업데이트
        updateLanguageArrow();
        
        // 크레딧 정보 업데이트
        updateCreditInfo();
        updateLanguageChipCredits();
        
        // 번역 버튼 표시/숨김 업데이트
        updateTranslateButtonVisibility();
    }
    
    // 언어 칩 제거 함수
    function removeLanguageChip(lang) {
        const existingChips = Array.from(document.querySelectorAll('.language-chip'));
        const chipToRemove = existingChips.find(chip => chip.dataset.lang === lang);
        if (chipToRemove) {
            chipToRemove.remove();
            // 칩 제거 시 모달의 선택 상태도 업데이트
            const modalItem = Array.from(modalLanguageItems).find(i => i.dataset.lang === lang);
            if (modalItem) {
                modalItem.classList.remove('selected');
            }
            // 화살표 표시/숨김 업데이트
            updateLanguageArrow();
            // 크레딧 정보 업데이트
            updateCreditInfo();
            updateLanguageChipCredits();
            // 번역 버튼 표시/숨김 업데이트
            updateTranslateButtonVisibility();
        }
    }
    
    // 모달에서 언어 선택/해제 토글 - 즉시 적용
    modalLanguageItems.forEach(item => {
        item.addEventListener('click', () => {
            const lang = item.dataset.lang;
            const languageModal = document.getElementById('languageModal');
            const isOriginalMode = languageModal && languageModal.dataset.mode === 'original';
            
            // 원본 언어 모드인 경우
            if (isOriginalMode) {
                // 비활성화된 언어는 선택 불가
                if (item.classList.contains('disabled')) {
                    return;
                }
                
                // 기존 원본 언어 가져오기
                const originalLangSelect = document.getElementById('originalLang');
                const oldOriginalLang = originalLangSelect ? originalLangSelect.value : 'ko';
                
                // 원본 언어 업데이트
                const originalLanguageChip = document.getElementById('originalLanguageChipItem');
                
                if (originalLangSelect) {
                    originalLangSelect.value = lang;
                }
                if (originalLanguageChip) {
                    originalLanguageChip.dataset.lang = lang;
                    const langText = originalLanguageChip.querySelector('#originalLangText');
                    if (langText) {
                        langText.textContent = getLanguageDisplayName(lang);
                    }
                }
                
                // 기존 원본 언어가 번역 언어로 추가되어 있었다면 제거
                const translationChips = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'));
                translationChips.forEach(chip => {
                    if (chip.dataset.lang === oldOriginalLang) {
                        chip.remove();
                    }
                });
                
                // 모달 닫기
                languageModal.style.display = 'none';
                languageModal.dataset.mode = '';
                
                // 크레딧 정보 업데이트 (원본 언어 텍스트도 함께 업데이트)
                updateCreditInfo();
                updateLanguageChipCredits();
                
                // 언어 표시 업데이트
                if (typeof updateLanguageDisplay === 'function') {
                    updateLanguageDisplay();
                }
                return;
            }
            
            // 번역 언어 모드인 경우 (기존 로직)
            // 비활성화된 언어는 선택 불가
            if (item.classList.contains('disabled')) {
                return;
            }
            
            // 원본 언어와 중복 체크
            const originalLangSelect = document.getElementById('originalLang');
            const originalLang = originalLangSelect ? originalLangSelect.value : 'ko';
            if (lang === originalLang) {
                return; // 원본 언어와 동일한 언어는 추가할 수 없음
            }
            
            // 현재 언어 칩들 가져오기
            const existingChips = Array.from(document.querySelectorAll('.language-chip'));
            const alreadyAdded = existingChips.some(chip => chip.dataset.lang === lang);
            
            if (alreadyAdded) {
                // 이미 추가된 언어면 제거 (원본 언어는 제거 불가)
                const chipToRemove = existingChips.find(chip => chip.dataset.lang === lang && !chip.classList.contains('original-language-chip'));
                if (chipToRemove) {
                    removeLanguageChip(lang);
                }
            } else {
                // 추가되지 않은 언어면 추가 (10개 제한 체크)
                if (existingChips.length >= 10) {
                    ModalUtils.alert('언어는 원본 언어를 포함하여 최대 10개까지 선택할 수 있습니다.', '언어 선택 제한', { type: 'warning' });
                    return;
                }
                addLanguageChip(lang);
            }
        });
    });
    
    // 화살표 표시/숨김 업데이트 함수
    function updateLanguageArrow() {
        const languageArrow = document.getElementById('languageArrow');
        if (!languageArrow) return;
        
        const translationChips = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'));
        if (translationChips.length > 0) {
            languageArrow.style.display = 'flex';
        } else {
            languageArrow.style.display = 'none';
        }
    }
    
    // 번역 버튼 표시/숨김 업데이트 함수
    function updateTranslateButtonVisibility() {
        const translateBtn = document.getElementById('translateBtn');
        if (!translateBtn) return;
        
        const hasVideo = selectedFile && currentVideoDuration > 0;
        const hasLanguages = document.querySelectorAll('.language-chip').length > 0;
        
        if (hasVideo && hasLanguages) {
            translateBtn.style.display = 'flex';
            // 버튼이 표시될 때 크레딧 정보 업데이트 (약간의 지연을 두어 DOM 업데이트 보장)
            setTimeout(() => {
                updateCreditInfo();
            }, 50);
        } else {
            translateBtn.style.display = 'none';
        }
    }
    
    // Translate Now 버튼
    const translateBtn = document.getElementById('translateBtn');
    if (!translateBtn) {
        console.warn('번역 버튼을 찾을 수 없습니다.');
    } else {
        translateBtn.addEventListener('click', async (e) => {
        // 버튼 전체 영역 클릭 처리
        e.stopPropagation();
        
        if (!selectedFile) {
            ModalUtils.alert('영상 파일을 먼저 업로드해주세요.', '영상 파일 필요', { type: 'warning' });
            return;
        }
        
        // 번역 시작 애니메이션
        translateBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            translateBtn.style.transform = 'scale(1)';
        }, 150);
        
        // 번역 설정 가져오기
        const originalLang = document.getElementById('originalLang').value;
        const speakers = 'auto'; // 기본값: 자동 감지
        
        // 선택된 번역 언어들 가져오기 (원본 언어 제외)
        const targetLanguages = Array.from(document.querySelectorAll('.language-chip:not(.original-language-chip)'))
            .map(chip => {
                const langCode = chip.dataset.lang;
                const displayText = chip.querySelector('span').textContent;
                // 원어 이름만 사용 (이미 언어 코드가 제거된 상태)
                return {
                    code: langCode,
                    name: displayText
                };
            })
            .filter(lang => lang.code && lang.name); // 유효한 언어만 필터링
        
        if (targetLanguages.length === 0) {
            ModalUtils.alert('번역할 언어를 최소 1개 이상 선택해주세요.', '언어 선택 필요', { type: 'warning' });
            return;
        }
        
        // 버튼 비활성화 및 로딩 표시
        translateBtn.disabled = true;
        // 원래 텍스트 저장 (크레딧 정보 포함)
        const originalText = translateBtn.innerHTML;
        // 버튼에 진행률 표시 영역 추가
        const translateBtnProgress = document.getElementById('translateBtnProgress');
        const translateBtnProgressFill = document.getElementById('translateBtnProgressFill');
        const translateBtnProgressText = document.getElementById('translateBtnProgressText');
        const translateBtnText = translateBtn.querySelector('.translate-btn-text');
        // 기존 진행률 컨테이너 요소 (없을 수 있음)
        const progressContainer = document.getElementById('translationProgressContainer') || document.querySelector('.translation-progress-container');
        const infoText = document.getElementById('infoText') || document.querySelector('.info-text');
        
        // 버튼 텍스트 숨기기
        if (translateBtnText) {
            translateBtnText.style.display = 'none';
        }
        
        // 진행률 표시 영역 표시 및 초기화
        if (translateBtnProgress) {
            translateBtnProgress.style.display = 'flex';
        }
        if (translateBtnProgressFill) {
            translateBtnProgressFill.style.width = '0%';
        }
        if (translateBtnProgressText) {
            translateBtnProgressText.textContent = '시작 중... (0%)';
        }
        
        /**
         * 진행률 업데이트 함수
         * 진행률은 자막 생성하기 버튼 내부에 표시됩니다.
         */
        const updateProgress = (percent, status) => {
            // 버튼 내부 진행률 요소 가져오기
            const translateBtnProgress = document.getElementById('translateBtnProgress');
            const translateBtnProgressFill = document.getElementById('translateBtnProgressFill');
            const translateBtnProgressText = document.getElementById('translateBtnProgressText');
            const translateBtn = document.getElementById('translateBtn');
            
            // 버튼 내부에 진행률 표시
            if (translateBtnProgress && translateBtnProgressFill && translateBtnProgressText && translateBtn) {
                // 버튼이 사라지지 않도록 보장
                translateBtn.style.display = 'flex';
                // 진행률 표시
                translateBtnProgress.style.display = 'flex';
                translateBtnProgressFill.style.width = percent + '%';
                translateBtnProgressText.textContent = `${status} (${Math.round(percent)}%)`;
                
                // 진행률이 0%가 아니면 진행률 영역 확실히 표시
                if (percent > 0) {
                    translateBtnProgress.style.display = 'flex';
                }
                // 버튼 텍스트 숨기기
                const translateBtnText = translateBtn.querySelector('.translate-btn-text');
                if (translateBtnText) {
                    translateBtnText.style.display = 'none';
                }
            }
            
            // 기존 진행률 표시 로직 (비디오 정보 영역 숨김 처리)
            // 비디오 정보 영역에는 상태 텍스트가 표시되지 않도록 보장
            // (파일명과 크기만 표시)
            const videoPreviewContainer = document.getElementById('videoPreviewContainer');
            if (videoPreviewContainer) {
                // 비디오 컨테이너 내부의 모든 상태 관련 요소 숨김
                const statusElements = videoPreviewContainer.querySelectorAll(
                    '.status-text, [class*="status"], [class*="progress"], .video-status-text, [id*="progress"], [id*="status"], [class*="progress-text"], [class*="progress-percent"], [class*="translation"]'
                );
                statusElements.forEach(el => {
                    if (!el.classList.contains('video-preview-name') && 
                        !el.classList.contains('video-preview-size') &&
                        !el.classList.contains('video-preview-info') &&
                        !el.classList.contains('video-preview')) {
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        el.style.position = 'absolute';
                        el.style.left = '-9999px';
                    }
                });
                
                // 비디오 컨테이너 바로 다음에 오는 모든 텍스트 노드 숨김
                let nextSibling = videoPreviewContainer.nextElementSibling;
                while (nextSibling && !nextSibling.classList.contains('panel-content')) {
                    if (nextSibling.textContent && nextSibling.textContent.trim() && 
                        (nextSibling.textContent.includes('자막') || 
                         nextSibling.textContent.includes('생성') || 
                         nextSibling.textContent.includes('%') ||
                         nextSibling.classList.contains('progress') ||
                         nextSibling.id && nextSibling.id.includes('progress'))) {
                        nextSibling.style.display = 'none';
                        nextSibling.style.visibility = 'hidden';
                        nextSibling.style.position = 'absolute';
                        nextSibling.style.left = '-9999px';
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
                
                // 비디오 정보 영역 바로 아래에 동적으로 추가된 모든 요소 숨김
                const videoPreviewInfo = videoPreviewContainer.querySelector('.video-preview-info');
                if (videoPreviewInfo) {
                    let infoNextSibling = videoPreviewInfo.nextElementSibling;
                    while (infoNextSibling) {
                        if (infoNextSibling.textContent && 
                            (infoNextSibling.textContent.includes('자막') || 
                             infoNextSibling.textContent.includes('생성') || 
                             infoNextSibling.textContent.includes('%'))) {
                            infoNextSibling.style.display = 'none';
                            infoNextSibling.style.visibility = 'hidden';
                            infoNextSibling.style.position = 'absolute';
                            infoNextSibling.style.left = '-9999px';
                        }
                        infoNextSibling = infoNextSibling.nextElementSibling;
                    }
                }
            }
            
            // DOM 요소 캐싱 (음성 인식 상태 표시용)
            const speechRecognitionStatus = document.getElementById('speechRecognitionStatus');
            const speechRecognitionText = document.getElementById('speechRecognitionText');
            const speechRecognitionIcon = document.getElementById('speechRecognitionIcon');
            
            // 상태별 분기 처리
            if (status.includes('비디오 분석')) {
                // 비디오 분석 상태: 음성 인식 상태 영역에 표시
                if (speechRecognitionStatus) {
                    speechRecognitionStatus.style.display = 'flex';
                }
                if (speechRecognitionText) {
                    speechRecognitionText.textContent = status;
                }
                if (speechRecognitionIcon) {
                    speechRecognitionIcon.className = 'fas fa-video';
                }
                // 버튼 내부 진행률 숨김
                if (translateBtnProgress) {
                    translateBtnProgress.style.display = 'none';
                }
            } else if (status.includes('음성 인식')) {
                // 음성 인식 상태: 버튼 내부에 진행률 표시
                if (speechRecognitionStatus) {
                    speechRecognitionStatus.style.display = 'none';
                }
                // 버튼 내부 진행률 표시 (이미 위에서 업데이트됨)
            } else {
                // 그 외 모든 상태 (번역 시작 중, 번역 중, 자막 생성 중, 번역 완료 등)
                // 버튼 내부에 진행률 표시
                if (speechRecognitionStatus) {
                    speechRecognitionStatus.style.display = 'none';
                }
                // 버튼 내부 진행률 표시 (이미 위에서 업데이트됨)
            }
        };
        
        // 변수 선언 (try-catch 블록 외부에서 선언하여 스코프 문제 해결)
        let reservation = null;
        let jobId = null;
        let isFreeTrial = false;
        
        try {
            // 1. 비디오 메타데이터 가져오기 (0-10%)
            updateProgress(0, '비디오 분석 중...');
            const videoUrl = URL.createObjectURL(selectedFile);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = videoUrl;
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('비디오 메타데이터 로드 타임아웃'));
                }, 10000); // 10초 타임아웃
                
                video.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeout);
                    updateProgress(10, '비디오 분석 완료');
                    setTimeout(resolve, 300);
                });
                video.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    reject(new Error('비디오 로드 실패: ' + (e.message || '알 수 없는 오류')));
                });
            });
            
            const duration = video.duration;
            if (!duration || isNaN(duration) || duration <= 0) {
                throw new Error('비디오 길이를 가져올 수 없습니다.');
            }
            const fileSizeGB = selectedFile.size / (1024 * 1024 * 1024);
            
            // 번역 언어 수 계산
            const translationLanguageCount = targetLanguages.length;
            
            // 무료 크레딧 관련 알림 제거됨 - 바로 번역 프로세스 진행
            
            // 크레딧 계산 (1 크레딧 = 6초, 기본 10크레딧/분, 번역 +5크레딧/분)
            const requiredCredits = CreditSystem.calculateRequiredCredits(duration, translationLanguageCount);
            const currentBalance = CreditSystem.getBalance();
            
            // 크레딧 잔액 확인 - 부족하면 자막 생성 중단
            if (currentBalance < requiredCredits) {
                // 진행률 표시 초기화
                updateProgress(0, '크레딧 부족');
                
                const shortageAmount = requiredCredits - currentBalance;
                const goToCharge = await ModalUtils.confirm(
                    `자막 생성을 위한 크레딧이 부족합니다.\n\n• 필요 크레딧: ${requiredCredits.toLocaleString()} 크레딧\n• 보유 크레딧: ${currentBalance.toLocaleString()} 크레딧\n• 부족한 크레딧: ${shortageAmount.toLocaleString()} 크레딧\n\n크레딧을 충전하시겠습니까?`,
                    '크레딧 부족',
                    { confirmText: '충전하기', cancelText: '취소', confirmType: 'primary' }
                );
                
                // 버튼 및 UI 복원
                translateBtn.disabled = false;
                // 버튼 복원 시 크레딧 정보 다시 업데이트
                updateCreditInfo();
                // 진행률 표시 숨기기
                const translateBtnProgress = document.getElementById('translateBtnProgress');
                const translateBtnText = translateBtn.querySelector('.translate-btn-text');
                if (translateBtnProgress) {
                    translateBtnProgress.style.display = 'none';
                }
                if (translateBtnText) {
                    translateBtnText.style.display = 'flex';
                }
                // progressContainer와 infoText는 선택적 요소이므로 안전하게 처리
                if (typeof progressContainer !== 'undefined' && progressContainer) {
                    progressContainer.style.display = 'none';
                }
                if (typeof infoText !== 'undefined' && infoText) {
                    infoText.style.display = 'flex';
                }
                // 버튼이 사라지지 않도록 보장
                translateBtn.style.display = 'flex';
                
                // 크레딧 충전 모달 열기 (사용자가 충전하기를 선택한 경우)
                if (goToCharge) {
                    if (typeof openCreditChargeModal === 'function') {
                        openCreditChargeModal();
                    }
                }
                
                // 크레딧 부족 시 자막 생성 절대 진행 안 함
                return;
            }
            
            // 작업 ID 생성
            jobId = JobManager.createJob(null, {
                videoFileName: selectedFile.name,
                duration: duration,
                originalLang: originalLang,
                targetLanguages: targetLanguages,
                translationLanguageCount: translationLanguageCount,
                requiredCredits: requiredCredits,
                isFreeTrial: isFreeTrial
            });
            
            // 크레딧 예약 (선차감)
            reservation = CreditSystem.reserveCredits(jobId, requiredCredits);
            if (!reservation.success) {
                updateProgress(0, '크레딧 예약 실패');
                const isInHtmlFolder = window.location.pathname.includes('/html/');
                if (reservation.error === 'INSUFFICIENT_CREDITS') {
                    const shortageAmount = reservation.required - reservation.balance;
                    const goToCharge = await ModalUtils.confirm(
                        `크레딧 예약에 실패했습니다.\n\n• 필요 크레딧: ${reservation.required.toLocaleString()} 크레딧\n• 보유 크레딧: ${reservation.balance.toLocaleString()} 크레딧\n• 부족한 크레딧: ${shortageAmount.toLocaleString()} 크레딧\n\n크레딧을 충전하시겠습니까?`,
                        '크레딧 부족',
                        { confirmText: '충전하기', cancelText: '취소', confirmType: 'primary' }
                    );
                    if (goToCharge) {
                        // 크레딧 충전 모달 열기
                        if (typeof openCreditChargeModal === 'function') {
                            openCreditChargeModal();
                        }
                    }
                } else {
                    const shortageAmount = reservation.required - reservation.balance;
                    ModalUtils.alert(
                        `크레딧 예약에 실패했습니다.\n\n• 필요 크레딧: ${reservation.required.toLocaleString()} 크레딧\n• 보유 크레딧: ${reservation.balance.toLocaleString()} 크레딧\n• 부족한 크레딧: ${shortageAmount.toLocaleString()} 크레딧\n\n크레딧을 충전한 후 다시 시도해주세요.`,
                        '크레딧 예약 실패',
                        { type: 'error' }
                    );
                }
                
                JobManager.updateJobStatus(jobId, JobStatus.FAILED, { error: 'INSUFFICIENT_CREDITS' });
                translateBtn.disabled = false;
                // 버튼 복원 시 크레딧 정보 다시 업데이트
                updateCreditInfo();
                // progressContainer와 infoText는 선택적 요소이므로 안전하게 처리
                if (typeof progressContainer !== 'undefined' && progressContainer) {
                    progressContainer.style.display = 'none';
                }
                if (typeof infoText !== 'undefined' && infoText) {
                    infoText.style.display = 'flex';
                }
                return;
            }
            
            // 작업 상태를 처리 중으로 변경
            JobManager.updateJobStatus(jobId, JobStatus.PROCESSING);
            
            logger.log(`크레딧 예약 완료: ${requiredCredits} 크레딧 (작업 ID: ${jobId}, 예약 ID: ${reservation.reservedId}, 남은 크레딧: ${reservation.balance})`);
            
            // 2. STT 처리 (10-50%)
            updateProgress(10, '자막 생성 중...');
            logger.log('번역 시작:', {
                originalLang,
                targetLanguages,
                speakers,
                duration
            });
            
            // STT 시뮬레이션
            let sttSuccess = true;
            try {
                if (!duration || isNaN(duration) || duration <= 0) {
                    throw new Error('유효하지 않은 비디오 길이입니다.');
                }
                await simulateTranslationWithProgress(duration, (progress) => {
                    try {
                        // STT 진행률: 10% ~ 50%
                        const sttProgress = 10 + (progress * 0.4);
                        updateProgress(sttProgress, `자막 생성 중... (${Math.round(progress)}%)`);
                    } catch (progressError) {
                        logger.error('진행률 업데이트 오류:', progressError);
                    }
                });
                // 음성 인식 완료 시 음성 인식 상태 숨김하고 번역 상태로 전환
                const speechRecognitionStatus = document.getElementById('speechRecognitionStatus');
                if (speechRecognitionStatus) {
                    speechRecognitionStatus.style.display = 'none';
                }
                // 번역 진행률 컨테이너 표시 (선택적 요소)
                if (typeof progressContainer !== 'undefined' && progressContainer) {
                    progressContainer.style.display = 'block';
                }
                updateProgress(50, '번역 시작 중...');
            } catch (error) {
                sttSuccess = false;
                logger.error('STT 실패:', error);
                // STT 실패 시 전액 환불
                CreditSystem.refundCredits(reservation.reservedId, jobId, 'STT 처리 실패로 인한 환불');
                JobManager.updateJobStatus(jobId, JobStatus.FAILED, { error: 'STT_FAILED', errorMessage: error.message });
                // 음성 인식 실패 시 음성 인식 상태 숨김
                const speechRecognitionStatus = document.getElementById('speechRecognitionStatus');
                if (speechRecognitionStatus) {
                    speechRecognitionStatus.style.display = 'none';
                }
                updateProgress(0, '자막 생성 실패');
                ModalUtils.alert('자막 생성 처리 중 오류가 발생했습니다.\n\n사용된 크레딧은 자동으로 환불되었습니다.\n다시 시도해주세요.', '처리 오류', { type: 'error' });
                translateBtn.disabled = false;
                // 버튼 복원 시 크레딧 정보 다시 업데이트
                updateCreditInfo();
                // 진행률 표시 숨기기
                const translateBtnProgress = document.getElementById('translateBtnProgress');
                const translateBtnText = translateBtn.querySelector('.translate-btn-text');
                if (translateBtnProgress) {
                    translateBtnProgress.style.display = 'none';
                }
                if (translateBtnText) {
                    translateBtnText.style.display = 'flex';
                }
                // progressContainer와 infoText는 선택적 요소이므로 안전하게 처리
                if (typeof progressContainer !== 'undefined' && progressContainer) {
                    progressContainer.style.display = 'none';
                }
                if (typeof infoText !== 'undefined' && infoText) {
                    infoText.style.display = 'flex';
                }
                // 버튼이 사라지지 않도록 보장
                translateBtn.style.display = 'flex';
                return;
            }
            
            // 3. 번역 처리 (50-80%)
            // 음성 인식 상태 숨김 (이미 위에서 처리됨)
            updateProgress(50, '번역 시작 중...');
            const translationResults = {};
            let translationFailed = false;
            const failedLanguages = [];
            
            // 각 언어별 번역 처리
            for (let i = 0; i < targetLanguages.length; i++) {
                const lang = targetLanguages[i];
                try {
                    await new Promise((resolve) => {
                        // 번역 시뮬레이션 (각 언어당 약간의 시간)
                        const translationTime = Math.min(2000, Math.max(500, duration * 10));
                        setTimeout(() => {
                            const progress = 50 + ((i + 1) / targetLanguages.length * 30);
                            updateProgress(progress, `${lang.name} 번역 중...`);
                            translationResults[lang.code] = true;
                            resolve();
                        }, translationTime);
                    });
                } catch (error) {
                    logger.error(`번역 실패 (${lang.name}):`, error);
                    translationResults[lang.code] = false;
                    translationFailed = true;
                    failedLanguages.push(lang.name);
                }
            }
            
            // 번역 실패 처리
            if (translationFailed) {
                // 실패한 언어에 대한 크레딧만 환불
                const failedLanguageCount = failedLanguages.length;
                const refundAmount = Math.ceil(duration / 60) * CreditSystem.TRANSLATION_CREDIT_PER_MINUTE * failedLanguageCount;
                
                if (refundAmount > 0) {
                    CreditSystem.refundCredits(reservation.reservedId, jobId, 
                        `번역 실패 (${failedLanguages.join(', ')})로 인한 부분 환불`, refundAmount);
                }
                
                // 일부 언어만 실패한 경우 경고만 표시
                if (failedLanguageCount < targetLanguages.length) {
                    ModalUtils.alert(
                        `일부 언어 번역에 실패했습니다.\n\n❌ 실패한 언어: ${failedLanguages.join(', ')}\n\n해당 언어에 대한 크레딧은 자동으로 환불되었습니다.`,
                        '번역 실패',
                        { type: 'warning' }
                    );
                } else {
                    // 모든 번역 실패 시 작업 실패 처리
                    JobManager.updateJobStatus(jobId, JobStatus.FAILED, { error: 'TRANSLATION_FAILED', failedLanguages: failedLanguages });
                    updateProgress(0, '번역 실패');
                    ModalUtils.alert('번역 처리 중 오류가 발생했습니다.\n\n다시 시도해주세요.', '처리 오류', { type: 'error' });
                    translateBtn.disabled = false;
                    // 버튼 복원 시 크레딧 정보 다시 업데이트
                    updateCreditInfo();
                    // 진행률 표시 숨기기
                    const translateBtnProgress = document.getElementById('translateBtnProgress');
                    const translateBtnText = translateBtn.querySelector('.translate-btn-text');
                    if (translateBtnProgress) {
                        translateBtnProgress.style.display = 'none';
                    }
                    if (translateBtnText) {
                        translateBtnText.style.display = 'flex';
                    }
                    // progressContainer와 infoText는 선택적 요소이므로 안전하게 처리
                    if (typeof progressContainer !== 'undefined' && progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                    if (typeof infoText !== 'undefined' && infoText) {
                        infoText.style.display = 'flex';
                    }
                    // 버튼이 사라지지 않도록 보장
                    translateBtn.style.display = 'flex';
                    return;
                }
            }
            
            updateProgress(80, '번역 완료');
            
            // 4. 번역된 자막 생성 (80-90%)
            updateProgress(80, '자막 생성 중...');
            const transcriptions = generateSampleTranscriptions(duration, originalLang, targetLanguages);
            
            // 자막 생성 시뮬레이션
            await new Promise(resolve => {
                let segmentProgress = 0;
                const totalSegments = transcriptions.length;
                const interval = setInterval(() => {
                    segmentProgress += 2;
                    const progress = 70 + (segmentProgress / totalSegments * 20);
                    updateProgress(Math.min(progress, 90), `자막 생성 중... (${Math.round(segmentProgress / totalSegments * 100)}%)`);
                    
                    if (segmentProgress >= totalSegments) {
                        clearInterval(interval);
                        updateProgress(90, '자막 생성 완료');
                        setTimeout(resolve, 300);
                    }
                }, 50);
            });
            
            logger.log('번역 완료, 자막 생성:', transcriptions.length, '개 세그먼트');
            
            // 크레딧 확정 차감
            const description = `영상 자막 생성 (${Math.floor(duration / 60)}분 ${Math.floor(duration % 60)}초, ${translationLanguageCount}개 언어)`;
            CreditSystem.confirmDeduction(reservation.reservedId, jobId, description);
            
            // 업로드 시 저장된 videoId 사용 (없으면 새로 생성)
            let videoId = selectedFile.uploadVideoId;
            const savedVideos = safeJSONParse(localStorage.getItem('savedVideos'), []);
            let existingVideoIndex = -1;
            
            if (videoId) {
                // 업로드 시 저장된 ID로 기존 영상 찾기
                existingVideoIndex = savedVideos.findIndex(v => v.id === videoId);
            } else {
                // 업로드 시 저장되지 않은 경우 파일명과 크기로 찾기
                existingVideoIndex = savedVideos.findIndex(v => 
                    v.fileName === selectedFile.name && v.fileSize === selectedFile.size
                );
                if (existingVideoIndex !== -1) {
                    videoId = savedVideos[existingVideoIndex].id;
                }
            }
            
            let videoData;
            
            // 보관 만료 시간 계산
            const expiresAt = StorageManager.calculateExpiryDate(isFreeTrial);
            
            if (existingVideoIndex !== -1) {
                // 기존 영상 업데이트
                videoData = {
                    ...savedVideos[existingVideoIndex],
                    description: `원본 언어: ${originalLang === 'auto' ? '자동 감지' : originalLang}, 번역 언어: ${targetLanguages.map(l => l.name).join(', ')}`,
                    videoUrl: videoUrl,
                    originalLang: originalLang,
                    targetLanguages: targetLanguages,
                    speakers: speakers,
                    savedAt: new Date().toISOString(),
                    transcriptions: transcriptions,
                    translated: true,
                    translationDate: new Date().toISOString(),
                    jobId: jobId,
                    expiresAt: expiresAt,
                    isFreeTrial: isFreeTrial,
                    downloadable: !isFreeTrial // 무료 크레딧은 다운로드 불가
                };
                logger.log('기존 영상 번역 정보 업데이트:', videoId);
            } else {
                // 새 영상 생성 (업로드 시 저장되지 않은 경우)
                videoId = 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                videoData = {
                    id: videoId,
                    title: selectedFile.name.replace(/\.[^/.]+$/, '') || '새 강의',
                    description: `원본 언어: ${originalLang === 'auto' ? '자동 감지' : originalLang}, 번역 언어: ${targetLanguages.map(l => l.name).join(', ')}`,
                    videoUrl: videoUrl,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size,
                    fileType: selectedFile.type,
                    duration: duration,
                    size: fileSizeGB,
                    originalLang: originalLang,
                    targetLanguages: targetLanguages,
                    speakers: speakers,
                    createdAt: new Date().toISOString(),
                    savedAt: new Date().toISOString(),
                    transcriptions: transcriptions,
                    category: '',
                    tags: [],
                    translated: true,
                    translationDate: new Date().toISOString(),
                    jobId: jobId,
                    expiresAt: expiresAt,
                    isFreeTrial: isFreeTrial,
                    downloadable: !isFreeTrial // 무료 크레딧은 다운로드 불가
                };
                logger.log('새 영상 생성:', videoId);
            }
            
            // 작업에 videoId 연결
            JobManager.updateJobStatus(jobId, JobStatus.COMPLETED, { videoId: videoId });
            
            logger.log('비디오 데이터 생성 완료:', videoId);
            
            // 4. 저장 중 (90-92%) - 최적화된 병렬 저장
            updateProgress(90, '저장 준비 중...');
            
            // IndexedDB와 localStorage를 병렬로 저장하여 속도 최적화
            updateProgress(91, '저장 중...');
            
            const savePromises = [];
            
            // localStorage 저장 (빠른 저장)
            const localStorageSavePromise = (async () => {
                try {
                    const currentSavedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
                    
                    // 중복 체크 (같은 ID가 있으면 업데이트, 없으면 추가)
                    const existingIndex = currentSavedVideos.findIndex(v => v.id === videoId);
                    if (existingIndex !== -1) {
                        currentSavedVideos[existingIndex] = videoData;
                        logger.log('기존 영상 업데이트:', videoId);
                    } else {
                        currentSavedVideos.push(videoData);
                        logger.log('새 영상 추가:', videoId);
                    }
                    
                    localStorage.setItem('savedVideos', JSON.stringify(currentSavedVideos));
                    
                    // 저장 확인
                    const verifySaved = JSON.parse(localStorage.getItem('savedVideos') || '[]');
                    const savedVideo = verifySaved.find(v => v.id === videoId);
                    
                    if (savedVideo) {
                        logger.log('로컬 스토리지 저장 완료, 총 영상 수:', currentSavedVideos.length);
                        return true;
                    } else {
                        throw new Error('저장 확인 실패');
                    }
                } catch (error) {
                    logger.error('localStorage 저장 오류:', error);
                    throw error;
                }
            })();
            
            // IndexedDB 저장 (백그라운드에서 실행)
            const indexDbSavePromise = saveFileToIndexedDB(videoId, selectedFile)
                .then(() => {
                    logger.log('IndexedDB 저장 완료');
                    return true;
                })
                .catch((error) => {
                    logger.error('IndexedDB 저장 오류:', error);
                    // IndexedDB 저장 실패해도 계속 진행
                    return false;
                });
            
            // 병렬 저장 실행
            updateProgress(92, '파일 저장 중...');
            
            try {
                // localStorage는 빠르게 완료되어야 하므로 우선 대기
                await localStorageSavePromise;
                logger.log('localStorage 저장 완료');
                
                // IndexedDB는 백그라운드에서 계속 진행
                indexDbSavePromise.then((success) => {
                    if (success) {
                        logger.log('IndexedDB 백그라운드 저장 완료');
                    }
                });
                
                // 저장 완료 확인
                const finalCheck = JSON.parse(localStorage.getItem('savedVideos') || '[]');
                const finalVideo = finalCheck.find(v => v.id === videoId);
                
                if (!finalVideo) {
                    throw new Error('저장 확인 실패');
                }
                
                logger.log('저장 완료:', {
                    videoId: finalVideo.id,
                    title: finalVideo.title
                });
                
            } catch (error) {
                logger.error('저장 오류:', error);
                // 재시도
                try {
                    const savedVideos = safeJSONParse(localStorage.getItem('savedVideos'), []);
                    const existingIndex = savedVideos.findIndex(v => v.id === videoId);
                    if (existingIndex !== -1) {
                        savedVideos[existingIndex] = videoData;
                    } else {
                        savedVideos.push(videoData);
                    }
                    localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
                    logger.log('재시도 저장 완료');
                } catch (retryError) {
                    logger.error('재시도 저장 실패:', retryError);
                    throw error;
                }
            }
            
            // 완료
            updateProgress(100, '번역 완료!');
            
            // 파일 입력 초기화
            if (fileInput) {
                fileInput.value = '';
            }
            selectedFile = null;
            
            // 완료 후 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 저장 완료 플래그 설정 (마이페이지에서 새로고침하도록)
            localStorage.setItem('videoSaved', 'true');
            localStorage.setItem('lastSavedVideoId', videoId);
            localStorage.setItem('lastSavedVideoTitle', videoData.title);
            localStorage.setItem('lastSavedVideoTime', new Date().toISOString());
            
            // 모달 닫기
            closeTranslationModalFunc();
            
            // 성공 메시지 표시
            const expiryDate = new Date(expiresAt);
            const expiryDateStr = `${expiryDate.getFullYear()}.${String(expiryDate.getMonth() + 1).padStart(2, '0')}.${String(expiryDate.getDate()).padStart(2, '0')} ${String(expiryDate.getHours()).padStart(2, '0')}:${String(expiryDate.getMinutes()).padStart(2, '0')}`;
            
            // 보관 기간 정보 가져오기
            const storagePeriod = StorageManager.getStoragePeriod();
            const periodText = storagePeriod === 1 ? '24시간' : `${storagePeriod}일`;
            
            let successMessage = '✅ 자막 생성이 완료되었습니다!\n\n번역된 영상이 저장되었으며, 나의 작업에서 확인할 수 있습니다.';
            if (isFreeTrial) {
                successMessage += `\n\n📦 보관 정보\n• 보관 기간: ${expiryDateStr}까지 (7일)\n• 다운로드: 불가`;
            } else {
                successMessage += `\n\n📦 보관 정보\n• 보관 기간: ${expiryDateStr}까지 (${periodText})`;
            }
            ModalUtils.alert(successMessage, '처리 완료', { type: 'success' });
            
            // storage.html로 이동 (새로고침 강제)
            setTimeout(() => {
                window.location.href = 'html/storage.html?refresh=true&saved=' + videoId;
            }, 300);
            
        } catch (error) {
            logger.error('번역 오류:', error);
            logger.error('오류 상세:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                reservation: reservation,
                jobId: jobId
            });
            
            // 오류 발생 시 크레딧 환불
            if (reservation && reservation.success && reservation.reservedId && jobId) {
                try {
                    CreditSystem.refundCredits(reservation.reservedId, jobId, '처리 중 오류 발생으로 인한 환불');
                } catch (refundError) {
                    logger.error('크레딧 환불 오류:', refundError);
                }
            }
            
            // 작업 상태를 실패로 변경
            if (jobId) {
                try {
                    JobManager.updateJobStatus(jobId, JobStatus.FAILED, { 
                        error: 'PROCESSING_ERROR', 
                        errorMessage: error.message || '알 수 없는 오류',
                        errorStack: error.stack
                    });
                } catch (statusError) {
                    logger.error('작업 상태 업데이트 오류:', statusError);
                }
            }
            
            // 오류 메시지 생성
            const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
            updateProgress(0, '오류 발생');
            ModalUtils.alert(
                `번역 처리 중 오류가 발생했습니다.\n\n오류: ${errorMessage}\n\n사용된 크레딧은 자동으로 환불되었습니다.\n다시 시도해주세요.`, 
                '처리 오류', 
                { type: 'error' }
            );
            
            translateBtn.disabled = false;
            // 버튼 복원 시 크레딧 정보 다시 업데이트
            updateCreditInfo();
            
            // 진행률 표시 숨기기
            const translateBtnProgress = document.getElementById('translateBtnProgress');
            const translateBtnText = translateBtn.querySelector('.translate-btn-text');
            if (translateBtnProgress) {
                translateBtnProgress.style.display = 'none';
            }
            if (translateBtnText) {
                translateBtnText.style.display = 'flex';
            }
            // progressContainer와 infoText는 선택적 요소이므로 안전하게 처리
            if (typeof progressContainer !== 'undefined' && progressContainer) {
                progressContainer.style.display = 'none';
            }
            if (typeof infoText !== 'undefined' && infoText) {
                infoText.style.display = 'flex';
            }
            // 버튼이 사라지지 않도록 보장
            translateBtn.style.display = 'flex';
        }
    });
    }
    
    // 번역 시뮬레이션 (실제로는 API 호출)
    function simulateTranslation(duration) {
        return new Promise((resolve) => {
            // 번역 시간 시뮬레이션 (비디오 길이에 비례, 최소 2초, 최대 5초)
            const translationTime = Math.min(5000, Math.max(2000, duration * 100));
            setTimeout(resolve, translationTime);
        });
    }
    
    // 진행률 콜백이 있는 번역 시뮬레이션
    function simulateTranslationWithProgress(duration, onProgress) {
        return new Promise((resolve, reject) => {
            try {
                // duration 유효성 검사
                if (!duration || isNaN(duration) || duration <= 0) {
                    reject(new Error('유효하지 않은 비디오 길이입니다.'));
                    return;
                }
                
                // onProgress 콜백 유효성 검사
                if (typeof onProgress !== 'function') {
                    reject(new Error('진행률 콜백 함수가 제공되지 않았습니다.'));
                    return;
                }
                
                // 번역 시간 시뮬레이션 (비디오 길이에 비례, 최소 2초, 최대 5초)
                const translationTime = Math.min(5000, Math.max(2000, duration * 100));
                const steps = 20; // 20단계로 나눔
                const stepTime = translationTime / steps;
                let currentStep = 0;
                
                const interval = setInterval(() => {
                    try {
                        currentStep++;
                        const progress = (currentStep / steps) * 100;
                        onProgress(progress);
                        
                        if (currentStep >= steps) {
                            clearInterval(interval);
                            resolve();
                        }
                    } catch (stepError) {
                        clearInterval(interval);
                        reject(stepError);
                    }
                }, stepTime);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // IndexedDB에 파일 저장
    function saveFileToIndexedDB(videoId, file) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AX2_Videos', 1);
            
            request.onerror = () => {
                logger.error('IndexedDB 열기 실패:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['videos'], 'readwrite');
                const store = transaction.objectStore('videos');
                
                const fileReader = new FileReader();
                
                fileReader.onload = (e) => {
                    const fileData = {
                        id: videoId,
                        data: e.target.result,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        savedAt: new Date().toISOString()
                    };
                    
                    // 최적화: 저장 확인 단계 제거하여 속도 향상
                    const putRequest = store.put(fileData);
                    putRequest.onsuccess = () => {
                        logger.log('IndexedDB 파일 저장 성공:', videoId);
                        resolve(); // 저장 확인 단계 제거하여 속도 향상
                    };
                    putRequest.onerror = () => {
                        logger.error('IndexedDB 저장 실패:', putRequest.error);
                        reject(putRequest.error);
                    };
                };
                
                fileReader.onerror = () => {
                    logger.error('파일 읽기 실패:', fileReader.error);
                    reject(fileReader.error);
                };
                
                fileReader.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        logger.log(`파일 읽기 진행률: ${percent.toFixed(1)}%`);
                    }
                };
                
                fileReader.readAsArrayBuffer(file);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('videos')) {
                    const objectStore = db.createObjectStore('videos', { keyPath: 'id' });
                    objectStore.createIndex('savedAt', 'savedAt', { unique: false });
                    logger.log('IndexedDB objectStore 생성 완료');
                }
            };
        });
    }
    
    // 샘플 트랜스크립션 생성 (실제로는 API에서 받아옴)
    function generateSampleTranscriptions(duration, originalLang, targetLanguages) {
        const transcriptions = [];
        const segmentDuration = 5; // 각 세그먼트 5초
        let currentTime = 0;
        let segmentId = 1;
        
        // 원본 언어 텍스트 샘플
        const originalTexts = {
            'ko': ['안녕하세요', '오늘은 좋은 날씨네요', '이 강의는 매우 유용합니다', '감사합니다', '다음 시간에 뵙겠습니다'],
            'en': ['Hello', 'Nice weather today', 'This lecture is very useful', 'Thank you', 'See you next time'],
            'auto': ['안녕하세요', 'Hello', 'こんにちは', 'Hola']
        };
        
        // 번역 언어별 번역 텍스트 샘플
        const translations = {
            'en': ['Hello', 'Nice weather today', 'This lecture is very useful', 'Thank you', 'See you next time'],
            'es': ['Hola', 'Buen tiempo hoy', 'Esta conferencia es muy útil', 'Gracias', 'Hasta la próxima'],
            'fr': ['Bonjour', 'Beau temps aujourd\'hui', 'Cette conférence est très utile', 'Merci', 'À la prochaine'],
            'ko': ['안녕하세요', '오늘은 좋은 날씨네요', '이 강의는 매우 유용합니다', '감사합니다', '다음 시간에 뵙겠습니다'],
            'ja': ['こんにちは', '今日は良い天気ですね', 'この講義は非常に有用です', 'ありがとうございます', 'また次回お会いしましょう'],
            'zh': ['你好', '今天天气不错', '这个讲座非常有用', '谢谢', '下次见'],
            'vi': ['Xin chào', 'Thời tiết hôm nay đẹp', 'Bài giảng này rất hữu ích', 'Cảm ơn bạn', 'Hẹn gặp lại lần sau']
        };
        
        const originalTextArray = originalTexts[originalLang] || originalTexts['auto'];
        let textIndex = 0;
        
        while (currentTime < duration) {
            const endTime = Math.min(currentTime + segmentDuration, duration);
            const originalText = originalTextArray[textIndex % originalTextArray.length];
            
            // 번역 데이터 생성
            const translationData = {
                id: segmentId++,
                speaker: '화자 1',
                startTime: currentTime,
                endTime: endTime,
                korean: originalLang === 'ko' ? originalText : `번역된 텍스트 (${Math.floor(currentTime)}s-${Math.floor(endTime)}s)`,
                english: ''
            };
            
            // 번역 언어별 번역 추가
            targetLanguages.forEach(targetLang => {
                const langCode = targetLang.code;
                const translatedText = translations[langCode] ? 
                    translations[langCode][textIndex % translations[langCode].length] : 
                    `Translated text (${Math.floor(currentTime)}s-${Math.floor(endTime)}s)`;
                
                if (langCode === 'en') {
                    translationData.english = translatedText;
                } else if (langCode === 'ko') {
                    translationData.korean = translatedText;
                } else {
                    // 다른 언어는 동적으로 추가 가능
                    translationData[langCode] = translatedText;
                }
            });
            
            transcriptions.push(translationData);
            currentTime = endTime;
            textIndex++;
        }
        
        return transcriptions;
    }
    
    // 스크롤 시 네비게이션 효과
    let lastScroll = 0;
    const nav = document.querySelector('.glass-nav');
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 50) {
            nav.style.background = 'rgba(255, 255, 255, 0.95)';
            nav.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)';
        } else {
            nav.style.background = 'rgba(255, 255, 255, 0.8)';
            nav.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.05)';
        }
        lastScroll = currentScroll;
    });
    
    // Floating 애니메이션
    const floatingElements = document.querySelectorAll('.upload-icon, .logo-circle');
    floatingElements.forEach(el => {
        el.addEventListener('mouseenter', function() {
            this.style.animation = 'float-icon 2s ease-in-out infinite';
        });
    });
    
    // 사이드바 아이템 클릭 이벤트
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const page = item.dataset.page;
            
            // 마이페이지인 경우 mypage.html로 이동
            if (page === 'projects') {
                window.location.href = 'html/mypage.html';
                return;
            }
            
            // 다른 페이지는 기본 동작 허용 또는 처리
            if (item.getAttribute('href') === '#') {
                e.preventDefault();
            }
            
            // 모든 아이템에서 active 제거
            sidebarItems.forEach(i => i.classList.remove('active'));
            
            // 클릭한 아이템에 active 추가
            item.classList.add('active');
            
            // 페이지 전환 로직 (필요시 구현)
            logger.log(`${page} 페이지로 이동`);
        });
    });
    
    // 남은 시간 초기화 및 표시
    // 무료 크레딧 정보 업데이트 (비로그인 상태에서만 무료 크레딧 표시) - 전역 함수로 정의
    window.updateFreeCreditInfo = function() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const planInfoBox = document.getElementById('plan-info-box');
        const freeCreditInfoEl = document.getElementById('free-credit-info');
        
        if (!planInfoBox || !freeCreditInfoEl) {
            return; // 요소가 없으면 종료
        }
        
        if (isLoggedIn) {
            // 로그인 상태: 무료 크레딧 표시 숨김 (로그인 후 크레딧은 auth-state.js에서 표시)
            planInfoBox.style.display = 'none';
            freeCreditInfoEl.textContent = '';
            return;
        }
        
        // 비로그인 상태: plan-info-box 강제 표시 (다른 스크립트가 숨기지 못하도록)
        planInfoBox.style.display = 'flex';
        planInfoBox.style.visibility = 'visible';
        planInfoBox.style.opacity = '1';
        planInfoBox.setAttribute('data-force-display', 'true');
        
        // 주기적으로 plan-info-box가 숨겨졌는지 확인하고 복구
        const checkAndRestore = () => {
            if (!isLoggedIn && planInfoBox.style.display === 'none') {
                planInfoBox.style.display = 'flex';
                planInfoBox.style.visibility = 'visible';
            }
        };
        setTimeout(checkAndRestore, 100);
        setTimeout(checkAndRestore, 500);
        
        // 무료 크레딧 표시
        const isUsed = FreeTrialSystem.isUsed();
        let displayText = '';
        
        if (isUsed) {
            // 무료 크레딧을 사용한 경우: 실제 무료 크레딧 잔액 표시
            const freeCreditBalance = parseInt(localStorage.getItem('freeCreditBalance') || '0');
            displayText = `${freeCreditBalance.toLocaleString()} 크레딧`;
        } else {
            // 무료 크레딧을 사용하지 않은 경우: 제공될 크레딧 표시 (항상 100 크레딧)
            displayText = `${FreeTrialSystem.FREE_TRIAL_CREDITS.toLocaleString()} 크레딧`;
        }
        
        // 텍스트 업데이트
        freeCreditInfoEl.textContent = displayText;
        freeCreditInfoEl.style.display = 'inline';
        freeCreditInfoEl.style.visibility = 'visible';
    };
    
    // 네비게이션 바 로드 후 무료 크레딧 정보 업데이트
    function initFreeCreditInfo() {
        // 중복 호출 방지 플래그
        let isUpdating = false;
        let updateTimeout = null;
        
        // 디바운싱된 업데이트 함수 (전역 접근 가능하도록)
        const debouncedUpdateFreeCreditInfo = () => {
            if (isUpdating) return;
            
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }
            
            updateTimeout = setTimeout(() => {
                isUpdating = true;
                updateFreeCreditInfo();
                setTimeout(() => {
                    isUpdating = false;
                }, 100);
            }, 200); // 200ms 디바운싱
        };
        
        // 전역으로 등록 (다른 스크립트에서 사용 가능)
        window.debouncedUpdateFreeCreditInfo = debouncedUpdateFreeCreditInfo;
        
        // MutationObserver로 DOM 변경 감지하여 자동 업데이트 (무한 루프 방지)
        let observerActive = true;
        const observer = new MutationObserver(function(mutations) {
            if (!observerActive || isUpdating) return;
            
            const freeCreditInfoEl = document.getElementById('free-credit-info');
            if (freeCreditInfoEl && freeCreditInfoEl.textContent === '100 크레딧') {
                // 기본값이면 업데이트 (observer 비활성화하여 무한 루프 방지)
                observerActive = false;
                debouncedUpdateFreeCreditInfo();
                // 1초 후 observer 다시 활성화
                setTimeout(() => {
                    observerActive = true;
                }, 1000);
            }
        });
        
        // 네비게이션 바가 로드될 때까지 대기 (최대 50회 시도 = 약 2.5초)
        let navBarRetryCount = 0;
        const maxNavBarRetries = 50;
        
        const checkNavBar = () => {
            const navPlaceholder = document.getElementById('nav-placeholder');
            const freeCreditInfoEl = document.getElementById('free-credit-info');
            
            if (navPlaceholder && freeCreditInfoEl) {
                // MutationObserver 시작
                observer.observe(navPlaceholder, { childList: true, subtree: true });
                
                // 즉시 업데이트 (한 번만)
                debouncedUpdateFreeCreditInfo();
            } else {
                // 네비게이션 바가 아직 로드되지 않았으면 다시 시도
                navBarRetryCount++;
                if (navBarRetryCount < maxNavBarRetries) {
                    setTimeout(checkNavBar, 50);
                } else {
                    // 최대 재시도 횟수 초과 시 종료
                    console.warn('네비게이션 바를 찾을 수 없습니다. 무료 크레딧 정보 업데이트 중단.');
                }
            }
        };
        
        // navBarLoaded 이벤트 리스너 (디바운싱 적용)
        const handleNavBarLoaded = function() {
            debouncedUpdateFreeCreditInfo();
        };
        document.addEventListener('navBarLoaded', handleNavBarLoaded);
        
        // window.load 이벤트에서도 호출 (디바운싱 적용)
        window.addEventListener('load', function() {
            debouncedUpdateFreeCreditInfo();
        });
        
        // 안전장치: 최대 3초 후에는 강제로 실행
        const forceInit = setTimeout(() => {
            console.warn('무료 크레딧 정보 초기화 타임아웃: 강제 실행');
            const planInfoBox = document.getElementById('plan-info-box');
            const freeCreditInfoEl = document.getElementById('free-credit-info');
            if (planInfoBox && freeCreditInfoEl) {
                updateFreeCreditInfo();
            }
        }, 3000);
        
        // DOMContentLoaded에서도 호출
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                clearTimeout(forceInit);
                setTimeout(() => checkNavBar(), 100);
            });
        } else {
            clearTimeout(forceInit);
            checkNavBar();
        }
    }
    
    // 페이지 로드 시 무료 크레딧 정보 초기화
    initFreeCreditInfo();
    
    // localStorage 변경 감지 (크레딧 잔액이 변경될 때마다 업데이트) - 디바운싱 적용
    let lastFreeCreditBalance = parseInt(localStorage.getItem('freeCreditBalance') || '0');
    let lastFreeTrialUsed = localStorage.getItem('freeTrialUsed') === 'true';
    let creditCheckInterval = setInterval(function() {
        const currentFreeCreditBalance = parseInt(localStorage.getItem('freeCreditBalance') || '0');
        const currentFreeTrialUsed = localStorage.getItem('freeTrialUsed') === 'true';
        if (currentFreeCreditBalance !== lastFreeCreditBalance || currentFreeTrialUsed !== lastFreeTrialUsed) {
            lastFreeCreditBalance = currentFreeCreditBalance;
            lastFreeTrialUsed = currentFreeTrialUsed;
            if (typeof window.debouncedUpdateFreeCreditInfo === 'function') {
                window.debouncedUpdateFreeCreditInfo();
            } else {
                updateFreeCreditInfo();
            }
        }
    }, 500); // 0.5초마다 체크
    
    // 주기적으로 강제 업데이트 (다른 스크립트가 값을 변경했을 경우 대비) - 디바운싱 적용
    let forceUpdateInterval = setInterval(function() {
        const freeCreditInfoEl = document.getElementById('free-credit-info');
        if (freeCreditInfoEl) {
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            if (!isLoggedIn) {
                // 비로그인 상태에서만 업데이트
                if (typeof debouncedUpdateFreeCreditInfo === 'function') {
                    debouncedUpdateFreeCreditInfo();
                } else {
                    updateFreeCreditInfo();
                }
            }
        }
    }, 2000); // 2초마다 강제 업데이트
    
    // 페이지 언로드 시 interval 정리
    window.addEventListener('beforeunload', () => {
        if (creditCheckInterval) clearInterval(creditCheckInterval);
        if (forceUpdateInterval) clearInterval(forceUpdateInterval);
        if (updateTimeout) clearTimeout(updateTimeout);
        if (observer) observer.disconnect();
    });
});

