# AX2 Caption 데이터베이스 스키마

본 문서는 LocalStorage에서 사용 중인 키 목록을 기준으로 서버 데이터베이스 테이블 구조로 변환한 것입니다.

**데이터베이스**: PostgreSQL 권장

---

## 목차

1. [사용자 관련 테이블](#1-사용자-관련-테이블)
2. [비디오 관련 테이블](#2-비디오-관련-테이블)
3. [작업 관련 테이블](#3-작업-관련-테이블)
4. [자막 관련 테이블](#4-자막-관련-테이블)
5. [크레딧 관련 테이블](#5-크레딧-관련-테이블)
6. [결제 관련 테이블](#6-결제-관련-테이블)
7. [설정 관련 테이블](#7-설정-관련-테이블)
8. [기타 테이블](#8-기타-테이블)

---

## 1. 사용자 관련 테이블

### 1.1 users (사용자)

**LocalStorage 키**: `users`, `currentUser`

**테이블명**: `users`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| user_id | VARCHAR(50) | PRIMARY KEY | 사용자 고유 ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 이메일 주소 |
| password_hash | VARCHAR(255) | NULL | 비밀번호 해시 (이메일 로그인만) |
| name | VARCHAR(100) | NOT NULL | 사용자 이름 |
| picture | TEXT | NULL | 프로필 사진 URL |
| provider | VARCHAR(20) | NOT NULL, DEFAULT 'email' | 인증 제공자 (email, google, kakao, naver) |
| provider_id | VARCHAR(255) | NULL | 소셜 제공자 ID |
| marketing_agree | BOOLEAN | DEFAULT FALSE | 마케팅 수신 동의 |
| email_verified | BOOLEAN | DEFAULT FALSE | 이메일 인증 여부 |
| is_active | BOOLEAN | DEFAULT TRUE | 계정 활성화 여부 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |
| deleted_at | TIMESTAMP | NULL | 삭제 일시 (소프트 삭제) |

**인덱스**:
- `idx_users_email` ON `users`(`email`)
- `idx_users_provider` ON `users`(`provider`, `provider_id`)

---

### 1.2 user_sessions (사용자 세션)

**LocalStorage 키**: `isLoggedIn`, `currentUser` (세션 정보)

**테이블명**: `user_sessions`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| session_id | VARCHAR(100) | PRIMARY KEY | 세션 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NOT NULL | 사용자 ID |
| access_token | TEXT | NOT NULL | JWT Access Token |
| refresh_token | TEXT | NOT NULL | JWT Refresh Token |
| access_token_expires_at | TIMESTAMP | NOT NULL | Access Token 만료 시간 |
| refresh_token_expires_at | TIMESTAMP | NOT NULL | Refresh Token 만료 시간 |
| ip_address | VARCHAR(45) | NULL | 로그인 IP 주소 |
| user_agent | TEXT | NULL | 사용자 에이전트 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| last_accessed_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 마지막 접근 일시 |

**인덱스**:
- `idx_user_sessions_user_id` ON `user_sessions`(`user_id`)
- `idx_user_sessions_refresh_token` ON `user_sessions`(`refresh_token`)

---

### 1.3 social_accounts (소셜 계정 연동)

**LocalStorage 키**: `users` (provider 정보 포함)

**테이블명**: `social_accounts`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| social_account_id | VARCHAR(50) | PRIMARY KEY | 소셜 계정 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NOT NULL | 사용자 ID |
| provider | VARCHAR(20) | NOT NULL | 소셜 제공자 (google, kakao, naver) |
| provider_id | VARCHAR(255) | NOT NULL | 소셜 제공자 ID |
| provider_email | VARCHAR(255) | NULL | 소셜 제공자 이메일 |
| provider_name | VARCHAR(100) | NULL | 소셜 제공자 이름 |
| provider_picture | TEXT | NULL | 소셜 제공자 프로필 사진 |
| access_token | TEXT | NULL | 소셜 제공자 Access Token |
| refresh_token | TEXT | NULL | 소셜 제공자 Refresh Token |
| token_expires_at | TIMESTAMP | NULL | 토큰 만료 시간 |
| is_primary | BOOLEAN | DEFAULT FALSE | 주요 계정 여부 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_social_accounts_user_id` ON `social_accounts`(`user_id`)
- `idx_social_accounts_provider` ON `social_accounts`(`provider`, `provider_id`)

---

## 2. 비디오 관련 테이블

### 2.1 videos (비디오)

**LocalStorage 키**: `savedVideos`

**테이블명**: `videos`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| video_id | VARCHAR(50) | PRIMARY KEY | 비디오 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID (NULL: 비로그인) |
| title | VARCHAR(255) | NOT NULL | 비디오 제목 |
| description | TEXT | NULL | 비디오 설명 |
| file_name | VARCHAR(255) | NOT NULL | 원본 파일명 |
| file_size | BIGINT | NOT NULL | 파일 크기 (바이트) |
| file_type | VARCHAR(50) | NOT NULL | 파일 MIME 타입 |
| file_url | TEXT | NOT NULL | 파일 저장 URL (S3 등) |
| thumbnail_url | TEXT | NULL | 썸네일 이미지 URL |
| duration | INTEGER | NOT NULL | 영상 길이 (초) |
| size_gb | DECIMAL(10, 2) | NULL | 파일 크기 (GB) |
| original_language | VARCHAR(10) | NULL | 원본 언어 코드 |
| detected_language | VARCHAR(10) | NULL | 자동 감지된 언어 코드 |
| speakers | INTEGER | DEFAULT 1 | 화자 수 |
| category | VARCHAR(100) | NULL | 카테고리 |
| tags | TEXT[] | NULL | 태그 배열 |
| translated | BOOLEAN | DEFAULT FALSE | 번역 완료 여부 |
| translation_date | TIMESTAMP | NULL | 번역 완료 일시 |
| is_free_trial | BOOLEAN | DEFAULT FALSE | 무료 체험 여부 |
| downloadable | BOOLEAN | DEFAULT TRUE | 다운로드 가능 여부 |
| status | VARCHAR(20) | DEFAULT 'uploaded' | 상태 (uploaded, processing, completed, failed) |
| expires_at | TIMESTAMP | NULL | 만료 일시 (자동 삭제) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |
| deleted_at | TIMESTAMP | NULL | 삭제 일시 (소프트 삭제) |

**인덱스**:
- `idx_videos_user_id` ON `videos`(`user_id`)
- `idx_videos_status` ON `videos`(`status`)
- `idx_videos_created_at` ON `videos`(`created_at`)
- `idx_videos_expires_at` ON `videos`(`expires_at`)

---

### 2.2 video_target_languages (비디오 번역 언어)

**LocalStorage 키**: `savedVideos` (targetLanguages 배열)

**테이블명**: `video_target_languages`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGSERIAL | PRIMARY KEY | 고유 ID |
| video_id | VARCHAR(50) | FOREIGN KEY → videos(video_id), NOT NULL | 비디오 ID |
| language_code | VARCHAR(10) | NOT NULL | 언어 코드 |
| language_name | VARCHAR(100) | NOT NULL | 언어 이름 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |

**인덱스**:
- `idx_video_target_languages_video_id` ON `video_target_languages`(`video_id`)

---

## 3. 작업 관련 테이블

### 3.1 jobs (작업)

**LocalStorage 키**: `jobs`, `videoJobs`

**테이블명**: `jobs`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| job_id | VARCHAR(50) | PRIMARY KEY | 작업 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID (NULL: 비로그인) |
| video_id | VARCHAR(50) | FOREIGN KEY → videos(video_id), NULL | 비디오 ID |
| video_file_name | VARCHAR(255) | NULL | 비디오 파일명 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 상태 (pending, processing, completed, failed, cancelled) |
| progress | INTEGER | DEFAULT 0 | 진행률 (0-100) |
| current_step | VARCHAR(50) | NULL | 현재 단계 (upload, speechRecognition, translation, saving) |
| original_language | VARCHAR(10) | NULL | 원본 언어 코드 |
| detected_language | VARCHAR(10) | NULL | 자동 감지된 언어 코드 |
| speakers | INTEGER | DEFAULT 1 | 화자 수 |
| required_credits | INTEGER | NOT NULL | 필요 크레딧 |
| used_credits | INTEGER | NULL | 사용된 크레딧 |
| is_free_trial | BOOLEAN | DEFAULT FALSE | 무료 체험 여부 |
| error_message | TEXT | NULL | 에러 메시지 |
| error_code | VARCHAR(50) | NULL | 에러 코드 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| started_at | TIMESTAMP | NULL | 시작 일시 |
| completed_at | TIMESTAMP | NULL | 완료 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_jobs_user_id` ON `jobs`(`user_id`)
- `idx_jobs_video_id` ON `jobs`(`video_id`)
- `idx_jobs_status` ON `jobs`(`status`)
- `idx_jobs_created_at` ON `jobs`(`created_at`)

---

### 3.2 job_steps (작업 단계 진행률)

**LocalStorage 키**: `jobs` (steps 정보)

**테이블명**: `job_steps`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | BIGSERIAL | PRIMARY KEY | 고유 ID |
| job_id | VARCHAR(50) | FOREIGN KEY → jobs(job_id), NOT NULL | 작업 ID |
| step_name | VARCHAR(50) | NOT NULL | 단계 이름 (upload, speechRecognition, translation, saving) |
| status | VARCHAR(20) | NOT NULL | 상태 (pending, processing, completed, failed) |
| progress | INTEGER | DEFAULT 0 | 진행률 (0-100) |
| started_at | TIMESTAMP | NULL | 시작 일시 |
| completed_at | TIMESTAMP | NULL | 완료 일시 |
| error_message | TEXT | NULL | 에러 메시지 |

**인덱스**:
- `idx_job_steps_job_id` ON `job_steps`(`job_id`)

---

## 4. 자막 관련 테이블

### 4.1 subtitles (자막)

**LocalStorage 키**: `savedVideos` (transcriptions 배열)

**테이블명**: `subtitles`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| subtitle_id | BIGSERIAL | PRIMARY KEY | 자막 고유 ID |
| video_id | VARCHAR(50) | FOREIGN KEY → videos(video_id), NOT NULL | 비디오 ID |
| language_code | VARCHAR(10) | NOT NULL | 언어 코드 |
| is_original | BOOLEAN | DEFAULT FALSE | 원본 자막 여부 |
| segment_index | INTEGER | NOT NULL | 세그먼트 인덱스 (순서) |
| start_time | DECIMAL(10, 3) | NOT NULL | 시작 시간 (초) |
| end_time | DECIMAL(10, 3) | NOT NULL | 종료 시간 (초) |
| text | TEXT | NOT NULL | 자막 텍스트 |
| speaker_id | INTEGER | NULL | 화자 ID |
| speaker_name | VARCHAR(100) | NULL | 화자 이름 |
| confidence | DECIMAL(5, 2) | NULL | 인식 신뢰도 (0-100) |
| is_edited | BOOLEAN | DEFAULT FALSE | 편집 여부 |
| edited_at | TIMESTAMP | NULL | 편집 일시 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_subtitles_video_id` ON `subtitles`(`video_id`, `language_code`)
- `idx_subtitles_segment_index` ON `subtitles`(`video_id`, `language_code`, `segment_index`)

---

### 4.2 subtitle_versions (자막 버전 관리)

**LocalStorage 키**: 없음 (편집 이력 관리용)

**테이블명**: `subtitle_versions`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| version_id | BIGSERIAL | PRIMARY KEY | 버전 고유 ID |
| video_id | VARCHAR(50) | FOREIGN KEY → videos(video_id), NOT NULL | 비디오 ID |
| language_code | VARCHAR(10) | NOT NULL | 언어 코드 |
| version_number | INTEGER | NOT NULL | 버전 번호 |
| subtitle_data | JSONB | NOT NULL | 자막 데이터 (전체 세그먼트) |
| created_by | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 생성자 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| description | VARCHAR(255) | NULL | 버전 설명 |

**인덱스**:
- `idx_subtitle_versions_video_id` ON `subtitle_versions`(`video_id`, `language_code`)

---

## 5. 크레딧 관련 테이블

### 5.1 credits (크레딧 잔액)

**LocalStorage 키**: `creditBalance`, `freeCreditBalance`

**테이블명**: `credits`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| credit_id | BIGSERIAL | PRIMARY KEY | 크레딧 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID (NULL: 비로그인) |
| balance | INTEGER | NOT NULL, DEFAULT 0 | 크레딧 잔액 |
| free_balance | INTEGER | NOT NULL, DEFAULT 0 | 무료 크레딧 잔액 |
| total_charged | INTEGER | NOT NULL, DEFAULT 0 | 총 충전 금액 |
| device_id | VARCHAR(255) | NULL | 디바이스 ID (비로그인 사용자) |
| ip_address | VARCHAR(45) | NULL | IP 주소 (비로그인 사용자) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_credits_user_id` ON `credits`(`user_id`)
- `idx_credits_device_id` ON `credits`(`device_id`)

---

### 5.2 credit_reservations (크레딧 예약)

**LocalStorage 키**: `creditReservations`

**테이블명**: `credit_reservations`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| reservation_id | VARCHAR(50) | PRIMARY KEY | 예약 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID |
| job_id | VARCHAR(50) | FOREIGN KEY → jobs(job_id), NULL | 작업 ID |
| amount | INTEGER | NOT NULL | 예약 크레딧 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'reserved' | 상태 (reserved, confirmed, refunded, expired) |
| reserved_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 예약 일시 |
| confirmed_at | TIMESTAMP | NULL | 확정 일시 |
| refunded_at | TIMESTAMP | NULL | 환불 일시 |
| expires_at | TIMESTAMP | NULL | 만료 일시 |

**인덱스**:
- `idx_credit_reservations_user_id` ON `credit_reservations`(`user_id`)
- `idx_credit_reservations_job_id` ON `credit_reservations`(`job_id`)
- `idx_credit_reservations_status` ON `credit_reservations`(`status`)

---

### 5.3 credit_history (크레딧 사용 내역)

**LocalStorage 키**: `creditHistory`

**테이블명**: `credit_history`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| history_id | BIGSERIAL | PRIMARY KEY | 내역 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID |
| type | VARCHAR(20) | NOT NULL | 타입 (charge, use, refund, bonus) |
| amount | INTEGER | NOT NULL | 크레딧 양 (양수: 충전/보너스, 음수: 사용) |
| balance_after | INTEGER | NOT NULL | 거래 후 잔액 |
| description | VARCHAR(255) | NULL | 설명 |
| job_id | VARCHAR(50) | FOREIGN KEY → jobs(job_id), NULL | 관련 작업 ID |
| payment_id | VARCHAR(50) | FOREIGN KEY → payments(payment_id), NULL | 관련 결제 ID |
| reservation_id | VARCHAR(50) | FOREIGN KEY → credit_reservations(reservation_id), NULL | 관련 예약 ID |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |

**인덱스**:
- `idx_credit_history_user_id` ON `credit_history`(`user_id`)
- `idx_credit_history_type` ON `credit_history`(`type`)
- `idx_credit_history_created_at` ON `credit_history`(`created_at`)

---

### 5.4 free_trials (무료 체험)

**LocalStorage 키**: `freeTrialUsed`, `freeTrialUsedAt`

**테이블명**: `free_trials`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| trial_id | BIGSERIAL | PRIMARY KEY | 체험 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID (NULL: 비로그인) |
| device_id | VARCHAR(255) | NULL | 디바이스 ID |
| ip_address | VARCHAR(45) | NULL | IP 주소 |
| used_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 사용 일시 |
| credits_given | INTEGER | NOT NULL | 제공된 크레딧 |

**인덱스**:
- `idx_free_trials_user_id` ON `free_trials`(`user_id`)
- `idx_free_trials_device_id` ON `free_trials`(`device_id`)
- `idx_free_trials_ip_address` ON `free_trials`(`ip_address`)

---

## 6. 결제 관련 테이블

### 6.1 credit_packages (크레딧 패키지)

**LocalStorage 키**: 없음 (정적 데이터)

**테이블명**: `credit_packages`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| package_id | VARCHAR(50) | PRIMARY KEY | 패키지 고유 ID |
| name | VARCHAR(100) | NOT NULL | 패키지 이름 |
| credits | INTEGER | NOT NULL | 크레딧 수량 |
| bonus | INTEGER | DEFAULT 0 | 보너스 크레딧 |
| price | INTEGER | NOT NULL | 가격 (원) |
| currency | VARCHAR(10) | DEFAULT 'KRW' | 통화 |
| is_active | BOOLEAN | DEFAULT TRUE | 활성화 여부 |
| display_order | INTEGER | DEFAULT 0 | 표시 순서 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

---

### 6.2 payments (결제)

**LocalStorage 키**: `paymentHistory`

**테이블명**: `payments`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| payment_id | VARCHAR(50) | PRIMARY KEY | 결제 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NOT NULL | 사용자 ID |
| package_id | VARCHAR(50) | FOREIGN KEY → credit_packages(package_id), NOT NULL | 패키지 ID |
| amount | INTEGER | NOT NULL | 결제 금액 (원) |
| currency | VARCHAR(10) | DEFAULT 'KRW' | 통화 |
| payment_method | VARCHAR(50) | NOT NULL | 결제 수단 (card, bank_transfer 등) |
| payment_status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 결제 상태 (pending, completed, failed, refunded) |
| pg_provider | VARCHAR(50) | NULL | PG사 (toss, inicis, iamport 등) |
| pg_transaction_id | VARCHAR(255) | NULL | PG 거래 ID |
| credits | INTEGER | NOT NULL | 충전된 크레딧 |
| bonus_credits | INTEGER | DEFAULT 0 | 보너스 크레딧 |
| total_credits | INTEGER | NOT NULL | 총 크레딧 |
| receipt_url | TEXT | NULL | 영수증 URL |
| paid_at | TIMESTAMP | NULL | 결제 완료 일시 |
| refunded_at | TIMESTAMP | NULL | 환불 일시 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_payments_user_id` ON `payments`(`user_id`)
- `idx_payments_status` ON `payments`(`payment_status`)
- `idx_payments_created_at` ON `payments`(`created_at`)

---

### 6.3 subscriptions (구독)

**LocalStorage 키**: `subscription`, `currentPlan`

**테이블명**: `subscriptions`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| subscription_id | VARCHAR(50) | PRIMARY KEY | 구독 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NOT NULL | 사용자 ID |
| plan_type | VARCHAR(50) | NOT NULL | 플랜 타입 (free, student, general, pro) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 상태 (active, cancelled, expired) |
| started_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 시작 일시 |
| expires_at | TIMESTAMP | NULL | 만료 일시 |
| cancelled_at | TIMESTAMP | NULL | 취소 일시 |
| auto_renew | BOOLEAN | DEFAULT TRUE | 자동 갱신 여부 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_subscriptions_user_id` ON `subscriptions`(`user_id`)
- `idx_subscriptions_status` ON `subscriptions`(`status`)

---

### 6.4 storage_extensions (저장소 확장)

**LocalStorage 키**: `storageExtension`

**테이블명**: `storage_extensions`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| extension_id | VARCHAR(50) | PRIMARY KEY | 확장 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NOT NULL | 사용자 ID |
| extension_type | VARCHAR(20) | NOT NULL | 확장 타입 (plus, pro) |
| additional_storage_gb | DECIMAL(10, 2) | NOT NULL | 추가 저장소 (GB) |
| storage_period_days | INTEGER | NOT NULL | 보관 기간 (일) |
| purchased_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 구매 일시 |
| expires_at | TIMESTAMP | NOT NULL | 만료 일시 |
| is_active | BOOLEAN | DEFAULT TRUE | 활성화 여부 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |

**인덱스**:
- `idx_storage_extensions_user_id` ON `storage_extensions`(`user_id`)
- `idx_storage_extensions_expires_at` ON `storage_extensions`(`expires_at`)

---

## 7. 설정 관련 테이블

### 7.1 user_settings (사용자 설정)

**LocalStorage 키**: `siteLanguage`

**테이블명**: `user_settings`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| setting_id | BIGSERIAL | PRIMARY KEY | 설정 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID (NULL: 비로그인) |
| device_id | VARCHAR(255) | NULL | 디바이스 ID (비로그인 사용자) |
| setting_key | VARCHAR(100) | NOT NULL | 설정 키 |
| setting_value | TEXT | NOT NULL | 설정 값 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_user_settings_user_id` ON `user_settings`(`user_id`, `setting_key`)
- `idx_user_settings_device_id` ON `user_settings`(`device_id`, `setting_key`)

**주요 설정 키**:
- `siteLanguage`: 사이트 언어 (ko, en, ja, zh, es, fr 등)

---

## 8. 기타 테이블

### 8.1 live_lectures (실시간 강의)

**LocalStorage 키**: `liveLectureVideos`, `ax2_live_lectures`, `ax2_current_lecture`

**테이블명**: `live_lectures`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| lecture_id | VARCHAR(50) | PRIMARY KEY | 강의 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID |
| title | VARCHAR(255) | NOT NULL | 강의 제목 |
| language_code | VARCHAR(10) | NOT NULL | 언어 코드 |
| status | VARCHAR(20) | DEFAULT 'active' | 상태 (active, ended, archived) |
| started_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 시작 일시 |
| ended_at | TIMESTAMP | NULL | 종료 일시 |
| video_url | TEXT | NULL | 녹화된 비디오 URL |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 수정 일시 |

**인덱스**:
- `idx_live_lectures_user_id` ON `live_lectures`(`user_id`)
- `idx_live_lectures_status` ON `live_lectures`(`status`)

---

### 8.2 user_activities (사용자 활동 로그)

**LocalStorage 키**: 없음 (로그 관리용)

**테이블명**: `user_activities`

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| activity_id | BIGSERIAL | PRIMARY KEY | 활동 고유 ID |
| user_id | VARCHAR(50) | FOREIGN KEY → users(user_id), NULL | 사용자 ID |
| activity_type | VARCHAR(50) | NOT NULL | 활동 타입 (login, logout, upload, download, edit 등) |
| resource_type | VARCHAR(50) | NULL | 리소스 타입 (video, job, subtitle 등) |
| resource_id | VARCHAR(50) | NULL | 리소스 ID |
| description | TEXT | NULL | 활동 설명 |
| ip_address | VARCHAR(45) | NULL | IP 주소 |
| user_agent | TEXT | NULL | 사용자 에이전트 |
| metadata | JSONB | NULL | 추가 메타데이터 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 일시 |

**인덱스**:
- `idx_user_activities_user_id` ON `user_activities`(`user_id`)
- `idx_user_activities_type` ON `user_activities`(`activity_type`)
- `idx_user_activities_created_at` ON `user_activities`(`created_at`)

---

## 제외된 LocalStorage 키 (임시/세션 데이터)

다음 LocalStorage 키들은 데이터베이스 테이블로 변환하지 않습니다 (임시 세션 데이터):

- `currentEditVideoTitle`: 현재 편집 중인 비디오 제목 (세션 데이터)
- `videoSaved`: 비디오 저장 플래그 (임시 플래그)
- `lastSavedVideoId`: 마지막 저장된 비디오 ID (임시 플래그)
- `lastSavedVideoTitle`: 마지막 저장된 비디오 제목 (임시 플래그)
- `lastSavedVideoTime`: 마지막 저장된 비디오 시간 (임시 플래그)
- `remainingSeconds`: 남은 초 (임시 세션 데이터)
- `remainingMinutes`: 남은 분 (임시 세션 데이터)
- `lastTimeUpdate`: 마지막 시간 업데이트 (임시 세션 데이터)
- `timeInitialized`: 시간 초기화 여부 (임시 플래그)
- `ax2_user`, `ax2_videos`, `ax2_live_lectures`, `ax2_current_lecture`: 다른 형식의 데이터 (통합됨)

---

## 관계도 (ERD 요약)

```
users (1) ──< (N) user_sessions
users (1) ──< (N) social_accounts
users (1) ──< (N) videos
users (1) ──< (N) jobs
users (1) ──< (N) credits
users (1) ──< (N) credit_reservations
users (1) ──< (N) credit_history
users (1) ──< (N) payments
users (1) ──< (N) subscriptions
users (1) ──< (N) storage_extensions
users (1) ──< (N) user_settings
users (1) ──< (N) live_lectures
users (1) ──< (N) user_activities

videos (1) ──< (N) video_target_languages
videos (1) ──< (N) subtitles
videos (1) ──< (N) subtitle_versions
videos (1) ──< (1) jobs

jobs (1) ──< (N) job_steps
jobs (1) ──< (1) credit_reservations
jobs (1) ──< (1) credit_history

credit_packages (1) ──< (N) payments
```

---

## 참고사항

1. **비로그인 사용자 지원**: `user_id`가 NULL인 경우 비로그인 사용자로 처리
2. **소프트 삭제**: 중요한 데이터는 `deleted_at` 컬럼으로 소프트 삭제 구현
3. **타임스탬프**: 모든 테이블에 `created_at`, `updated_at` 포함
4. **인덱스**: 자주 조회되는 컬럼에 인덱스 생성
5. **JSONB**: PostgreSQL의 JSONB 타입 활용 (자막 버전, 메타데이터 등)
6. **외래키 제약조건**: 데이터 무결성 보장

---

**작성일**: 2025년 1월  
**기준 문서**: SYSTEM_OVERVIEW.md, LocalStorage 키 분석

