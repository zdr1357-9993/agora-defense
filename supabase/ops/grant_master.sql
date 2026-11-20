-- master(관리자) 지정 — 현배가 SQL Editor 에서 직접. 마이그레이션은 아무도 자동으로 master 로 만들지 않는다.
-- 먼저 아래 SELECT 로 그 이메일의 계정이 '내가 만든 계정'인지(created_at) 확인한 뒤, 주석을 풀어 실행한다.
-- 게임 아이디 X 의 이메일은 '<x 소문자>@players.agora-defense.app'.
select id, email, created_at from auth.users where email in ('admin@players.agora-defense.app') order by created_at;
-- insert into public.player_roles (user_id, role)
--   select id, 'master' from auth.users where email = 'admin@players.agora-defense.app'
--   on conflict (user_id) do update set role = excluded.role;
-- 다른 역할: 'veteran'(새 기기에서 기존 플레이어 진행으로 시작) / 해제: delete from public.player_roles where user_id = '…';
