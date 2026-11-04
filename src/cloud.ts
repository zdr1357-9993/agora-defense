// ☁️ Supabase 연동: 로그인과 진행 상황 서버 저장
// - 게임 아이디/비밀번호를 Supabase Auth 계정으로 쓴다 (아이디 → 내부용 이메일)
// - 진행 상황은 progress 테이블에 한 사람당 한 줄(JSON)로 저장. 보안 규칙상 자기 줄만 읽고 쓸 수 있다
// - 서버에 닿지 않아도 게임은 지금처럼 브라우저 저장으로 계속된다
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Progress } from './save';

const URL = 'https://ggzjgddzobkqrnsaklah.supabase.co';
const KEY = 'sb_publishable_EwV0TpGMAZFSV5zZsksq3w_0eJbqg3d'; // 공개용 키 (앱에 들어가도 되는 키)

let sb: SupabaseClient | null = null;
const client = () => (sb ??= createClient(URL, KEY, { auth: { persistSession: true, storageKey: 'agora_cloud_auth' } }));

/** 아이디 → Supabase 계정용 이메일 / 비밀번호는 최소 길이를 맞추려 접두어를 붙인다 */
const email = (id: string) => `${id.toLowerCase()}@players.agora-defense.app`;
const pass = (pw: string) => `agora-${pw}`;

export type CloudState = 'off' | 'ok' | 'error' | 'confirm';
export let cloudState: CloudState = 'off';
export let cloudMsg = '';
let userId = '';
let loginId = '';

/** 로그인. 서버에 계정이 없으면 같은 아이디/비밀번호로 만든다 (게임 계정 확인은 이미 끝난 뒤에 호출) */
export async function cloudLogin(id: string, pw: string): Promise<boolean> {
  try {
    const c = client();
    let { data, error } = await c.auth.signInWithPassword({ email: email(id), password: pass(pw) });
    if (error && /invalid login/i.test(error.message)) {
      const r = await c.auth.signUp({ email: email(id), password: pass(pw) });
      if (r.error) throw r.error;
      if (!r.data.session) { cloudState = 'confirm'; cloudMsg = 'Supabase에서 이메일 확인(Confirm email)을 꺼 주세요'; return false; }
      data = { user: r.data.user!, session: r.data.session } as typeof data;
      error = null;
    }
    if (error) throw error;
    userId = data.user!.id; loginId = id;
    cloudState = 'ok'; cloudMsg = '';
    return true;
  } catch (e) {
    const err = e as { message?: string; status?: number; code?: string };
    cloudState = 'error'; cloudMsg = `[로그인] ${err.message ?? String(e)}${err.code ? ` (${err.code})` : ''}`;
    return false;
  }
}

/** 서버에 저장된 진행 상황 (없으면 null) */
export async function cloudLoad(): Promise<Progress | null> {
  if (cloudState !== 'ok') return null;
  const { data, error } = await client().from('progress').select('data').eq('user_id', userId).maybeSingle();
  if (error) { cloudState = 'error'; cloudMsg = `[불러오기] ${error.message}${error.code ? ` (${error.code})` : ''}`; return null; }
  return (data?.data as Progress) ?? null;
}

let timer = 0;
let pending: Progress | null = null;
/** 저장 요청: 3초 동안 모아서 한 번에 올린다 */
export function cloudSave(p: Progress) {
  if (cloudState !== 'ok') return;
  pending = p;
  clearTimeout(timer);
  timer = window.setTimeout(flush, 3000);
}
export async function flush() {
  if (!pending || cloudState !== 'ok') return;
  const p = pending; pending = null;
  const { error } = await client().from('progress').upsert({ user_id: userId, login_id: loginId, data: p, updated_at: new Date().toISOString() });
  if (error) { cloudState = 'error'; cloudMsg = `[저장] ${error.message}${error.code ? ` (${error.code})` : ''}`; }
}
export async function cloudLogout() { try { await flush(); await client().auth.signOut(); } catch { /* 무시 */ } cloudState = 'off'; userId = ''; }
window.addEventListener('pagehide', () => { void flush(); });
