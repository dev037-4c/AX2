const mysql = require('mysql2/promise');
const logger = require('./utils/logger');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ax2_caption',
    connectionLimit: 10,
    charset: 'utf8mb4',
    waitForConnections: true,
    queueLimit: 0
});

// 연결 테스트
pool.getConnection()
    .then(connection => {
        logger.info('DB 연결 성공', {
            host: process.env.DB_HOST || '127.0.0.1',
            database: process.env.DB_NAME || 'ax2_caption'
        });
        connection.release();
    })
    .catch(error => {
        logger.error('DB 연결 실패', {
            error: error.message,
            host: process.env.DB_HOST || '127.0.0.1',
            database: process.env.DB_NAME || 'ax2_caption'
        });
    });

module.exports = pool;


