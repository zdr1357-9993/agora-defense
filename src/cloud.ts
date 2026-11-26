// ☁️ Supabase 연동: 로그인과 진행 상황 서버 저장
// - 게임 아이디/비밀번호를 Supabase Auth 계정으로 쓴다 (아이디 → 내부용 이메일)
// - 진행 상황은 progress 테이블에 한 사람당 한 줄(JSON)로 저장. 보안 규칙상 자기 줄만 읽고 쓸 수 있다
// - 서버에 닿지 않아도 게임은 지금처럼 브라우저 저장으로 계속된다
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Progress } from './save';
import type { Role } from './auth';

const URL = 'https://ggzjgddzobkqrnsaklah.supabase.co';
const KEY = 'sb_publishable_EwV0TpGMAZFSV5zZsksq3w_0eJbqg3d'; // 공개용 키 (앱에 들어가도 되는 키)

let sb: SupabaseClient | null = null;
const client = () => (sb ??= createClient(URL, KEY, { auth: { persistSession: true, storageKey: 'agora_cloud_auth' } }));

/** RLS 가 적용되는 부가 기능에서 같은 로그인 세션을 사용한다. */
export function cloudClientForFeature(): SupabaseClient | null {
  return cloudState === 'ok' ? client() : null;
}

/** 아이디 → Supabase 계정용 이메일 / 비밀번호는 최소 길이를 맞추려 접두어를 붙인다 */
const email = (id: string) => `${id.toLowerCase()}@players.agora-defense.app`;
const pass = (pw: string) => `agora-${pw}`;

export type CloudState = 'off' | 'ok' | 'error' | 'confirm';
/** 마지막 로그인 실패가 '아이디·비밀번호 틀림'(auth)인지 '서버에 못 닿음'(network)인지 */
export let cloudFailKind: 'auth' | 'network' | null = null;
export let cloudState: CloudState = 'off';
export let cloudMsg = '';
let userId = '';
let loginId = '';

// 서버 revision: 이 기기가 마지막으로 서버와 맞춘 번호. 저장 충돌의 승자는 기기 시계가 아니라 이 번호로 정한다 (docs/SAVE_CONFLICT.md)
const REV_KEY = () => `agora_cloud_rev:${userId}`;
let baseRev: number | null = null;
function loadRev() { try { const v = localStorage.getItem(REV_KEY()); baseRev = v === null ? null : Number(v); } catch { baseRev = null; } }
function setRev(n: number) { baseRev = n; try { localStorage.setItem(REV_KEY(), String(n)); } catch { /* 무시 */ } }
function setUser(uid: string, id: string) { userId = uid; loginId = id; loadRev(); }
export const cloudBaseRevision = () => baseRev;
/** 서버 값을 이 기기에 받아들였을 때 부른다: 이 revision 에서 이어서 저장한다 */
export const cloudMarkSynced = (rev: number) => setRev(rev);
let onConflict: (() => void | Promise<void>) | null = null;
let onClamped: ((v: Partial<Record<'gonoe' | 'gems' | 'tickets', number>>) => void) | null = null;
/** 서버가 재화 증가를 한도로 잘랐을 때(저장은 성공) 실제 저장된 값을 받는다 — 이 기기 값도 그 값으로 맞춘다 */
export function setClampHook(f: (v: Partial<Record<'gonoe' | 'gems' | 'tickets', number>>) => void) { onClamped = f; }
/** 저장이 다른 기기의 더 새로운 저장과 부딪혔을 때(서버가 거절) 부를 함수. 서버 값이 이긴다 */
export function setConflictHook(f: () => void | Promise<void>) { onConflict = f; }

