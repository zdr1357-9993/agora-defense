// CSS의 touch-action: manipulation으로 두 번 탭 확대만 막는다.
// touchend에서 click을 합성하면 스크롤 끝이나 다른 버튼 탭도 실행되므로
// 버튼·캔버스 모두 브라우저의 원래 입력 이벤트를 그대로 사용한다.
export {};
