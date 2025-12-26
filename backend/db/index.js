/**
 * 데이터베이스 연결
 * PostgreSQL 연결 풀 관리
 */

const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ax2_caption',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    max: 20, // 최대 연결 수
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 연결 테스트
pool.on('connect', () => {
    console.log('데이터베이스 연결 성공');
});

pool.on('error', (err) => {
    console.error('데이터베이스 연결 오류:', err);
});

// 쿼리 실행 헬퍼
pool.query = pool.query.bind(pool);

// 연결 종료 헬퍼
pool.end = async () => {
    await pool.end();
};

module.exports = pool;



