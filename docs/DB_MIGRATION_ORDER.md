# 운영 DB 적용 순서 (지시서 015) — 적용은 현배가. Claude Code 는 운영 DB 에 접속하지 않았다.
모든 SQL 은 Supabase 대시보드 → SQL Editor 에서 실행한다. 모두 여러 번 실행해도 안전(멱등). 점검·확인 파일은 읽기만 한다.

| 순서 | 할 일 | 파일 | 통과 기준 |
|---|---|---|---|
| 0 | 백업(대시보드 Database → Backups, 또는 `progress` 표 내보내기) | — | 백업 시각 기록 |
| 1 | 1단계 전 점검 → 결과 저장 | `supabase/ops/precheck_1.sql` | 오류 없음. `rows_with_data_role`·`rows_currency_not_number`·`rows_*_over_*` 숫자 확인(0 아니어도 진행 가능 — 2단계 가드가 처리) |
| 2 | **1단계 적용** | `supabase/migrations/20261120_1_additive.sql` | 오류 없음 |
| 3 | 1단계 확인 | `supabase/ops/verify_1.sql` | 전부 `true` (`still_direct_update_for_old_client` 도 true = 옛 클라이언트 아직 동작) |
| 4 | master 지정(선택) | `supabase/ops/grant_master.sql` | 이메일·created_at 을 보고 내 계정일 때만 주석 풀어 실행 |
| 4.5 | 배포 전 번들 점검: `npm run build` 뒤 `node scripts/check-prod-bundle.mjs dist` 가 **PASS**(QA 경로·`?qa=1`·비밀값 0건, RD-T054) | 게임 저장소 | FAIL 이면 배포하지 않는다 |
| 5 | **새 클라이언트 배포**(develop → stage 확인 → main) | 게임 저장소 | 새 클라이언트로 로그인·저장·불러오기 확인 |
| 6 | 옛 클라이언트가 빠질 시간 두기(열린 탭 새로고침 — 하루 정도) | — | `precheck_2.sql` 의 `rows_saved_since_stage1` 증가 |
| 7 | 2단계 전 점검 | `supabase/ops/precheck_2.sql` | 1단계 객체 true, master 목록 확인 |
| 8 | **2단계 적용** | `supabase/migrations/20261120_2_restrict.sql` | 오류 없음 |
| 9 | 2단계 확인 | `supabase/ops/verify_2.sql` | 전부 `true` |

## 되돌리기
- 2단계 문제(저장 실패 등): `supabase/ops/rollback_2.sql` → 직접 쓰기 다시 열림·재화 검사 꺼짐. 1단계 것은 남아 새 클라이언트는 그대로 동작.
- 1단계까지 되돌리기: `rollback_2.sql` → `rollback_1.sql`. revision·한도 통·player_roles 가 지워진다(게임 진행 data 는 그대로). **새 클라이언트가 배포돼 있으면 save_progress 가 없어져 저장이 실패**하므로 옛 클라이언트로 먼저 되돌린다.
- 014 의 `20261119_qa_rls_fix.sql` 은 운영에 적용된 적이 없고 이 두 파일로 대체됐다(git 이력에는 남음).

## 시험 (격리 Postgres, kind ai-lab / qa-rls)
`results/QA-RLS/hardening-tests.py`: 빈 DB · 014 적용 DB · 운영과 비슷한 옛 줄 DB 각각에서 1단계(2회) → 옛·새 클라이언트 → 2단계(2회) → 재화 시도 → 롤백 2·1 → 재적용. PostgREST·GoTrue(실제 로그인)는 흉내(psql + JWT claim).
