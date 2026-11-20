-- 2단계(제한) — RD-T051 / 지시서 015. **새 클라이언트(save_progress 로 저장)를 배포한 뒤에** 적용한다. 옛 클라이언트는 이후 저장이 막힌다.
-- 순서: supabase/ops/precheck_2.sql → 이 파일 → supabase/ops/verify_2.sql. 되돌리기: supabase/ops/rollback_2.sql. 여러 번 실행해도 안전.

-- 1) 직접 쓰기 회수 (읽기는 그대로). 저장은 save_progress() 로만.
revoke insert, update, delete on public.progress from public, anon, authenticated;
grant select on public.progress to authenticated;

-- 2) 재화 검사 켜기. BEFORE 트리거는 이름순으로 돈다: progress_guard → progress_revision
drop trigger if exists progress_guard on public.progress;
create trigger progress_guard before insert or update on public.progress
  for each row execute function public.progress_guard();
