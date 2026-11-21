# 2026-11-21 develop 에서 여정 UX·RPG 필드 되돌림

- 기록 시각(Asia/Seoul): 2026-11-21
- 담당 / 요청 근거: Claude Code / 현배 결정(운영에 올릴 stage 에서 RPG 필드(RD-T021)와 여정 UX 가 빠져야 함, 판단 J038·J039 → develop 에서 먼저 되돌림, 티켓 RD-T058)
- 상태: 로컬 커밋·검증 완료 · push·PR 전

## 요청과 범위

기준은 "여정 UX(d585a30) 들어오기 전의 화면·동작". 최신 커밋부터 3acb03d(RPG 필드) → d585a30(여정 UX 재구성)을 되돌렸다. RD-T038 이후 구조(screens/·state/·ui/ 분리)는 유지하고 동작만 현재 구조에 복원했다.

## 변경 파일 및 동작
| 항목 | 이전(되돌리기 전 develop) | 이후 |
|---|---|---|
| 여정 화면 | RPG 필드(?field=0 이면 긴 DOM 지도), 난이도 한 버튼 | d585a30 이전의 장별 지도 + 장 탭, 난이도 탭 줄(쉬움 완료 뒤) |
| 홈 버튼 | 오늘의 할 일·보스 레이드 숨김 | 시작 튜토리얼(A5) 뒤 다시 표시 |
| 본편 웨이브 | 30 | 20(튜토리얼 3~5웨이브 그대로) |
| 영입 이름 | 문답 | 사유의 초대 |
| 쉬움 완료 판정 | P20 단독 불인정 | P20 단독 인정(원래대로) |
| 파일 | src/field/ 6개, journey-map.ts/css, public/journey/greek-tile-map.png, docs/POST_UX_CONTENT_PLAN.md, pastel-assets.css 긴 지도 규칙 | 삭제 |

## 소스
- 저장소 / worktree: projects/random-defense/agora-defense (별도 worktree)
- 브랜치 / 기준 SHA / 변경 커밋: `rd/revert-journey-ux` / origin/develop 753ed7e / 필드 되돌림·여정 UX 되돌림 각 1커밋 + 이 기록
- 이 문서와 2026-11-15-journey-ux.md 는 되돌리지 않았다(위 '작성 규칙 5': 과거 사실을 덮어쓰지 않고 상태 전환을 추가). 본문의 `docs/POST_UX_CONTENT_PLAN.md` 링크는 이제 끊어짐(삭제됨, 보존 브랜치 parked/journey-ux 에 있음).
- 보존 브랜치(삭제하지 않음): parked/journey-ux · parked/rd-t021-field · parked/stage-uncommitted-20261120

## 검증과 반영 상태
- 코드 검증 / 결과: tsc 통과, npm test 통과, E2E smoke 12 통과(desktop·mobile)
- 로컬 빌드: npm run build 통과, 번들에서 greek-tile-map·journey-player·mountJourneyField·fieldEnabled·tilemap·walkPath 0건, check-prod-bundle PASS
- main 대비 화면: 같은 계정 상태로 홈·여정을 4개 크기에서 비교, 다른 픽셀 29~662(전부 가장자리 안티앨리어싱 수준, 차이 24 초과 5개 이하). 난이도 탭·스테이지 목록 화면은 0픽셀
- 원격 push / SHA: 없음 · Pages 배포: 없음

## 남은 작업
- 현배가 push → develop 로 PR. 되살릴 때는 parked/journey-ux, parked/rd-t021-field 에서 가져온다(RD-T021·T056·T057 은 백로그).

## 상태 이력

- 2026-11-21 KST: 위 되돌림 로컬 커밋·검증 완료. push 없음.
