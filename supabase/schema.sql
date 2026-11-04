-- AGORA 철학사 랜덤 디펜스 · Supabase 테이블
-- Supabase 대시보드 → SQL Editor → 새 쿼리에 전체를 붙여 넣고 Run

-- 1) 플레이어 진행 상황: 로그인한 사람(auth.users) 한 명당 한 줄
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  login_id   text not null,                 -- 게임 아이디 (admin, hyebin …)
  data       jsonb not null default '{}',   -- 클리어 기록·카드·도구·재화 등 저장 내용 전체
  updated_at timestamptz not null default now()
);

-- 2) 보안 규칙: 자기 줄만 읽고 쓸 수 있다
alter table public.progress enable row level security;

drop policy if exists "read own progress" on public.progress;
create policy "read own progress" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "insert own progress" on public.progress;
create policy "insert own progress" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own progress" on public.progress;
create policy "update own progress" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
