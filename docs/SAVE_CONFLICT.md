# 저장이 두 곳일 때 누가 이기는가 (기준 문서) — RD-S012, 2026-11-19
저장 위치: ① 이 기기 localStorage(`agora_save_*`) ② 서버 `progress` 줄(계정당 1줄). 기준 C-DB-6(현배 2026-11-18 12:45): **충돌하면 DB 값이 우선**.

## 규칙
1. **승자는 기기 시계가 아니라 서버 `revision`(저장 때마다 서버가 +1)으로 정한다.** `savedAt`·`Date.now()`·`updated_at` 은 승패에 쓰지 않는다.
2. 각 기기는 "마지막으로 서버와 맞춘 revision"(localStorage `agora_cloud_rev:<userId>`)을 기억한다. 저장 요청(`save_progress`)에 이 번호를 `base_revision` 으로 싣는다.
3. 서버는 `base_revision` 이 지금 revision 과 같을 때만 쓴다(성공하면 revision+1). 다르면 **쓰지 않고 `conflict`** 를 돌려주고, 클라이언트는 서버 값을 불러와 이 기기 저장을 덮는다.
4. 로그인 때(`src/syncrule.ts` `decideSync`): 서버 줄 없음 → 내 것 올림 / 이 기기가 처음 → 서버 것 / 맞춘 기록 없음 → 서버 것 / 서버 revision == 내가 아는 revision → 내 것 올림 / 다르면 → 서버 것.
5. 값 검사·role·재화 상한은 서버(`supabase/migrations/20261119_qa_rls_fix.sql`)가 강제한다. 클라이언트의 role 판정은 표시용.

## 알려진 한계 (일부러 두었거나 모름)
- 서버가 이겨서 덮이는 쪽의 **저장 안 된 로컬 진행은 사라진다**(기준이 "DB 우선"이므로). 병합은 하지 않는다.
- 업데이트 직후 처음 로그인하는 기기는 맞춘 기록이 없어 서버 값을 쓴다.
- 같은 계정을 두 탭에서 동시에 쓰면 먼저 저장한 쪽이 이기고 나중 탭은 서버 값으로 맞춰진다.
