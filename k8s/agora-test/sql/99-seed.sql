-- 시험 전용: master 한 명 지정 (운영에서는 현배가 grant_master.sql 로 직접)
insert into public.player_roles (user_id, role)
values ('00000000-0000-0000-0000-00000000000c', 'master')
on conflict (user_id) do update set role = excluded.role;
notify pgrst, 'reload schema';
