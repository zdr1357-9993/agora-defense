# 뽑기(Gacha) 서버 무결성 보완 설계 비교

작성일: 2026-11-20  
대상: `supabase/migrations/20261120_1_additive.sql` (`progress_guard`, `save_progress`), `src/meta.ts` (`drawCard`, `drawTool`, `pull`, `CARD_RATES`, `PITY_LIMIT`), `qa/check-gacha-rates.mjs` (A1)

---

## 1. 문제 요약

현재 뽑기(`pull`, `drawCard`, `drawTool`)는 브라우저(`src/meta.ts`, `src/screens/gacha.ts`)에서 실행되고, 서버(`save_progress` → `progress_guard`)는 재화 3종(`gonoe`, `gems`, `tickets`)의 **증가 한도**만 검사한다.

- 재화 3종을 한도 이상으로 올려 보내면 `progress_guard`가 잘라낸다.
- 그러나 `data.cards`, `data.items`, `data.pity` 는 검사하지 않으므로, 클라이언트가 재화를 깎지 않거나 조작한 상태에서 카드·도구 보유량을 임의로 늘려 저장해도 서버에 그대로 반영된다.
- 재현 시험: [`tests-proposed/gacha-hole/test-gacha-hole.mjs`](../tests-proposed/gacha-hole/test-gacha-hole.mjs)

---

## 2. 두 가지 대응 방안 비교

### (가) 서버 뽑기 RPC `draw_cards` (서버가 재화 차감 + 카드/도구 결정)

클라이언트는 뽑기 종류(`pull_id`: `c1`, `c10`, `c10g`, `m10`, `m1`, `t1`, `t10`, `t10g`)와 `base_revision`만 전달한다. 서버 RPC(`draw_cards` 또는 `pull_gacha`)가 `progress` 행을 `FOR UPDATE`로 잠그고, 재화 차감 → 시대/등급 필터 → 난수 추첨 → 천장(`pity`) 갱신 → `cards`/`items`/`seen` 반영 → 결과 목록 반환을 한 트랜잭션으로 처리한다. 동시에 `save_progress`에서는 `cards`/`items`/`pity`의 임의 증가를 막거나(또는 별도 서버 전용 컬럼/테이블로 분리) 서버 RPC만 갱신하도록 제한한다.

- **막는 범위**:
  - 재화 미차감/조작 상태에서 카드·도구 무한 생성 **완전 차단**.
  - `pity`(천장 60회) 조작, 확률 조작(클라이언트 `Math.random` 변조), 미해금 시대 고뇌 뽑기 우회 **완전 차단**.
  - 단, `gonoe`/`gems`/`tickets` 획득 자체는 여전히 `progress_guard`의 통(rate/bucket) 한도 모델에 의존하므로, "정상 한도 내에서 천천히 재화를 불려 뽑기"는 재화 원천(전투·방치·상점) 서버화 전까지 남는다.
- **확률 검정(A1) 이관 방법**:
  - 현재 [`qa/check-gacha-rates.mjs`](../qa/check-gacha-rates.mjs)는 Vite SSR로 `src/meta.ts`의 `drawCard(1, true)`를 불러 `Math.random`을 `mulberry32(seed)`로 바꿔 100,000회 표본이 `CARD_RATES`의 ±3 표준오차 이내인지 + 동일 시드 재현성을 검증한다.
  - `(가)`로 옮기면 확률 테이블과 추첨 로직이 Postgres PL/pgSQL(또는 Edge Function)로 이동한다.
  - **PL/pgSQL 구현 시**:
    1. 등급 확률표(`CARD_RATES`)와 철학자 풀(`id`, `tier`, `plus`, `era`, `hidden`)을 DB 테이블 또는 SQL 불변 함수로 둔다(빌드/마이그레이션 시 `src/data.ts`와 단일 원천 동기화 검증 스크립트 필요).
    2. `draw_card_pure(p_seed bigint, ...)` 또는 `setseed(double precision)` + `random()` 기반의 결정론적 래퍼를 두어, 로컬 Postgres 테스트에서 시드 고정 100,000회 호출 후 등급별 비율 ±3 표준오차 및 시드 재현성을 검증하도록 `qa/check-gacha-rates.mjs`(또는 DB A1 시험)를 확장한다.
    3. 참고: Postgres `setseed()`는 `[-1.0, 1.0]` 실수 시드이고 세션 상태에 의존하므로, 재현성 단위 테스트에서는 LCG/xorshift/pgcrypto 등 순수 함수 PRNG 또는 전용 테스트 세션에서 `setseed`를 사용한다. 운영 호출은 CSPRNG(`gen_random_bytes`)를 쓰는 것이 안전하다.
  - **클라이언트 UI 표시**: `src/screens/gacha.ts`의 확률 표시는 읽기 전용 표시 데이터로 유지하되, 서버 확률표와 불일치하지 않도록 CI에서 비교 검사를 둔다.
- **예상 작업량**:
  - DB/마이그레이션: 철학자 풀·확률표·아이템 풀 정의, `draw_cards` RPC, `save_progress`에서 `cards`/`items`/`pity` 직접 증가 차단 (또는 별도 열 분리) — **약 1.5~2.5일**.
  - 클라이언트(`src/meta.ts`, `src/screens/gacha.ts`, `src/cloud.ts`, `src/main.ts`): 오프라인/게스트 로컬 `pull` 유지 + 로그인 시 서버 `draw_cards` RPC 호출 및 `revision`/결과 동기화 — **약 1~1.5일**.
  - QA/검증: A1 확률 검정 DB 버전 이관, 동시 뽑기/재화 부족/충돌(`revision`) 통합 테스트 — **약 1일**.
  - **합계: 약 3.5~5일**.

