-- 친구 요청·친구 관계·접속 표시. 운영 적용은 승인된 배포 절차를 따른다.
-- 직접 쓰기는 막고, 사용자 ID를 auth.uid() 에서만 얻는 RPC 로 상태를 바꾼다.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  requester_login_id text not null,
  addressee_login_id text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_one_active_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pending', 'accepted');
create index if not exists friendships_requester_status on public.friendships (requester_id, status);
create index if not exists friendships_addressee_status on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));
revoke all on public.friendships from public, anon, authenticated;
grant select on public.friendships to authenticated;

create table if not exists public.friend_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table public.friend_presence enable row level security;
drop policy if exists "read own and friend presence" on public.friend_presence;
create policy "read own and friend presence" on public.friend_presence
  for select to authenticated using (
    auth.uid() = user_id or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = user_id))
    )
  );
revoke all on public.friend_presence from public, anon, authenticated;
grant select on public.friend_presence to authenticated;

create or replace function public.send_friend_request(p_target_login_id text)
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  uid uuid := auth.uid();
  target_id uuid;
  target_login text;
  requester_login text;
  friendship_id uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_target_login_id is null or length(trim(p_target_login_id)) not between 3 and 12
     or trim(p_target_login_id) !~ '^[A-Za-z0-9]+$' then
    raise exception '아이디는 영문·숫자 3~12자여야 합니다' using errcode = '22023';
  end if;
  select lower(split_part(u.email, '@', 1)), u.id into target_login, target_id
    from auth.users u
    where lower(u.email) = lower(trim(p_target_login_id)) || '@players.agora-defense.app';
  if target_id is null then raise exception '해당 아이디를 찾을 수 없습니다' using errcode = 'P0002'; end if;
  if target_id = uid then raise exception '자기 자신에게 친구 요청을 보낼 수 없습니다' using errcode = '22023'; end if;
  select lower(split_part(u.email, '@', 1)) into requester_login from auth.users u where u.id = uid;
  if requester_login is null then raise exception '계정을 찾을 수 없습니다' using errcode = 'P0002'; end if;
  insert into public.friendships (requester_id, addressee_id, requester_login_id, addressee_login_id)
  values (uid, target_id, requester_login, target_login)
  returning id into friendship_id;
  return friendship_id;
exception when unique_violation then
  raise exception '이미 친구 요청이 대기 중이거나 친구입니다' using errcode = '23505';
end;
$$;

create or replace function public.respond_friend_request(p_friendship_id uuid, p_action text)
returns text language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); row_id uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_action is null or p_action not in ('accept', 'reject') then raise exception '요청 처리는 accept 또는 reject여야 합니다' using errcode = '22023'; end if;
  update public.friendships
    set status = case when p_action = 'accept' then 'accepted' else 'rejected' end,
        responded_at = now()
    where id = p_friendship_id and addressee_id = uid and status = 'pending'
    returning id into row_id;
  if row_id is null then raise exception '받은 친구 요청을 찾을 수 없습니다' using errcode = 'P0002'; end if;
  return p_action;
end;
$$;

create or replace function public.remove_friend(p_friendship_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); affected integer;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from public.friendships
    where id = p_friendship_id and status = 'accepted' and uid in (requester_id, addressee_id);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.touch_friend_presence()
returns timestamptz language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); seen timestamptz;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  insert into public.friend_presence (user_id, last_seen) values (uid, now())
    on conflict (user_id) do update set last_seen = now()
    returning last_seen into seen;
  return seen;
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon, authenticated;
revoke all on function public.respond_friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid) from public, anon, authenticated;
revoke all on function public.touch_friend_presence() from public, anon, authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.touch_friend_presence() to authenticated;

notify pgrst, 'reload schema';
