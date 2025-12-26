/**
 * 데이터베이스 초기화 스크립트
 * 스키마 생성 및 초기 데이터 삽입
 */

const fs = require('fs');
const path = require('path');
const db = require('../db/index');

async function initDatabase() {
    const client = await db.connect();
    
    try {
        console.log('데이터베이스 초기화 시작...');
        
        // SQL 파일 읽기
        const sqlFile = path.join(__dirname, '../db/init.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // SQL 실행
        await client.query(sql);
        
        console.log('✅ 데이터베이스 초기화 완료');
        
    } catch (error) {
        console.error('❌ 데이터베이스 초기화 실패:', error);
        throw error;
    } finally {
        client.release();
        await db.end();
    }
}

// 스크립트 실행
if (require.main === module) {
    initDatabase()
        .then(() => {
            console.log('데이터베이스 초기화가 성공적으로 완료되었습니다.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('데이터베이스 초기화 중 오류 발생:', error);
            process.exit(1);
        });
}

module.exports = { initDatabase };



