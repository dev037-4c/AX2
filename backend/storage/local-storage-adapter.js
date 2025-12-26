/**
 * Local Storage Adapter
 * 로컬 파일 시스템을 사용한 스토리지 구현
 */

const fs = require('fs').promises;
const path = require('path');
const StorageAdapter = require('./storage-adapter');

class LocalStorageAdapter extends StorageAdapter {
    constructor(basePath = './storage') {
        super();
        this.basePath = basePath;
        this.tempPath = path.join(basePath, 'temp');
        this.processedPath = path.join(basePath, 'processed');
        
        // 디렉토리 생성
        this.ensureDirectories();
    }

    /**
     * 필요한 디렉토리 생성
     */
    async ensureDirectories() {
        try {
            await fs.mkdir(this.tempPath, { recursive: true });
            await fs.mkdir(this.processedPath, { recursive: true });
        } catch (error) {
            console.error('디렉토리 생성 오류:', error);
        }
    }

    /**
     * 전체 경로 생성
     * @param {string} filePath - 상대 경로
     * @returns {string} 전체 경로
     */
    _getFullPath(filePath) {
        return path.join(this.basePath, filePath);
    }

    /**
     * 파일 업로드
     * @param {string} sourcePath - 원본 파일 경로 (로컬)
     * @param {string} destinationPath - 저장소 내 경로
     * @param {Object} metadata - 파일 메타데이터
     * @returns {Promise<string>} 저장된 파일 경로
     */
    async upload(sourcePath, destinationPath, metadata = {}) {
        try {
            const fullDestinationPath = this._getFullPath(destinationPath);
            const destinationDir = path.dirname(fullDestinationPath);

            // 디렉토리 생성
            await fs.mkdir(destinationDir, { recursive: true });

            // 파일 복사
            await fs.copyFile(sourcePath, fullDestinationPath);

            return destinationPath;
        } catch (error) {
            console.error('파일 업로드 오류:', error);
            throw new Error(`파일 업로드 실패: ${error.message}`);
        }
    }

    /**
     * 파일 다운로드
     * @param {string} filePath - 저장소 내 파일 경로
     * @param {string} destinationPath - 다운로드할 로컬 경로
     * @returns {Promise<void>}
     */
    async download(filePath, destinationPath) {
        try {
            const fullSourcePath = this._getFullPath(filePath);
            const destinationDir = path.dirname(destinationPath);

            // 디렉토리 생성
            await fs.mkdir(destinationDir, { recursive: true });

            // 파일 복사
            await fs.copyFile(fullSourcePath, destinationPath);
        } catch (error) {
            console.error('파일 다운로드 오류:', error);
            throw new Error(`파일 다운로드 실패: ${error.message}`);
        }
    }

    /**
     * 파일 삭제
     * @param {string} filePath - 저장소 내 파일 경로
     * @returns {Promise<void>}
     */
    async delete(filePath) {
        try {
            const fullPath = this._getFullPath(filePath);
            await fs.unlink(fullPath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('파일 삭제 오류:', error);
                throw new Error(`파일 삭제 실패: ${error.message}`);
            }
            // 파일이 없으면 무시 (이미 삭제됨)
        }
    }

    /**
     * 파일 존재 여부 확인
     * @param {string} filePath - 저장소 내 파일 경로
     * @returns {Promise<boolean>}
     */
    async exists(filePath) {
        try {
            const fullPath = this._getFullPath(filePath);
            await fs.access(fullPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 파일 URL 생성 (로컬에서는 파일 경로 반환)
     * @param {string} filePath - 저장소 내 파일 경로
     * @param {number} expiresIn - 만료 시간 (초) - 로컬에서는 무시
     * @returns {Promise<string>} 파일 경로
     */
    async getSignedUrl(filePath, expiresIn = 3600) {
        // 로컬 스토리지에서는 전체 경로 반환
        // 실제 서비스에서는 정적 파일 서버 URL 반환
        const fullPath = this._getFullPath(filePath);
        return `/storage${filePath}`;
    }

    /**
     * 파일 이동
     * @param {string} sourcePath - 원본 경로
     * @param {string} destinationPath - 대상 경로
     * @returns {Promise<void>}
     */
    async move(sourcePath, destinationPath) {
        try {
            const fullSourcePath = this._getFullPath(sourcePath);
            const fullDestinationPath = this._getFullPath(destinationPath);
            const destinationDir = path.dirname(fullDestinationPath);

            // 디렉토리 생성
            await fs.mkdir(destinationDir, { recursive: true });

            // 파일 이동
            await fs.rename(fullSourcePath, fullDestinationPath);
        } catch (error) {
            console.error('파일 이동 오류:', error);
            throw new Error(`파일 이동 실패: ${error.message}`);
        }
    }

    /**
     * 파일 복사
     * @param {string} sourcePath - 원본 경로
     * @param {string} destinationPath - 대상 경로
     * @returns {Promise<void>}
     */
    async copy(sourcePath, destinationPath) {
        try {
            const fullSourcePath = this._getFullPath(sourcePath);
            const fullDestinationPath = this._getFullPath(destinationPath);
            const destinationDir = path.dirname(fullDestinationPath);

            // 디렉토리 생성
            await fs.mkdir(destinationDir, { recursive: true });

            // 파일 복사
            await fs.copyFile(fullSourcePath, fullDestinationPath);
        } catch (error) {
            console.error('파일 복사 오류:', error);
            throw new Error(`파일 복사 실패: ${error.message}`);
        }
    }

    /**
     * 파일 메타데이터 조회
     * @param {string} filePath - 저장소 내 파일 경로
     * @returns {Promise<Object>} 파일 메타데이터
     */
    async getMetadata(filePath) {
        try {
            const fullPath = this._getFullPath(filePath);
            const stats = await fs.stat(fullPath);

            return {
                size: stats.size,
                lastModified: stats.mtime,
                created: stats.birthtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
            };
        } catch (error) {
            console.error('메타데이터 조회 오류:', error);
            throw new Error(`메타데이터 조회 실패: ${error.message}`);
        }
    }

    /**
     * 임시 경로 반환
     * @returns {string} 임시 디렉토리 경로
     */
    getTempPath() {
        return this.tempPath;
    }

    /**
     * 처리 완료 경로 반환
     * @returns {string} 처리 완료 디렉토리 경로
     */
    getProcessedPath() {
        return this.processedPath;
    }
}

module.exports = LocalStorageAdapter;



