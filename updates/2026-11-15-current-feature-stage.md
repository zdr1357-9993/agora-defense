# 2026-11-15 stage 현재 기능·장별 난이도 실험

- 기록 시각(Asia/Seoul): 2026-11-15 09:38 KST, 탐색 완료·holdout 진행·완전해금 실험 대기
- 담당 / 요청 근거: Codex / `ops/flow-qa/CURRENT_FEATURES_CHAPTER_REQUEST.md`
- 상태: 검증 · 탐색 완료 · 독립 holdout 진행 중 · 완전해금 도구 준비

## 요청과 범위

공개 HTTPS stage 최신화를 확인하고 영감석·초대 영입 변경을 적용한다. 현행 stage 게임 소스를 직접 사용하는 시뮬레이터로 강화·영입·조합 및 장별 난이도 비교를 실행한다.

## 변경 파일 및 동작

| 항목 | 이전 | 이후 |
|---|---|---|
| 영감석 지급 | 일반 처치마다 1, 보스 10 | 일반 누적 10처치마다 1(웨이브 간 이월), 보스 1(일반 카운터 제외) |
| 영입 가격 | 40/50/60 | 공통 `RECRUIT_BANDS` 4/5/6 |
| 영입 명칭 | 논박 영입 | 사유의 초대 |
| 재화 표시 | 판 재화/유료 지혜석 모두 다이아 표시 | 전투 영감석 전용 아이콘으로 분리 |
| 처치 FX | 모든 처치에서 보석 표시 | 실제 지급 시에만 영감 표시 |
| 장별 이동 | 기존 이동 | 이번 작업에서는 구현하지 않고 후속 항목으로 기록 |

초대 아이콘은 직접 작성한 32×32 SVG 픽셀 아트이며 버튼에서 20×20 CSS 픽셀로 보인다. 외부 에셋을 쓰지 않았다.

## 소스

- 저장소 / worktree: 공개 `https://github.com/zdr1357-9993/agora-defense` / `projects/random-defense/agora-defense-envs/stage`
- 브랜치 / 기준 SHA / 변경 커밋: `stage` / 최신 원격 `b4cac5d59b4cc302e1b557734606b4674cd7434c` / 기능 `6ab895fede49e5145fada202d9b1fa5642cdbe52`, 장 이동 수정을 분리하고 요청서 명칭으로 복귀 `565110ef27dc6b5576b37f2c8ebee54f5b6455e5`, holdout 러너 `626a93e152455d80bde512c711412f9b86b45f96`, 완전해금 별도 runner는 별도 커밋 예정. Push하지 않음.
- 미커밋 변경·데이터 해시: 탐색 launch manifest `sourceSHA=739b9745a2cd70bcd1cb23a89a69343182ae641696b76a3d462679220d3b9301`; holdout manifest `sourceSHA=3f7bd05b578500cb99b767197b4bfd8e42f2a3c07a2f4b85812a41a6374fb826`. 각 파일·data SHA를 manifest에 보관. 두 실행 모두 source hashes를 기록.

## 검증과 반영 상태

- 코드 검증 / 결과: 정리 후 `npm run build:stage` 성공. `node qa/check-current-mechanics.cjs`에서 일반 10:1/보스 1/이월, 가격표 4·5·6, 잠금·재화 부족·만석 무차감, 세 강화 구간, 같은 seed 재현을 확인. `--smoke`, `--smoke-target` 완료.
- 로컬 빌드: `dist-stage` 갱신 완료.
- 로컬 서버 재시작 / URL: 하지 않음, 빌드 산출물만 갱신.
- 원격 push / SHA: 하지 않음.
- Pages 배포 / 실행 URL·워크플로: 하지 않음.

## 게임 실험

