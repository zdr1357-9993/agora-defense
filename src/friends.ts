import { cloudClientForFeature } from './cloud';
import { FEATURES } from './features';

type Friendship = {
  id: string; requester_id: string; addressee_id: string;
  requester_login_id: string; addressee_login_id: string;
  status: 'pending' | 'accepted' | 'rejected'; created_at: string;
};
type Presence = { user_id: string; last_seen: string };

const HEARTBEAT_MS = 30_000;
const ONLINE_MS = 90_000;
let accountId = '';
let timer = 0;
let busy = false;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function button(label: string, action: () => void, className = 'ghost small') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = className; b.textContent = label; b.onclick = action;
  return b;
}

function row(label: string, detail: string) {
  const item = document.createElement('div'); item.className = 'friend-row';
  const text = document.createElement('span'); text.className = 'friend-name'; text.textContent = label;
  const small = document.createElement('small'); small.textContent = detail;
  const title = document.createElement('span'); title.className = 'friend-copy'; title.append(text, small);
  item.appendChild(title); return item;
}

async function refresh() {
  if (!FEATURES.friends || busy) return;
  const c = cloudClientForFeature();
  if (!c) { el('friend-status').textContent = '친구 기능은 서버 로그인 후 사용할 수 있어요.'; return; }
  busy = true;
  try {
    const { data: auth } = await c.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('로그인 세션을 확인할 수 없습니다.');
    const { data, error } = await c.from('friendships')
      .select('id,requester_id,addressee_id,requester_login_id,addressee_login_id,status,created_at')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const items = (data ?? []) as Friendship[];
    const friends = items.filter((f) => f.status === 'accepted');
    const friendIds = friends.map((f) => f.requester_id === uid ? f.addressee_id : f.requester_id);
    const presences: Presence[] = friendIds.length
      ? ((await c.from('friend_presence').select('user_id,last_seen').in('user_id', friendIds)).data ?? []) as Presence[]
      : [];
    const byUser = new Map(presences.map((p) => [p.user_id, p.last_seen]));

    const friendList = el('friend-list'); friendList.replaceChildren();
    if (!friends.length) friendList.append('아직 친구가 없어요.');
    for (const f of friends) {
      const id = f.requester_id === uid ? f.addressee_id : f.requester_id;
      const name = f.requester_id === uid ? f.addressee_login_id : f.requester_login_id;
      const seen = byUser.get(id);
      const online = !!seen && Date.now() - Date.parse(seen) <= ONLINE_MS;
      const item = row(name, online ? '접속 중' : '오프라인');
      const dot = document.createElement('i'); dot.className = `friend-dot ${online ? 'online' : ''}`; dot.setAttribute('aria-label', online ? '접속 중' : '오프라인');
      item.prepend(dot);
      item.appendChild(button('삭제', () => { void perform(async () => { await callRpc('remove_friend', { p_friendship_id: f.id }); await refresh(); }); }));
      friendList.appendChild(item);
    }

    const requests = el('friend-requests'); requests.replaceChildren();
    const activeRequests = items.filter((f) => f.status === 'pending');
    if (!activeRequests.length) requests.append('대기 중인 친구 요청이 없어요.');
    for (const f of activeRequests) {
      const incoming = f.addressee_id === uid;
      const name = incoming ? f.requester_login_id : f.addressee_login_id;
      const item = row(name, incoming ? '친구 요청을 보냈어요' : '수락을 기다리는 중');
      if (incoming) {
        item.appendChild(button('수락', () => { void perform(async () => { await callRpc('respond_friend_request', { p_friendship_id: f.id, p_action: 'accept' }); await refresh(); }); }, 'chunky mint'));
        item.appendChild(button('거절', () => { void perform(async () => { await callRpc('respond_friend_request', { p_friendship_id: f.id, p_action: 'reject' }); await refresh(); }); }));
      }
      requests.appendChild(item);
    }
    el('friend-status').textContent = '접속 표시는 30초마다 갱신돼요. 90초 동안 갱신이 없으면 오프라인으로 보여요.';
  } catch (e) {
    el('friend-status').textContent = `친구 정보를 불러오지 못했어요: ${(e as Error).message}`;
  } finally { busy = false; }
}

async function callRpc(name: string, args: Record<string, string>) {
  const c = cloudClientForFeature();
  if (!c) throw new Error('서버 로그인이 필요해요.');
  const { error } = await c.rpc(name, args);
  if (error) throw error;
}

async function perform(action: () => Promise<void>) {
  try { await action(); }
  catch (e) { el('friend-status').textContent = `요청을 처리하지 못했어요: ${(e as Error).message}`; }
}

async function heartbeat() {
  if (!FEATURES.friends || !accountId || document.visibilityState === 'hidden') return;
  const c = cloudClientForFeature();
  if (!c) return;
  const { error } = await c.rpc('touch_friend_presence');
  if (error) el('friend-status').textContent = `접속 표시를 갱신하지 못했어요: ${error.message}`;
}

export function setFriendsAccount(id: string, onlineAccount: boolean) {
  accountId = id;
  const panel = document.getElementById('friends-feature');
  if (panel) panel.classList.toggle('hidden', !FEATURES.friends);
  window.clearInterval(timer); timer = 0;
  if (!FEATURES.friends) return;
  if (!onlineAccount) { el('friend-status').textContent = '친구 기능은 서버 로그인 후 사용할 수 있어요.'; return; }
  void heartbeat().then(refresh);
  timer = window.setInterval(() => { void heartbeat().then(refresh); }, HEARTBEAT_MS);
}

export function stopFriends() {
  accountId = ''; window.clearInterval(timer); timer = 0;
}

if (FEATURES.friends) {
  el('friend-send').onclick = async () => {
    const input = el<HTMLInputElement>('friend-login-id');
    const loginId = input.value.trim();
    if (!loginId) { el('friend-status').textContent = '친구 아이디를 입력해 주세요.'; return; }
    try {
      await callRpc('send_friend_request', { p_target_login_id: loginId });
      input.value = ''; await refresh();
    } catch (e) { el('friend-status').textContent = `친구 요청을 보내지 못했어요: ${(e as Error).message}`; }
  };
}
