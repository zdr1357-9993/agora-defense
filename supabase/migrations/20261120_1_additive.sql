-- 1단계(추가만) — RD-T051 / 지시서 015. 옛 클라이언트(직접 upsert)와 함께 돌아가도 된다. 여러 번 실행해도 안전.
-- 순서: supabase/ops/precheck_1.sql → 이 파일 → supabase/ops/verify_1.sql. 되돌리기: supabase/ops/rollback_1.sql
-- 이 단계는 아무것도 막지 않는다(직접 쓰기 그대로). 재화 검사는 2단계에서 켠다.
-- 014 의 20261119_qa_rls_fix.sql 을 대체한다(그 파일은 운영에 적용된 적 없음).

-- 1) 서버가 세는 저장 번호(충돌 판정)와 재화 증가 한도 통(econ_*)
alter table public.progress add column if not exists revision    bigint      not null default 0;
alter table public.progress add column if not exists econ_tokens jsonb       not null default '{}';
alter table public.progress add column if not exists econ_at     timestamptz;

-- 2) 역할 표: 본인 SELECT 만. 쓰기는 SQL Editor(서비스 역할)에서만 — supabase/ops/grant_master.sql
create table if not exists public.player_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null check (role in ('master', 'veteran', 'fresh'))
);
alter table public.player_roles enable row level security;
drop policy if exists "read own role" on public.player_roles;
create policy "read own role" on public.player_roles for select using (auth.uid() = user_id);
revoke all on public.player_roles from public, anon, authenticated;
grant select on public.player_roles to authenticated;

-- 3) 저장할 때마다 revision+1, updated_at=서버 시각 (옛 클라이언트의 직접 upsert 에도 적용 → 새 클라이언트가 충돌을 알아챈다)
create or replace function public.progress_revision() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.revision := 1; else new.revision := coalesce(old.revision, 0) + 1; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists progress_revision on public.progress;
create trigger progress_revision before insert or update on public.progress
  for each row execute function public.progress_revision();

-- 4) 재화 검사 함수(만들기만 — 트리거 연결은 2단계). 일반 계정: 증가는 재화별 '통'의 남은 양까지, 감소(소모)는 자유, 총량 상한.
--    통은 시간당 rate 만큼 차고 cap_bucket 이상은 안 찬다. 넘는 증가분은 잘라낸다(저장 자체는 성공 → 클리어 기록 등은 남음).
--    숫자가 아니거나 음수인 재화 값은 서버의 이전 값으로 되돌린다. master(player_roles)는 검사하지 않는다. 수치 근거: docs/ECONOMY_LIMITS.md
create or replace function public.econ_limits() returns table(k text, total_cap numeric, rate_per_hour numeric, bucket numeric)
language sql immutable as $$
  values ('gonoe', 100000000::numeric, 100000::numeric, 300000::numeric),
         ('gems',      1000000,          1500,           3000),
         ('tickets',      1000,             2,              6)
$$;
create or replace function public.progress_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_master boolean; l record; nv numeric; ov numeric; tok numeric; hrs numeric; lim numeric; d numeric;
  toks jsonb := '{}';
begin
  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'progress.data must be a JSON object' using errcode = '22023';
  end if;
  new.data := new.data - 'role';  -- role 은 data 에 두지 않는다(옛 행에 있으면 첫 저장 때 빠진다)
  select (r.role = 'master') into is_master from public.player_roles r where r.user_id = new.user_id;
  if coalesce(is_master, false) then return new; end if;
  hrs := case when tg_op = 'UPDATE' and old.econ_at is not null
              then greatest(extract(epoch from now() - old.econ_at) / 3600, 0) else 0 end;
  for l in select * from public.econ_limits() loop
    ov := case when tg_op = 'UPDATE' and jsonb_typeof(old.data -> l.k) = 'number' then (old.data ->> l.k)::numeric else 0 end;
    -- 통: 옛 행(기록 없음)은 가득 찬 것으로, 새 행은 빈 것으로 시작
    tok := case when tg_op = 'INSERT' then 0
                when old.econ_tokens ? l.k then least(l.bucket, (old.econ_tokens ->> l.k)::numeric + l.rate_per_hour * hrs)
                else l.bucket end;
    if not (new.data ? l.k) then toks := toks || jsonb_build_object(l.k, tok); continue; end if;
    if jsonb_typeof(new.data -> l.k) is distinct from 'number' or (new.data ->> l.k)::numeric < 0 then
      new.data := jsonb_set(new.data, array[l.k], to_jsonb(ov));   -- 이상한 값 → 서버 값 유지
      toks := toks || jsonb_build_object(l.k, tok); continue;
    end if;
    nv := (new.data ->> l.k)::numeric;
    if tg_op = 'INSERT' then
      lim := least(l.bucket, l.total_cap);                         -- 첫 줄은 통 크기까지
    else
      if nv <= ov then toks := toks || jsonb_build_object(l.k, tok); continue; end if;  -- 소모·유지는 자유
      lim := least(ov + tok, greatest(l.total_cap, ov));           -- 이미 상한을 넘은 옛 값은 유지만(늘지 않음)
    end if;
    if nv > lim then nv := floor(lim); new.data := jsonb_set(new.data, array[l.k], to_jsonb(nv)); end if;
    d := case when tg_op = 'UPDATE' then greatest(nv - ov, 0) else 0 end;
    toks := toks || jsonb_build_object(l.k, greatest(tok - d, 0));
  end loop;
  new.econ_tokens := toks;
  new.econ_at := now();
  return new;
end $$;

-- 5) 저장 RPC: 내 줄만. base_revision 이 서버와 다르면 쓰지 않고 'conflict'. 서버가 재화를 잘랐으면 'clamped' 에 실제 저장값.
create or replace function public.save_progress(p_login_id text, p_data jsonb, p_base_revision bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur bigint; stored jsonb; cl jsonb := '{}'; l record;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select p.revision into cur from public.progress p where p.user_id = uid for update;
  if not found then
    insert into public.progress (user_id, login_id, data) values (uid, p_login_id, p_data) returning revision, data into cur, stored;
  elsif p_base_revision is distinct from cur then
    return jsonb_build_object('status', 'conflict', 'revision', cur);
  else
    update public.progress set data = p_data, login_id = p_login_id where user_id = uid returning revision, data into cur, stored;
  end if;
  for l in select k from public.econ_limits() loop
    if (p_data -> l.k) is distinct from (stored -> l.k) and stored ? l.k then cl := cl || jsonb_build_object(l.k, stored -> l.k); end if;
  end loop;
  return jsonb_build_object('status', 'ok', 'revision', cur) || case when cl = '{}' then '{}'::jsonb else jsonb_build_object('clamped', cl) end;
end $$;
revoke all on function public.save_progress(text, jsonb, bigint) from public, anon;
grant execute on function public.save_progress(text, jsonb, bigint) to authenticated;
