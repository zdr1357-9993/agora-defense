# main.ts 분할 설계 (RD-T001, 코드 수정 없음)
작성 2026-11-15 · 대상: stage worktree `src/main.ts`(2413줄) · 근거: 아래 표는 `main.ts` 최상위 `let`/`const` 선언과 구역(주석 머리) 사이 참조를 기계적으로 센 결과.

## 1. 현재 구역 (줄 번호)
화면전환 77 · 홈 96 · 도감 130 · 전투 246 · 그리기 584 · 시대배경 875 · 장착 1059 · 허브탭 1070 · 고민방 1091 · 뽑기 1142 · 상점 1263 · 조합표·확률표 1301 · 타격감 1378 · 루프 1627 · 모바일 1648 · 시작 1663 · 서버동기화 1735 · TCG 1815 · 전투튜토 1872 · 화면튜토 1905 · 스토리 1965 · 설정 2237 · 결과 2257 · 레이드 2308 · 할일 2334 · 회원가입 2372. 헤더(import~76)에 공유 객체가 모여 있음.

## 2. 공유 상태 (여러 구역이 읽고 쓰는 것)
| 이름 | 줄 | 쓰는 구역 수 | 비고 |
|---|---:|---:|---|
| `$` (DOM 도우미) | 28 | 25(전부) | 순수 함수 → `ui/dom.ts` 로 가장 먼저 분리 |
| `progress` | 70 | 23 | 저장 데이터. 모든 화면이 읽고 씀 → `state/progress.ts` 단일 모듈(읽기 함수 + 변경 함수), 저장·동기화는 여기서만 |
| `game`(전투 인스턴스) | 249 | 10 | 전투·그리기·루프·튜토·조합표·타격감·스토리·레이드 → `battle/session.ts` 의 `getGame()/setGame()` |
| `canvas`·`ctx`·`cell`·`tick`·`introT`·`speed` | 247~255 | 5~6 | 전투 렌더 상태 → `battle/render-state.ts` |
| `me`(로그인 사용자) | 71 | 7 | `state/account.ts` |
| `diffId`·`modernUnlocked`·`isAdmin` | 72~84 | 4~5 | `state/progress.ts` 에 포함하거나 `state/flags.ts` |
| 타격감(`shake`·`shakeStrength`·`hitStop`·`banner`·`bossIntro`·`bossFlash`) | 1390~1396 | 2~4 | 연출 전용 → `battle/fx.ts` 가 소유, 외부는 함수(`shake()` 등)로만 접근 |
| `currentTab` | 1071 | 3 | `hub/tabs.ts` |
| 튜토 상태(`tutStep`·`pageTut`) | 1883·1934 | 2~3 | `tutorial/` |
| 스토리 상태(`storyChapter`·`journey*`·`pendingNextStory`·`meUrl`) | 385·2014~2173 | 2~3 | `story/` |
| 한 구역 전용 let(`codexTier`·`roomThinker`·`skinShopId`·`recipeQuery`·`lastEra`·`uiTimer`·…) | — | 1 | 해당 모듈 안으로 그냥 이동 |

## 3. 제안 모듈과 의존 방향 (순환 금지: 위가 아래를 부른다)
```
main.ts (조립·시작)         ← 최상위. 모듈 초기화·이벤트 연결만
 ├─ screens/  home · codex · hub(room · gacha · shop · recipes) · settings · result · raid · daily · signup · tcg
 ├─ story/    story · story-ui
 ├─ tutorial/ battle-tutorial · page-tutorial
 ├─ battle/   session(game) · draw · era-backdrop · fx · loop · equip
 ├─ sync/     cloud-sync
 ├─ state/    progress · account · flags
 └─ ui/       dom ($) · mobile · sprites(spriteFor·portrait·spriteUrl)
```
- 규칙: `ui` ← `state` ← (`battle`, `sync`) ← (`screens`, `story`, `tutorial`) ← `main`. 아래층은 위층을 import 하지 않는다.
- 위→아래 호출이 막히는 곳(예: `battle` 이 결과 화면을 열어야 함)은 **콜백 등록**(`onResult(fn)`)으로 풀어 순환을 피한다. 지금 순환 후보: 전투→결과(`resultShown`), 전투→스토리 다음(`pendingNextStory`), 설정→스토리(`replayTutorial`, `storyChapter`), 서버동기화→전투튜토(`tutStep`).

## 4. 옮기는 순서 (의존이 적은 것부터, 단계마다 빌드·QA·1커밋)
1. `ui/dom.ts`(`$`) · `ui/sprites.ts` — 순수 함수, 영향 0.
2. 단독 화면: 회원가입 · 오늘의 할 일 · 레이드 · 설정 시트 · 모바일 보정 (읽는 상태가 `progress`·`me` 정도).
3. `state/progress.ts` · `state/account.ts` — `progress` 접근을 함수로 감싼다(대규모 치환 → 이 단계는 한 번에 하지 말고 화면 모듈마다 점진).
4. 허브: 고민방 · 상점 · 조합표 · 뽑기 · 도감 · 홈 · 장착.
5. 튜토리얼 2개 · 서버 동기화 · TCG.
6. 스토리 (전투와 얽힘, 콜백 필요).
7. 전투: `session` → `fx` → `draw`·`era-backdrop` → `loop`. 가장 마지막(전역 상태가 가장 많고 렌더 루프 성능 민감).
- 단계마다: `tsc --noEmit` + `npm run build:stage` + 폰 캡처 비교(RD-T003) + 전후 번들 크기 기록.

## 5. 위험·미해결
- `game`(전투 인스턴스)을 모듈 밖으로 빼면 렌더 루프에서 접근 비용이 생길 수 있음 → `getGame()` 대신 렌더 모듈이 참조를 캐시.
- `progress` 를 직접 고치는 코드가 많음(23구역) → 변경 함수로 막을지, 단계적 허용 목록으로 갈지 결정 필요.
- 검증은 동작 동일성(캡처·QA 시뮬 결과) 비교가 기준. 코드 수정은 이 문서 확정 뒤 RD-T002 에서.
