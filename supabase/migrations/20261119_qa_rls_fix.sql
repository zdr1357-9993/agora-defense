-- QA-RLS 결함 3건 수정 (RD-S012, 지시서 014). schema.sql 을 먼저 적용한 DB 위에 적용한다. 여러 번 실행해도 된다.
-- 운영(Supabase) 적용은 현배 승인 후. 시험은 격리 Postgres(kind ai-lab / qa-rls)에서만 했다.
-- 상한·증가량 숫자는 게임 경제를 확인하지 않고 정한 값이다 → 운영 전 현배 확인 (worklog 참고).

-- 1) 저장 충돌: 서버가 세는 revision. 기기 시계(savedAt)는 승패에 쓰지 않는다.
alter table public.progress add column if not exists revision bigint not null default 0;

-- 2) 권한: role 은 클라이언트가 쓸 수 없는 별도 표. 읽기만 허용, 쓰기는 대시보드/서비스 역할(SQL Editor)에서만.
create table if not exists public.player_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null check (role in ('master', 'veteran', 'fresh'))
);
alter table public.player_roles enable row level security;
drop policy if exists "read own role" on public.player_roles;
create policy "read own role" on public.player_roles for select using (auth.uid() = user_id);
revoke all on public.player_roles from public, anon, authenticated;
grant select on public.player_roles to authenticated;

-- 3) 재화: progress 직접 쓰기 회수. 저장은 save_progress() 로만 (읽기는 그대로).
revoke insert, update, delete on public.progress from public, anon, authenticated;
grant select on public.progress to authenticated;

-- 4) 값 검사 트리거: 어떤 경로(RPC 포함)로 써도 통과해야 한다.
create or replace function public.progress_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_master boolean;
  k text;
  cap numeric; step numeric;
  nv numeric; ov numeric;
begin
  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'progress.data must be a JSON object' using errcode = '22023';
  end if;
  new.data := new.data - 'role';  -- role 은 data 에 저장하지 않는다(표시용 값도 서버 표에서만)
  select (r.role = 'master') into is_master from public.player_roles r where r.user_id = new.user_id;
  if not coalesce(is_master, false) then
    -- 재화 3종: 이름 / 총량 상한 / 한 번 저장당 늘 수 있는 양
    foreach k in array array['gonoe', 'gems', 'tickets'] loop
      if not (new.data ? k) then continue; end if;
      if jsonb_typeof(new.data -> k) is distinct from 'number' then
        raise exception '% must be a number', k using errcode = '22023';
      end if;
      nv := (new.data ->> k)::numeric;
      cap  := case k when 'gonoe' then 1e9 when 'gems' then 1e6 else 1e4 end;
      step := case k when 'gonoe' then 1e7 when 'gems' then 1e5 else 1e3 end;
      if nv < 0 then raise exception '% must not be negative', k using errcode = '22023'; end if;
      if nv > cap then raise exception '% exceeds cap %', k, cap using errcode = '22023'; end if;
      if tg_op = 'UPDATE' and jsonb_typeof(old.data -> k) = 'number' then
        ov := (old.data ->> k)::numeric;
        if nv - ov > step then raise exception '% increase % exceeds per-save limit %', k, nv - ov, step using errcode = '22023'; end if;
      end if;
    end loop;
  end if;
  if tg_op = 'INSERT' then new.revision := 1; else new.revision := old.revision + 1; end if;
  new.updated_at := now();  -- 서버 시각
  return new;
end $$;
drop trigger if exists progress_guard on public.progress;
create trigger progress_guard before insert or update on public.progress
  for each row execute function public.progress_guard();

-- 5) 저장 RPC: 내 줄만. base_revision 이 서버의 revision 과 다르면 쓰지 않고 'conflict' (승자는 DB).
create or replace function public.save_progress(p_login_id text, p_data jsonb, p_base_revision bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur bigint;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select p.revision into cur from public.progress p where p.user_id = uid for update;
  if not found then
    insert into public.progress (user_id, login_id, data) values (uid, p_login_id, p_data) returning revision into cur;
    return jsonb_build_object('status', 'ok', 'revision', cur);
  end if;
  if p_base_revision is distinct from cur then
    return jsonb_build_object('status', 'conflict', 'revision', cur);
  end if;
  update public.progress set data = p_data, login_id = p_login_id where user_id = uid returning revision into cur;
  return jsonb_build_object('status', 'ok', 'revision', cur);
end $$;
revoke all on function public.save_progress(text, jsonb, bigint) from public, anon;
grant execute on function public.save_progress(text, jsonb, bigint) to authenticated;

-- 6) 관리자: admin 계정을 master 로 (계정이 이미 있을 때만). 다른 계정은 SQL Editor 에서 같은 식으로.
insert into public.player_roles (user_id, role)
  select id, 'master' from auth.users where email = 'admin@players.agora-defense.app'
  on conflict (user_id) do update set role = excluded.role;