---

### (나) 저장 시 정합성 검사 (카드 증가량 대비 최소 재화 감소량)

뽑기는 지금처럼 브라우저(`src/meta.ts`)에서 실행하고, `progress_guard()` 트리거에서 `old.data`와 `new.data`를 비교해 **카드 총량(`cards` 합계)과 도구 총량(`items` 합계)이 늘어난 경우, 그에 상응하는 최소 재화(`gonoe`/`gems`/`tickets`) 감소가 있었는지** 검사한다.

예시 기준(`src/meta.ts`):
- 카드 최소 단가: 10회 고뇌 뽑기 `1,800 / 10 = 180 고뇌/장` (단품 200), 지혜석 10회 `270 / 10 = 27 지혜석/장`, 거장 10회 `450 / 10 = 45 지혜석/장`, 초대장 `1장/회`.
- 도구 최소 단가: 10회 고뇌 뽑기 `1,350 / 10 = 135 고뇌/개`, 지혜석 10회 `300 / 10 = 30 지혜석/개`.
- 예외 처리 필요 항목: 스타터 지급(`T106: 1`), `cardXp` 1.0 도달 시 카드 +1장 지급, 레거시 마이그레이션(`idv2`).

- **막는 범위**:
  - 재화를 전혀 쓰지 않고 카드 30장을 공짜로 추가하는 단순 변조(이번 재현 시험 케이스)는 **차단 가능**.
  - **한계(못 막는 공격)**:
    1. **희귀도/등급 조작**: 고뇌 1,800만 쓰고도 클라이언트가 7성/거장 카드만 10장 골라 저장하는 것을 막지 못한다(총 장수만 맞으면 통과).
    2. **확률/천장 조작**: 클라이언트가 `Math.random`을 덮어쓰거나 `pity`를 조작해 매번 최고 등급만 뽑아 저장할 수 있다.
    3. **상쇄 우회**: 같은 3초 디바운스(`cloudSave`) 창 안에서 전투/방치로 재화를 얻은 뒤 뽑기를 하면 `new.gonoe - old.gonoe`가 양수(+)로 보여, "순증가"와 "소모 후 획득"을 구분하기 어렵다. `cardXp` 예외까지 허용하면 틈이 더 커진다.
- **확률 검정(A1) 이관 방법**:
  - 실제 뽑기 로직이 여전히 `src/meta.ts`에 있으므로 **A1(`qa/check-gacha-rates.mjs`)을 옮길 필요가 없다.** 기존 스크립트가 그대로 유효하다.
  - 대신 `progress_guard` 정합성 규칙(정상 10연차 저장 허용 / 무재화 카드 추가 거부 / `cardXp` 예외)에 대한 DB 보안 테스트를 추가한다.
- **예상 작업량**:
  - DB/마이그레이션: `progress_guard()`에 `cards`/`items` 증가량 계산 및 최소 소모량 검증 로직 추가, `cardXp` 등 비뽑기 획득 예외 처리 — **약 0.5~1일**.
  - 클라이언트: 변경 거의 없음(단, 디바운스 3초 안에 획득+소모가 겹칠 때 오탐 방지를 위해 뽑기 직전/직후 flush 조정 필요할 수 있음) — **약 0.5일**.
  - QA/검증: 경계값(10연차, 혼합 소모, `cardXp`, 첫 저장) 테스트 — **약 0.5일**.
  - **합계: 약 1.5~2일**.

---

## 3. 한눈에 비교

| 항목 | (가) 서버 뽑기 RPC `draw_cards` | (나) 저장 시 정합성 검사 |
|---|---|---|
| 무재화 카드 추가 차단 | 차단 | 차단 (획득+소모 겹침 시 오탐/우회 주의) |
| 등급·확률·천장 조작 차단 | **차단** (서버 난수·서버 천장) | **못 막음** (총 장수만 검사) |
| A1 확률 검정 이관 | **필요** (DB 측 확률표·PRNG 테스트 추가 + 클라/서버 표 동기화) | **불필요** (`qa/check-gacha-rates.mjs` 유지) |
| 클라이언트 구조 영향 | 뽑기 경로를 비동기 RPC로 변경, 오프라인 정책 정리 필요 | 최소 (`cloudSave` flush 타이밍 조정 정도) |
| 예상 작업량 | **3.5~5일** | **1.5~2일** |

## 4. 권장 방향

- **장기·본질 해결**이 목표라면 **(가) `draw_cards` RPC**가 맞다. 카드 게임에서 등급 확률과 천장이 클라이언트에 남아 있으면 `(나)`를 넣어도 "고뇌 1,800으로 7성만 10장 뽑기"를 막을 수 없다.
- 단, 당장 이번 마일스톤에서 `draw_cards`까지 갈 일정이 안 된다면, **(나)의 단순 상한/차감 검사를 임시 완화책**으로 먼저 붙이고 곧바로 `(가)`(및 `docs/ECONOMY_LIMITS.md`의 단계 B)로 넘어가는 2단계를 고려할 수 있다.
