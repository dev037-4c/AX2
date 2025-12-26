/**
 * 비밀번호 검증 유틸리티
 * OWASP A07: Identification and Authentication Failures 대응
 * 강력한 비밀번호 정책 적용
 */

/**
 * 비밀번호 강도 검증
 * @param {string} password - 검증할 비밀번호
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
    const errors = [];

    // 최소 길이 검증 (12자 이상)
    if (!password || password.length < 12) {
        errors.push('비밀번호는 12자 이상이어야 합니다.');
    }

    // 최대 길이 검증 (128자 이하)
    if (password && password.length > 128) {
        errors.push('비밀번호는 128자 이하여야 합니다.');
    }

    // 대문자 포함 검증
    if (!/[A-Z]/.test(password)) {
        errors.push('비밀번호에 대문자가 최소 1개 이상 포함되어야 합니다.');
    }

    // 소문자 포함 검증
    if (!/[a-z]/.test(password)) {
        errors.push('비밀번호에 소문자가 최소 1개 이상 포함되어야 합니다.');
    }

    // 숫자 포함 검증
    if (!/[0-9]/.test(password)) {
        errors.push('비밀번호에 숫자가 최소 1개 이상 포함되어야 합니다.');
    }

    // 특수문자 포함 검증
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('비밀번호에 특수문자가 최소 1개 이상 포함되어야 합니다.');
    }

    // 일반적인 비밀번호 목록 검증 (간단한 예시)
    const commonPasswords = [
        'password', 'password123', '12345678', 'qwerty', 'abc123',
        'Password1', 'Password123', 'Admin123', 'Welcome123'
    ];
    
    const passwordLower = password.toLowerCase();
    if (commonPasswords.some(common => passwordLower.includes(common.toLowerCase()))) {
        errors.push('너무 일반적인 비밀번호는 사용할 수 없습니다.');
    }

    // 연속된 문자 검증 (예: aaa, 123)
    if (/(.)\1{2,}/.test(password)) {
        errors.push('3개 이상 연속된 동일한 문자는 사용할 수 없습니다.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 비밀번호 정책 설명 반환
 * @returns {string} 비밀번호 정책 설명
 */
function getPasswordPolicyDescription() {
    return '비밀번호는 다음 조건을 모두 만족해야 합니다:\n' +
           '- 12자 이상 128자 이하\n' +
           '- 대문자 최소 1개 포함\n' +
           '- 소문자 최소 1개 포함\n' +
           '- 숫자 최소 1개 포함\n' +
           '- 특수문자 최소 1개 포함\n' +
           '- 일반적인 비밀번호 사용 불가\n' +
           '- 3개 이상 연속된 동일한 문자 사용 불가';
}

module.exports = {
    validatePassword,
    getPasswordPolicyDescription
};