/** 로그인. 서버에 계정이 없으면 같은 아이디/비밀번호로 만든다 (게임 계정 확인은 이미 끝난 뒤에 호출) */
/** create=false면 로그인만 (회원가입한 일반 계정), true면 없을 때 만든다 (미리 정한 계정·새 가입) */
export async function cloudLogin(id: string, pw: string, create = true): Promise<boolean> {
  try {
    const c = client();
    let { data, error } = await c.auth.signInWithPassword({ email: email(id), password: pass(pw) });
    if (error && /invalid login/i.test(error.message) && create) {
      const r = await c.auth.signUp({ email: email(id), password: pass(pw) });
      if (r.error) throw r.error;
      if (!r.data.session) { cloudState = 'confirm'; cloudMsg = 'Supabase에서 이메일 확인(Confirm email)을 꺼 주세요'; return false; }
      data = { user: r.data.user!, session: r.data.session } as typeof data;
      error = null;
    }
    if (error) throw error;
    setUser(data.user!.id, id);
    cloudState = 'ok'; cloudMsg = ''; cloudFailKind = null;
    return true;
  } catch (e) {
    const err = e as { message?: string; status?: number; code?: string };
    cloudState = 'error'; cloudMsg = `[로그인] ${err.message ?? String(e)}${err.code ? ` (${err.code})` : ''}`;
    cloudFailKind = /invalid login|invalid_credentials|email not confirmed/i.test(`${err.message} ${err.code}`) || (err.status ?? 0) === 400 ? 'auth' : 'network';
    return false;
  }
}

/** 서버에 저장된 진행 상황 (없으면 null) */
export async function cloudLoad(): Promise<{ data: Progress; revision: number } | null> {
  if (cloudState !== 'ok') return null;
  const { data, error } = await client().from('progress').select('data, revision').eq('user_id', userId).maybeSingle();
  if (error) { cloudState = 'error'; cloudMsg = `[불러오기] ${error.message}${error.code ? ` (${error.code})` : ''}`; return null; }
  return data ? { data: data.data as Progress, revision: Number(data.revision ?? 0) } : null;
}

/** 서버가 알고 있는 내 role (player_roles, 읽기 전용). 없으면 null → 호출한 쪽이 'fresh' 로 본다. 표시·편의용이고 권한은 DB 가 따로 강제한다 */
export async function cloudRole(): Promise<Role | null> {
  if (cloudState !== 'ok') return null;
  const { data, error } = await client().from('player_roles').select('role').eq('user_id', userId).maybeSingle();
  if (error) return null;
  const r = data?.role;
  return r === 'master' || r === 'veteran' || r === 'fresh' ? r : null;
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
  // 저장은 서버 함수로만: base_revision 이 서버와 다르면 서버가 쓰지 않고 'conflict' 를 돌려준다
  const { data, error } = await client().rpc('save_progress', { p_login_id: loginId, p_data: p, p_base_revision: baseRev });
  if (error) { cloudState = 'error'; cloudMsg = `[저장] ${error.message}${error.code ? ` (${error.code})` : ''}`; return; }
  const r = data as { status?: string; revision?: number; clamped?: Partial<Record<'gonoe' | 'gems' | 'tickets', number>> } | null;
  if (r?.status === 'ok' && typeof r.revision === 'number') { setRev(r.revision); if (r.clamped) onClamped?.(r.clamped); }
  else if (r?.status === 'conflict') { pending = null; await onConflict?.(); }
}
export async function cloudLogout() { try { await flush(); await client().auth.signOut(); } catch { /* 무시 */ } cloudState = 'off'; userId = ''; }
window.addEventListener('pagehide', () => { void flush(); });

/** 새 아이디로 가입: 이미 있으면 false와 이유 */
export async function cloudSignUp(id: string, pw: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const c = client();
    const tryIn = await c.auth.signInWithPassword({ email: email(id), password: pass(pw) });
    if (!tryIn.error) { setUser(tryIn.data.user!.id, id); cloudState = 'ok'; return { ok: true, msg: '이미 있는 계정이라 그대로 로그인했어요' }; }
    const r = await c.auth.signUp({ email: email(id), password: pass(pw) });
    if (r.error) return { ok: false, msg: /registered|already/i.test(r.error.message) ? '이미 쓰고 있는 아이디예요' : r.error.message };
    if (!r.data.session) return { ok: false, msg: '서버 설정에서 이메일 확인(Confirm email)을 꺼 주세요' };
    setUser(r.data.user!.id, id); cloudState = 'ok';
    return { ok: true, msg: '' };
  } catch (e) { return { ok: false, msg: (e as Error).message }; }
}
