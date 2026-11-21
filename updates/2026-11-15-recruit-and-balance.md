# 2026-11-15 영입 수정과 난이도 실험

## 확인 근거
2026-11-15 09:08 KST AI-DECK 워크스페이스에서 서버 Codex 응답 확인.
- 최신 원격 stage b4cac5d까지 fast-forward 완료했다고 응답.
- 실제 stage 소스에서 일반 처치당1/보스10을 일반 누적10처치당1/보스1로 수정 중이라고 응답.
- 영입비용·명칭·패널 제목·픽셀 초대장도 반영 중이라고 응답.
- 최신 변경 커밋·빌드·서버 재시작·push·Pages 배포·대량 게임실험 PID는 아직 미확인.

## 요청 수치
| 항목 | 이전 stage | 요청 |
|---|---|---|
| 일반 적 영감석 | 매 처치1 | 누적10처치당1, 웨이브 간 이월 |
| 보스 영감석 | 10 | 1, 일반 카운터 제외 |
| 영입비용 | 40/50/60 | 4/5/6 |
| 명칭 | 논박 영입 | 사유의 초대(제안), 최종 구현 확인 필요 |

## 경로와 범위
- 서버 stage worktree: /mnt/d/AI-DECK/ai-deck/projects/random-defense/agora-defense-envs/stage
- 맥 공유 경로: /Volumes/ai-deck/projects/random-defense/agora-defense-envs/stage
- 실행 요청서: AI-DECK 루트 ops/flow-qa/CURRENT_FEATURES_CHAPTER_REQUEST.md
- 실험 상태 예정 경로: AI-DECK 루트 status/tasks/rd-current-features.json (최신 상태는 실제 파일·로그로 확인)
- GitHub 미리보기: https://zdr1357-9993.github.io/agora-defense/stage/

## 실험 기준
현행 Game·구간강화·새 영입 기준. 쉬움 장별95/90/85/85/80/80%, 보통90/86/82/78/74/70%(중간값은 제안). 어려움·불멸 목표 미확정. 준비/실제 실행/완료를 구분한다.

## 남은 작업
- 구현·검증·실험 시작 증거와 정확한 SHA를 이 기록에 추가.
- 기존 GitHub Pages와 새 로컬 수정 버전을 혼동하지 않도록 각 반영 상태 기입.
- 장별 이동 UI는 후속 작업.

## 상태 이력
- 2026-11-15 09:08 KST: 브라우저로 위 응답 확인, 기록 폴더 생성. 추가 Codex 메시지는 작업 중으로 거절되어 전달되지 않음. 문서는 공유 stage 폴더에 직접 작성.
- 2026-11-15: Codex가 공개 HTTPS `origin/stage`를 fetch해 최신이 기준 SHA b4cac5d59b4cc302e1b557734606b4674cd7434c임을 확인하고 clean stage worktree를 fast-forward함. main/develop, push, Pages/운영 배포는 수정하지 않음.
- 구현: 일반 적 10번째 누적 처치마다 영감석 1, 보스는 일반 누적에서 제외하고 1 지급. 영입 가격을 공통 `RECRUIT_BANDS` 4/5/6으로, 명칭을 `사유의 초대`로 변경. 영감석 아이콘과 책에서 초대장이 펼쳐지는 20px 픽셀 SVG 추가. 지혜석과 구별하고 지급되지 않은 처치 FX의 영감 표시를 감춤.
- 검증: `npm run build:stage` 성공, `node qa/check-current-mechanics.cjs`에서 10:1 누적/보스 독립/누적 이월/영입 가격/재화 부족·만석 무차감 확인, 6판 smoke 정상 완료. 실제 Game을 직접 import하는 실험 러너·manifest/hash·Wilson 요약·철학자별 도달률 내보내기 구성.
- 후속: 장 이동 애니메이션 요구를 `docs/FOLLOWUP_CHAPTER_TRANSITIONS.md`에 기록. 8640판 본 실험 및 PID/완료판수 증거는 실행 후 이어서 기록한다. 승률 목표는 쉬움/보통만 지정하고 어려움/불멸은 관측치로 취급한다.