- 준비 / 실제 실행 / 완료 상태: 탐색 실험 8 worker/nice 10, 8,640 / 8,640 완료. 현행 stage `Game`, data, `RECIPES`, `Game.upgradeBand`, `Game.recruit` 직접 import.
- 실제 소스·설정·정책·시드·예정 판수: 완료된 탐색은 6맵×4난이도×3군×2성장×2정책×30 paired seed. 시작 골드 220, story=false, 일반 30웨이브. 쉬움/보통 목표는 요청값, 어려움/불멸 목표는 미정. 분기 뒤 난수 소비는 군별로 달라질 수 있음.
- PID / 시작 시각 / 완료 판수: PID 2(실행 namespace 기준), 2026-11-15 09:23:32 KST 시작, 09:26:45 KST 종료. 첫 확인 335판. 8,640 완료, 오류 없음.
- 결과 / 로그 / 상태 파일: 탐색 `/mnt/d/AI-DECK/ai-deck/results/rd-current-features-20261115-002332Z/`; holdout `/mnt/d/AI-DECK/ai-deck/results/rd-current-features-holdout-20261115-003353Z/`. 탐색에는 `manifest.json`, `raw.jsonl`, `summary.json`, `summary.md`, `chapter-summary.md`, `philosopher-reach.json`, worker JSONL, `run.log`. 상태 `/mnt/d/AI-DECK/ai-deck/status/tasks/rd-current-features.json`. Holdout 상태 `/mnt/d/AI-DECK/ai-deck/status/tasks/rd-current-features-holdout.json`.
- 결과와 해석의 한계: 288셀 각각 30판, paired seed 2,880묶음, 중복/누락 0. 실행 중 source hash 변화 없음. 30 seed는 탐색 표본이며 목표별 도달 관측도 조건당 30판뿐이다. 쉬움·보통 중 upgrade+recruit Wilson 95% 구간이 목표를 포함한 23조건을 골라 300 seed/조건, 세 군 paired holdout 진행 중이다. 현재 6,577/20,700판, 오류 없음. 완전해금 도달은 잠금 계정과 별도 9,600판/100seed 도구를 준비했다. story 사건/20웨이브 결과와 혼합하지 않으며 어려움/불멸 목표를 임의 확정하지 않는다.

### 탐색 결과 요약

| 난이도 | baseline | 강화만 | 강화+영입 |
|---|---:|---:|---:|
| 쉬움 | 634/720 (88.1%) | 574/720 (79.7%) | 687/720 (95.4%) |
| 보통 | 146/720 (20.3%) | 106/720 (14.7%) | 482/720 (66.9%) |
| 어려움 | 3/720 (0.4%) | 0/720 (0.0%) | 111/720 (15.4%) |
| 불멸 | 0/720 (0.0%) | 0/720 (0.0%) | 4/720 (0.6%) |

전체 paired 비교에서 강화+영입은 baseline보다 +17.4pp (95% CI +15.9~+19.0pp), 강화만은 -3.6pp (95% CI -4.7~-2.4pp)였다. 30판 탐색값이므로 추천/확정 결론이 아니다. 장·난이도별 120판 집계와 95% CI는 `chapter-summary.md`, 철학자별 도달/시점은 `philosopher-reach.json`을 참조한다.

## 남은 작업

- 실행 종료 후 균형 셀, paired 승패, 목표별 도달 시점·원재료 부족을 확인해 기록을 갱신한다.
- 23개 후보 조건의 독립 300 seed holdout 완료 후, 장별 결과와 목표 도달률을 평가한다.
- holdout 완료 후 완전해금 도달 9,600판을 현재 계정 잠금 승률과 별도 실행·보고한다.
- 장 이동 UX는 별도 작업으로 유지한다.

## 상태 이력

- 2026-11-15 09:23–09:26 KST: 탐색 8,640판 완료.
- 2026-11-15 09:33 KST: 23개 조건 holdout(20,700판) 시작, 최초 상태 확인 122판 완료.
- 2026-11-15 09:38 KST: holdout 6,577/20,700 확인. 완전해금 100 seed 셀 러너 syntax 확인.
