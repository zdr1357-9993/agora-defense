// 저장이 두 곳(이 기기 localStorage · 서버 progress)일 때 누가 이기는지 정하는 규칙. 기기 시계(Date.now/savedAt)는 보지 않는다.
// 기준 문서: docs/SAVE_CONFLICT.md
export type SyncDecision = 'adopt' | 'push';
export interface SyncInput {
  /** 서버에 내 줄이 있나 */ hasRemote: boolean;
  /** 이 기기에 저장이 없던 상태로 들어왔나 */ freshDevice: boolean;
  /** 서버 줄의 revision */ remoteRevision: number;
  /** 이 기기가 마지막으로 서버와 맞춘 revision (기록 없으면 null) */ baseRevision: number | null;
}
/** 'adopt' = 서버 값을 쓴다 / 'push' = 이 기기 값을 서버에 올린다 */
export function decideSync(i: SyncInput): SyncDecision {
  if (!i.hasRemote) return 'push';            // 서버가 비어 있으면 올린다
  if (i.freshDevice) return 'adopt';          // 이 기기가 비어 있으면 서버 것
  if (i.baseRevision === null) return 'adopt'; // 마지막으로 맞춘 기록이 없으면 서버 것(충돌 시 DB 우선)
  return i.remoteRevision === i.baseRevision ? 'push' : 'adopt'; // 서버가 내가 아는 상태 그대로일 때만 내 것을 올린다
}
