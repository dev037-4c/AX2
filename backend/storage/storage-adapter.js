/**
 * Storage Adapter 인터페이스
 * 다양한 스토리지 백엔드(S3, Local, Azure 등)를 추상화
 */

class StorageAdapter {
    /**
     * 파일 업로드
     * @param {string} sourcePath - 원본 파일 경로 (로컬)
     * @param {string} destinationPath - 저장소 내 경로
     * @param {Object} metadata - 파일 메타데이터
     * @returns {Promise<string>} 저장된 파일 URL 또는 경로
     */
    async upload(sourcePath, destinationPath, metadata = {}) {
        throw new Error('upload() must be implemented');
    }

    /**
     * 파일 다운로드
     * @param {string} filePath - 저장소 내 파일 경로
     * @param {string} destinationPath - 다운로드할 로컬 경로
     * @returns {Promise<void>}
     */
    async download(filePath, destinationPath) {
        throw new Error('download() must be implemented');
    }

    /**
     * 파일 삭제
     * @param {string} filePath - 저장소 내 파일 경로
     * @returns {Promise<void>}
     */
    async delete(filePath) {
        throw new Error('delete() must be implemented');
    }

    /**
     * 파일 존재 여부 확인
     * @param {string} filePath - 저장소 내 파일 경로
     * @returns {Promise<boolean>}
     */
    async exists(filePath) {
        throw new Error('exists() must be implemented');
    }

    /**
     * 파일 URL 생성 (다운로드용)
     * @param {string} filePath - 저장소 내 파일 경로
     * @param {number} expiresIn - 만료 시간 (초)
     * @returns {Promise<string>} 임시 다운로드 URL
     */
    async getSignedUrl(filePath, expiresIn = 3600) {
        throw new Error('getSignedUrl() must be implemented');
    }

    /**
     * 파일 이동
     * @param {string} sourcePath - 원본 경로
     * @param {string} destinationPath - 대상 경로
     * @returns {Promise<void>}
     */
    async move(sourcePath, destinationPath) {
        throw new Error('move() must be implemented');
    }

    /**
     * 파일 복사
     * @param {string} sourcePath - 원본 경로
     * @param {string} destinationPath - 대상 경로
     * @returns {Promise<void>}
     */
    async copy(sourcePath, destinationPath) {
        throw new Error('copy() must be implemented');
    }

    /**
     * 파일 메타데이터 조회
     * @param {string} filePath - 저장소 내 파일 경로
     * @returns {Promise<Object>} 파일 메타데이터 (size, contentType, lastModified 등)
     */
    async getMetadata(filePath) {
        throw new Error('getMetadata() must be implemented');
    }
}

module.exports = StorageAdapter;



