import type { StoryStage } from '../story';
import { toast } from '../ui/overlay';
import { mountField, type FieldHandle } from './index';
import { buildMap, stageSpot, FACILITY_SPOTS, type Poi } from './tilemap';
import { paletteFor } from './render';

export interface StageStatus { cleared: boolean; unlocked: boolean; lockText: string }
export interface JourneyFieldDeps {
  stages: StoryStage[];
  chapters: readonly { n: number; title: string; era: string }[];
  selectedId: string;
  sprite(): HTMLCanvasElement;
  status(st: StoryStage): StageStatus;
  /** 선택을 바꾸고 여정 화면을 다시 그린다 */
  select(id: string): void;
  /** 선택된 스테이지로 출발 (기존 #j-go 버튼과 같은 동작) */
  enter(): void;
  openTab(tab: string): void;
}

/** 필드를 끄고 기존 DOM 지도로 돌아가려면 주소에 ?field=0 */
export const fieldEnabled = () => new URLSearchParams(location.search).get('field') !== '0';

// 화면을 다시 그려도 서 있던 자리를 기억한다 (선택이 바깥에서 바뀌면 그 거점으로 옮긴다)
let saved: { chapter: number; sel: string; x: number; y: number } | null = null;
let pendingBubble: string | null = null;
const FACILITIES = [{ id: 'room', label: '🤔', name: '고민방', tab: 'room' }, { id: 'shop', label: '🛍', name: '상점', tab: 'shop' }, { id: 'gacha', label: '🎴', name: '뽑기', tab: 'gacha' }];

export function mountJourneyField(box: HTMLElement, d: JourneyFieldDeps): FieldHandle {
  const selected = d.stages.find((s) => s.id === d.selectedId) ?? d.stages[0];
  const n = selected.chapter;
  const inChapter = d.stages.filter((s) => s.chapter === n);
  const pois: Poi[] = inChapter.map((st, i) => {
    const [x, y] = stageSpot(i, inChapter.length), s = d.status(st);
    return { id: st.id, kind: 'stage', x, y, label: `${n ? n : 'T'}-${i + 1}`, name: s.unlocked ? st.title : '아직 닿지 않은 기억', state: s.cleared ? 'done' : s.unlocked ? 'open' : 'lock' };
  });
  for (const f of FACILITIES) { const [x, y] = FACILITY_SPOTS[f.id]; pois.push({ id: f.id, kind: 'facility', x, y, label: f.label, name: f.name, state: 'open' }); }
  const map = buildMap(pois, n + 1);
  const selPoi = pois.find((p) => p.id === selected.id)!;
  const start = saved && saved.chapter === n && saved.sel === selected.id ? { x: saved.x, y: saved.y } : { x: selPoi.x, y: selPoi.y };
  const stageOf = (id: string) => inChapter.find((s) => s.id === id);

  const handle = mountField({
    host: box, map, palette: paletteFor(n), sprite: d.sprite(), start, selectedId: selected.id,
    onMove: (p) => { saved = { chapter: n, sel: d.selectedId, x: p.x, y: p.y }; },
    onArrive: (poi, h) => {
      if (poi.kind === 'stage' && poi.id !== d.selectedId) { saved = { chapter: n, sel: poi.id, x: poi.x, y: poi.y }; pendingBubble = poi.id; d.select(poi.id); }
      else h.showBubble(poi.id);
    },
    bubble: (poi) => {
      if (poi.kind === 'facility') return { text: poi.name, action: { label: '들어가기', run: () => d.openTab(FACILITIES.find((f) => f.id === poi.id)!.tab) } };
      const st = stageOf(poi.id)!, s = d.status(st);
      return s.unlocked ? { text: `${st.title}${s.cleared ? ' · 클리어' : ''}`, action: { label: s.cleared ? '다시 떠나기' : '출발', run: d.enter } } : { text: s.lockText };
    },
  });

  const title = document.createElement('div'); title.className = 'field-title';
  const ch = d.chapters.find((c) => c.n === n)!;
  title.innerHTML = `<small>${n ? `${n}장 · ${ch.era}` : '시작 튜토리얼'}</small><b>${ch.title}</b>`;
  const nav = document.createElement('div'); nav.className = 'field-chapters';
  const nums = [...new Set(d.stages.map((s) => s.chapter))].sort((a, b) => a - b), at = nums.indexOf(n);
  const go = (to: number | undefined) => {
    if (to === undefined) return;
    const list = d.stages.filter((s) => s.chapter === to);
    const pick = list.find((s) => { const t = d.status(s); return t.unlocked && !t.cleared; }) ?? list.find((s) => d.status(s).unlocked);
    if (pick) d.select(pick.id); else toast(d.status(list[0]).lockText);
  };
  for (const [label, aria, to] of [['◀', '이전 장', nums[at - 1]], ['▶', '다음 장', nums[at + 1]]] as const) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.disabled = to === undefined; b.onclick = () => go(to); nav.appendChild(b);
  }
  handle.wrap.append(title, nav);
  if (pendingBubble && pois.some((p) => p.id === pendingBubble)) { handle.showBubble(pendingBubble); }
  pendingBubble = null;
  return handle;
}
