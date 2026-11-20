-- 빈 시험 DB 전용. PostgREST 시험 계정이며 운영 Supabase에는 실행하지 않는다.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'qa-a@players.agora-defense.app'),
  ('00000000-0000-0000-0000-00000000000b', 'qa-b@players.agora-defense.app'),
  ('00000000-0000-0000-0000-00000000000c', 'qa-m@players.agora-defense.app')
on conflict (id) do update set email = excluded.email;
