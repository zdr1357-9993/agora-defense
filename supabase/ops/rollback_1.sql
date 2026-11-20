-- 1단계 되돌리기(여러 번 실행 가능). 2단계가 적용돼 있으면 rollback_2.sql 을 먼저.
-- 지우는 것: revision/econ 열(저장 번호·한도 통 기록만 — 게임 진행 data 는 그대로), player_roles 표(역할 기록), 함수·트리거.
drop trigger if exists progress_guard on public.progress;
drop trigger if exists progress_revision on public.progress;
drop function if exists public.save_progress(text, jsonb, bigint);
drop function if exists public.progress_guard();
drop function if exists public.progress_revision();
drop function if exists public.econ_limits();
drop table if exists public.player_roles;
alter table public.progress drop column if exists econ_at;
alter table public.progress drop column if exists econ_tokens;
alter table public.progress drop column if exists revision;
