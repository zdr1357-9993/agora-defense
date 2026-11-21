import type { Account } from '../auth';

/** 로그인한 사용자 (없으면 null). 바꿀 때는 setMe 로만. */
export let me: Account | null = null;
export function setMe(next: Account | null) { me = next; }
export const isAdmin = () => me?.role === 'master';
