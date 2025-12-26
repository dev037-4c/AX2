/**
 * S3 Storage Adapter
 * AWS S3를 사용한 스토리지 구현 (스켈레톤)
 * 나중에 S3로 전환 시 이 구현체를 사용
 */

const StorageAdapter = require('./storage-adapter');

class S3StorageAdapter extends StorageAdapter {
    constructor(config = {}) {
        super();
        this.bucket = config.bucket || process.env.AWS_S3_BUCKET;
        this.region = config.region || process.env.AWS_REGION || 'ap-northeast-2';
        this.tempPrefix = 'temp/';
        this.processedPrefix = 'processed/';
        
        // AWS SDK 초기화 (실제 구현 시)
        // this.s3 = new AWS.S3({ region: this.region });
    }

    /**
     * 파일 업로드
     * @param {string} sourcePath - 원본 파일 경로 (로컬)
     * @param {string} destinationPath - 저장소 내 경로
     * @param {Object} metadata - 파일 메타데이터
     * @returns {Promise<string>} S3 객체 키
     */
    async upload(sourcePath, destinationPath, metadata = {}) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        // const fileStream = fs.createReadStream(sourcePath);
        // const uploadParams = {
        //     Bucket: this.bucket,
        //     Key: destinationPath,
        //     Body: fileStream,
        //     ContentType: metadata.contentType,
        //     Metadata: metadata
        // };
        // await this.s3.upload(uploadParams).promise();
        // return destinationPath;
        
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }

    /**
     * 파일 다운로드
     * @param {string} filePath - S3 객체 키
     * @param {string} destinationPath - 다운로드할 로컬 경로
     * @returns {Promise<void>}
     */
    async download(filePath, destinationPath) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }

    /**
     * 파일 삭제
     * @param {string} filePath - S3 객체 키
     * @returns {Promise<void>}
     */
    async delete(filePath) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        // await this.s3.deleteObject({
        //     Bucket: this.bucket,
        //     Key: filePath
        // }).promise();
        
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }

    /**
     * 파일 존재 여부 확인
     * @param {string} filePath - S3 객체 키
     * @returns {Promise<boolean>}
     */
    async exists(filePath) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        // try {
        //     await this.s3.headObject({
        //         Bucket: this.bucket,
        //         Key: filePath
        //     }).promise();
        //     return true;
        // } catch (error) {
        //     if (error.code === 'NotFound') return false;
        //     throw error;
        // }
        
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }

    /**
     * 파일 URL 생성 (Presigned URL)
     * @param {string} filePath - S3 객체 키
     * @param {number} expiresIn - 만료 시간 (초)
     * @returns {Promise<string>} Presigned URL
     */
    async getSignedUrl(filePath, expiresIn = 3600) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        // return this.s3.getSignedUrlPromise('getObject', {
        //     Bucket: this.bucket,
        //     Key: filePath,
        //     Expires: expiresIn
        // });
        
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }

    /**
     * 파일 이동 (S3에서는 복사 후 삭제)
     * @param {string} sourcePath - 원본 경로
     * @param {string} destinationPath - 대상 경로
     * @returns {Promise<void>}
     */
    async move(sourcePath, destinationPath) {
        await this.copy(sourcePath, destinationPath);
        await this.delete(sourcePath);
    }

    /**
     * 파일 복사
     * @param {string} sourcePath - 원본 경로
     * @param {string} destinationPath - 대상 경로
     * @returns {Promise<void>}
     */
    async copy(sourcePath, destinationPath) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        // await this.s3.copyObject({
        //     Bucket: this.bucket,
        //     CopySource: `${this.bucket}/${sourcePath}`,
        //     Key: destinationPath
        // }).promise();
        
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }

    /**
     * 파일 메타데이터 조회
     * @param {string} filePath - S3 객체 키
     * @returns {Promise<Object>} 파일 메타데이터
     */
    async getMetadata(filePath) {
        // TODO: AWS S3 SDK를 사용한 실제 구현
        // const result = await this.s3.headObject({
        //     Bucket: this.bucket,
        //     Key: filePath
        // }).promise();
        // return {
        //     size: result.ContentLength,
        //     contentType: result.ContentType,
        //     lastModified: result.LastModified,
        //     metadata: result.Metadata
        // };
        
        throw new Error('S3 Storage Adapter는 아직 구현되지 않았습니다.');
    }
}

module.exports = S3StorageAdapter;



