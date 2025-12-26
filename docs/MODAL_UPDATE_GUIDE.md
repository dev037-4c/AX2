# 모달 카드 업데이트 가이드

모든 팝업 창을 깔끔한 카드 형태로 통일했습니다.

## ✅ 완료된 작업

1. **통합 모달 유틸리티 생성** (`js/modal-utils.js`)
   - `ModalUtils.alert()` - 알림 모달
   - `ModalUtils.confirm()` - 확인 모달
   - `ModalUtils.createModal()` - 커스텀 모달

2. **카드 스타일 CSS** (`css/modal-card.css`)
   - 깔끔한 카드 디자인
   - 반응형 지원
   - 애니메이션 효과

3. **자동 교체 스크립트** (`js/modal-replace.js`)
   - 기존 `alert()`와 `confirm()`을 자동으로 ModalUtils로 교체

4. **주요 파일 업데이트**
   - `index.html` - 모달 스타일 및 스크립트 추가
   - `script.js` - alert/confirm을 ModalUtils로 교체
   - `html/mypage.html` - 모달 스타일 및 스크립트 추가

## 📝 다른 HTML 파일에 추가하기

다른 HTML 파일들에도 모달을 사용하려면 다음을 추가하세요:

### 1. CSS 추가 (head 섹션)
```html
<link rel="stylesheet" href="../css/modal-card.css">
```

### 2. JavaScript 추가 (body 끝부분, 다른 스크립트 전에)
```html
<script src="../js/modal-utils.js"></script>
<script src="../js/modal-replace.js"></script>
```

## 🎨 사용 방법

### 기본 알림
```javascript
// 기존 방식 (자동으로 모달로 변환됨)
alert('메시지');

// 또는 직접 사용
ModalUtils.alert('메시지', '제목', { type: 'info' });
```

### 확인 다이얼로그
```javascript
// 기존 방식 (자동으로 모달로 변환됨)
if (confirm('정말 삭제하시겠습니까?')) {
    // 확인 클릭 시
}

// 또는 직접 사용 (async/await 필요)
const result = await ModalUtils.confirm(
    '정말 삭제하시겠습니까?',
    '확인',
    {
        confirmText: '삭제',
        cancelText: '취소',
        confirmType: 'danger'
    }
);
if (result) {
    // 확인 클릭 시
}
```

### 타입별 사용
```javascript
// 정보
ModalUtils.alert('정보 메시지', '알림', { type: 'info' });

// 성공
ModalUtils.alert('성공 메시지', '완료', { type: 'success' });

// 경고
ModalUtils.alert('경고 메시지', '경고', { type: 'warning' });

// 오류
ModalUtils.alert('오류 메시지', '오류', { type: 'error' });
```

## 🔧 커스텀 모달

더 복잡한 모달이 필요한 경우:

```javascript
ModalUtils.createModal({
    title: '제목',
    message: '메시지',
    type: 'info', // info, success, warning, error
    buttons: [
        {
            text: '취소',
            action: 'cancel',
            primary: false
        },
        {
            text: '확인',
            action: 'confirm',
            primary: true,
            type: 'primary' // primary, success, danger
        }
    ],
    onConfirm: () => {
        console.log('확인 클릭');
    },
    onCancel: () => {
        console.log('취소 클릭');
    },
    showCloseButton: true,
    closeOnBackdrop: true
});
```

## 📱 반응형

모달은 자동으로 반응형으로 동작합니다:
- 데스크톱: 중앙에 카드 형태로 표시
- 모바일: 하단에서 슬라이드 업 애니메이션

## 🎯 주요 특징

- ✅ 깔끔한 카드 디자인
- ✅ 부드러운 애니메이션
- ✅ 타입별 아이콘 및 색상
- ✅ ESC 키로 닫기
- ✅ 배경 클릭으로 닫기
- ✅ 반응형 디자인
- ✅ 접근성 고려

## 📋 체크리스트

다른 HTML 파일에 모달을 추가하려면:

- [ ] `css/modal-card.css` 링크 추가
- [ ] `js/modal-utils.js` 스크립트 추가
- [ ] `js/modal-replace.js` 스크립트 추가 (선택사항, 자동 교체 원하는 경우)

## 💡 참고사항

- `modal-replace.js`를 로드하면 기존 `alert()`와 `confirm()`이 자동으로 모달로 변환됩니다.
- 직접 제어하려면 `modal-replace.js`를 로드하지 않고 `ModalUtils`를 직접 사용하세요.
- `confirm()`을 사용하는 함수는 `async`로 만들어야 합니다 (Promise 반환).

