#!/bin/bash
# MySQL/MariaDB 확인 스크립트

echo "=========================================="
echo "AX2 Caption DB 확인 스크립트"
echo "=========================================="
echo ""

# 1. MySQL/MariaDB 서비스 확인
echo "1. MySQL/MariaDB 서비스 상태 확인..."
if systemctl is-active --quiet mysql; then
    echo "✅ MySQL 서비스 실행 중"
    systemctl status mysql --no-pager -l | head -5
elif systemctl is-active --quiet mariadb; then
    echo "✅ MariaDB 서비스 실행 중"
    systemctl status mariadb --no-pager -l | head -5
else
    echo "❌ MySQL/MariaDB 서비스가 실행되지 않음"
    echo ""
    echo "서비스 시작 방법:"
    echo "  sudo systemctl start mysql"
    echo "  또는"
    echo "  sudo systemctl start mariadb"
    exit 1
fi

echo ""

# 2. 포트 확인
echo "2. MySQL 포트 확인 (3306)..."
if ss -lntp | grep -q ":3306"; then
    echo "✅ 포트 3306에서 MySQL/MariaDB 리스닝 중"
    ss -lntp | grep ":3306"
else
    echo "❌ 포트 3306에서 리스닝하지 않음"
fi

echo ""

# 3. 프로세스 확인
echo "3. MySQL/MariaDB 프로세스 확인..."
if pgrep -x mysqld > /dev/null; then
    echo "✅ mysqld 프로세스 실행 중"
    ps aux | grep mysqld | grep -v grep | head -2
elif pgrep -x mariadbd > /dev/null; then
    echo "✅ mariadbd 프로세스 실행 중"
    ps aux | grep mariadbd | grep -v grep | head -2
else
    echo "❌ MySQL/MariaDB 프로세스가 실행되지 않음"
fi

echo ""

# 4. DB 연결 테스트 (선택사항)
echo "4. DB 연결 테스트..."
read -p "DB 연결 테스트를 진행하시겠습니까? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "DB 사용자명: " db_user
    read -sp "DB 비밀번호: " db_pass
    echo ""
    
    if mysql -u "$db_user" -p"$db_pass" -e "SELECT 1;" 2>/dev/null; then
        echo "✅ DB 연결 성공"
        
        # DB 목록 확인
        echo ""
        echo "사용 가능한 데이터베이스:"
        mysql -u "$db_user" -p"$db_pass" -e "SHOW DATABASES;" 2>/dev/null
        
        # ax2_caption DB 확인
        if mysql -u "$db_user" -p"$db_pass" -e "USE ax2_caption; SHOW TABLES;" 2>/dev/null; then
            echo ""
            echo "✅ ax2_caption 데이터베이스 존재"
            echo "테이블 목록:"
            mysql -u "$db_user" -p"$db_pass" -e "USE ax2_caption; SHOW TABLES;" 2>/dev/null
        else
            echo ""
            echo "⚠️  ax2_caption 데이터베이스가 없습니다."
            echo "초기화 방법:"
            echo "  cd ax2-api"
            echo "  mysql -u $db_user -p < db-init.sql"
        fi
    else
        echo "❌ DB 연결 실패"
        echo "사용자명/비밀번호를 확인하세요."
    fi
fi

echo ""
echo "=========================================="
echo "확인 완료"
echo "=========================================="


