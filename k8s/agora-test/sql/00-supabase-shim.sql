-- 시험 전용: Supabase 가 기본으로 깔아 주는 것 중 우리 스키마가 기대는 부분만 흉내 낸다.
-- auth.users, auth.uid(), 역할 anon/authenticated/authenticator. 운영 DB 에는 절대 쓰지 않는다.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator';
  end if;
end $$;
grant anon, authenticated to authenticator;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase 기본값처럼 public 테이블은 일단 열어 두고, RLS 와 마이그레이션이 조인다
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- 시험 계정 셋: A, B 는 일반, M 은 master 후보
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'qa-a@players.agora-defense.app'),
  ('00000000-0000-0000-0000-00000000000b', 'qa-b@players.agora-defense.app'),
  ('00000000-0000-0000-0000-00000000000c', 'qa-m@players.agora-defense.app')
on conflict do nothing;
