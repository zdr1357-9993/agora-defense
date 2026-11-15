# 2026-11-15 문답과 도트 여정 지도

## 요청
사유의 초대를 문답으로 변경. RPG 메이커/고전2D 전략게임처럼 이미지 지도, 거점 간판, 전진 카메라 구성.

## 변경
- index.html, src/main.ts: 영입 명칭 문답.
- src/journey-map.ts, src/journey-map.css: 이미지 번호간판, 길을 따라 위로 배치한 거점, 선택시 카메라 스크롤, 캐릭터 이동, reduced-motion.
- public/journey/greek-tile-map.png: 이번 요청으로 생성한 고대 그리스5거점 세로 지도. 원본 generated_images/exec-50f38702-e367-4f0d-ae24-c35dc6f64fbf.png 보존. 첨부 참고의 UI·인물·배치를 복사하지 않고 독자 구성.
- 고대5거점은 새 지도 사용, 나머지 시대는 기존 시대별 이미지 유지. 모든 시대 새 배경 완료로 보고하지 않음. 실제 거점 이름은 읽기/접근성 위해 DOM 유지.

## 반영 상태
공유 stage 파일 수정 완료. 빌드/로컬서버 반영/push/Pages배포는 미확인. 서버 Codex 실험 작업과 동시 진행하므로 이 파일과 소스를 읽은 후 병합·검증 필요.

## 실험 점검
2026-11-15 09:14 KST 확인 당시 rd-current-features-20261115-001314Z는6판 smoke. S1 normal starter power 군별2판, 강화횟수0. 본실험8640판 완료로 해석하지 않음. 서버 Codex는 표열매핑/강화지출정책 수정 후 본실험 실행 예정이라고 응답.
