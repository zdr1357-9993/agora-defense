# 2026-11-15 stage 현재 기능·장별 난이도 실험

- 기록 시각(Asia/Seoul): 2026-11-15 09:52 KST, 세 실험 완료
- 담당 / 요청 근거: Codex / `ops/flow-qa/CURRENT_FEATURES_CHAPTER_REQUEST.md`
- 상태: 검증 · 탐색·holdout·완전해금 실험 완료

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
- 브랜치 / 기준 SHA / 변경 커밋: `stage` / 최신 원격 `b4cac5d59b4cc302e1b557734606b4674cd7434c` / 기능 `6ab895fede49e5145fada202d9b1fa5642cdbe52`, 장 이동 수정을 분리하고 요청서 명칭으로 복귀 `565110ef27dc6b5576b37f2c8ebee54f5b6455e5`, holdout 러너 `626a93e152455d80bde512c711412f9b86b45f96`, 완전해금 도달 도구 `d818b3724d6ca5ead0935630324257f1f210e958`, 이번 실험 기록 `478e08fc6b394db8e6396d049dc737984b3a9530`. Push하지 않음.
- 미커밋 변경·데이터 해시: 탐색 manifest `sourceSHA=739b9745a2cd70bcd1cb23a89a69343182ae641696b76a3d462679220d3b9301`; holdout `sourceSHA=3f7bd05b578500cb99b767197b4bfd8e42f2a3c07a2f4b85812a41a6374fb826`; 완전해금 `sourceSHA=d26019b7866908bef32d41e5d617b798970a509be9ff53ccffdbc56bfc4be2a6` (`launcherHash=88196cbf5ca2f8c6b62404d7cb00ad5118b9472324d5ae25d2e16a4183c96e43`). 각 파일·data SHA를 manifest에 보관하고 source hash 일치 확인.

## 검증과 반영 상태

- 코드 검증 / 결과: 정리 후 `npm run build:stage` 성공. `node qa/check-current-mechanics.cjs`에서 일반 10:1/보스 1/이월, 가격표 4·5·6, 잠금·재화 부족·만석 무차감, 세 강화 구간, 같은 seed 재현을 확인. `--smoke`, `--smoke-target` 완료.
- 로컬 빌드: `dist-stage` 갱신 완료.
- 로컬 서버 재시작 / URL: 하지 않음, 빌드 산출물만 갱신.
- 원격 push / SHA: 하지 않음.
- Pages 배포 / 실행 URL·워크플로: 하지 않음.

## 게임 실험

- 준비 / 실제 실행 / 완료 상태: 탐색·holdout·완전해금 세 실행 모두 8 worker/nice 10으로 완료. 현행 stage `Game`, data, `RECIPES`, `Game.upgradeBand`, `Game.recruit` 직접 import.
- 실제 소스·설정·정책·시드·예정 판수: 완료된 탐색은 6맵×4난이도×3군×2성장×2정책×30 paired seed. 시작 골드 220, story=false, 일반 30웨이브. 쉬움/보통 목표는 요청값, 어려움/불멸 목표는 미정. 분기 뒤 난수 소비는 군별로 달라질 수 있음.
- PID / 시작 시각 / 완료 판수: PID 2(실행 namespace 기준), 2026-11-15 09:23:32 KST 시작, 09:26:45 KST 종료. 첫 확인 335판. 8,640 완료, 오류 없음.
- 결과 / 로그 / 상태 파일: 탐색 `/mnt/d/AI-DECK/ai-deck/results/rd-current-features-20261115-002332Z/`; holdout `/mnt/d/AI-DECK/ai-deck/results/rd-current-features-holdout-20261115-003353Z/`; 완전해금 `/mnt/d/AI-DECK/ai-deck/results/rd-current-features-unlocked-20261115-004718Z/`. 각 실행에 manifest/raw/summary/log 및 철학자 도달 보고서를 별도 저장. 상태 파일은 `status/tasks/rd-current-features{,-holdout,-unlocked}.json`.
- 결과와 해석의 한계: 탐색 288셀×30판/2,880 paired seed, holdout 69셀×300판/6,900 paired seed, 완전해금 96셀×100판/4,800 paired seed. 세 실행 모두 누락·중복·비정상 결과 0, source hash 변화 없음. 23개 후보 holdout에서 upgrade+recruit Wilson 구간이 목표보다 높은 셀 15, 낮은 셀 4, 겹치는 셀 4. 목표 미달 4셀은 S1 normal starter/power (75.3% vs 90), S3 normal starter/power (69.7% vs 82), S4 normal starter/power (68.7% vs 78), S2 easy starter/target (86.3% vs 90). 어려움/불멸 목표는 미정이며 수치를 자동 조정하지 않는다. 모든 실험은 일반 30웨이브이며 story 사건/20웨이브와 섞지 않는다.

### 탐색 결과 요약

| 난이도 | baseline | 강화만 | 강화+영입 |
|---|---:|---:|---:|
| 쉬움 | 634/720 (88.1%) | 574/720 (79.7%) | 687/720 (95.4%) |
| 보통 | 146/720 (20.3%) | 106/720 (14.7%) | 482/720 (66.9%) |
| 어려움 | 3/720 (0.4%) | 0/720 (0.0%) | 111/720 (15.4%) |
| 불멸 | 0/720 (0.0%) | 0/720 (0.0%) | 4/720 (0.6%) |

전체 paired 비교에서 강화+영입은 baseline보다 +17.4pp (95% CI +15.9~+19.0pp), 강화만은 -3.6pp (95% CI -4.7~-2.4pp)였다. 독립 holdout의 두 군 paired 승률 차이는 +29.9pp (95% CI +28.7~+31.1pp), 강화만은 -10.2pp (95% CI -11.4~-9.0pp)였다. 완전해금 별도 실험에서 baseline 대비 강화+영입 차이는 +22.5pp (95% CI +21.3~+23.7pp). 표본 조건에 한정된 측정값이며 공개 난이도를 자동 수정하지 않는다. 장·난이도 집계는 `chapter-summary.md`, 목표별 30/300/100 seed 도달·시점은 각 폴더의 `philosopher-reach.json`을 참조한다.

## 남은 작업

- 실행 종료 후 균형 셀, paired 승패, 목표별 도달 시점·원재료 부족을 확인해 기록을 갱신한다.
- 23개 후보 조건의 독립 300 seed holdout 완료 후, 장별 결과와 목표 도달률을 평가한다.
- 쉬움·보통 목표에 대한 난이도 후보를 별도 검토하고, 어려움·불멸 목표는 사용자 기준이 정해지기 전 관측값으로만 보존한다.
- 장 이동 UX는 별도 작업으로 유지한다.

## 상태 이력

- 2026-11-15 09:23–09:26 KST: 탐색 8,640판 완료.
- 2026-11-15 09:33 KST: 23개 조건 holdout(20,700판) 시작, 최초 상태 확인 122판 완료.
- 2026-11-15 09:46 KST: holdout 20,700 / 20,700 완료; 균형·source hash 검증 통과.
- 2026-11-15 09:47–09:51 KST: 완전해금 도달 9,600 / 9,600 완료, 96셀·4,800 paired seed·59 철학자 reach 집계 검증.
