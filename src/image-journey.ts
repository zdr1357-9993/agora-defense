import type { StoryStage } from './story';
import { AGORA_ROAD, journeyStops, roadSteps } from './image-journey-route';
import { toast } from './ui/overlay';
import './image-journey.css';

interface Chapter { n: number; title: string; era: string }
interface Options {
  chapter: Chapter; chapters: readonly Chapter[]; stages: StoryStage[];
  selectedId: string; sprite: string; cleared: readonly string[];
  unlocked(st: StoryStage): boolean;
  select(st: StoryStage): void; enter(st: StoryStage): void; info(st: StoryStage): void;
  chapterSelect(n: number): void; next(): void; skipTutorial?: () => void;
}

/** Image stays independent of the avatar, state markers and movement geometry. */
export function mountImageJourney(host: HTMLElement, o: Options) {
  const heading = document.createElement('div'); heading.className = 'journey-heading';
  heading.innerHTML = '<h2>모험의 여정</h2><small>거점을 누르면 돌길을 따라 이동해요</small>';
  const chapters = document.createElement('nav'); chapters.className = 'journey-chapters'; chapters.setAttribute('aria-label', '시대 선택');
  for (const ch of o.chapters) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = ch.n ? `${ch.n}장 ${ch.era}` : '시작';
    button.dataset.chapter = String(ch.n); button.setAttribute('aria-pressed', String(ch.n === o.chapter.n));
    button.onclick = () => o.chapterSelect(ch.n); chapters.append(button);
  }
  const viewport = document.createElement('div'); viewport.className = 'journey image-route-viewport';
  viewport.setAttribute('aria-label', `${o.chapter.title} 마을 지도`);
  const world = document.createElement('div'); world.className = 'image-route-world';
  const art = document.createElement('img'); art.className = 'image-route-art'; art.alt = '돌길이 학당으로 이어지는 고대 아고라 마을';
  art.src = new URL('./assets/journey-agora-v1.webp', import.meta.url).href; art.draggable = false;
  const avatar = document.createElement('div'); avatar.className = 'image-route-avatar'; avatar.setAttribute('aria-hidden', 'true');
  const face = document.createElement('img'); face.src = o.sprite; face.alt = ''; avatar.append(face);
  world.append(art, avatar); viewport.append(world);
  const title = document.createElement('div'); title.className = 'image-route-title'; title.textContent = o.chapter.title;
  const current = document.createElement('button'); current.className = 'image-route-recenter'; current.type = 'button'; current.textContent = '내 위치';
  const bar = document.createElement('div'); bar.className = 'j-bar journey-destination image-route-destination';
  bar.innerHTML = '<p class="destination-status" role="status"></p><div class="destination-actions"><button id="j-go" class="chunky mint j-go"></button><button class="journey-info">정보</button></div>';
  const go = bar.querySelector<HTMLButtonElement>('#j-go')!, info = bar.querySelector<HTMLButtonElement>('.journey-info')!, status = bar.querySelector<HTMLElement>('.destination-status')!;
  host.append(heading, chapters, viewport, bar);
  const controls = document.createElement('div'); controls.className = 'image-route-controls'; controls.append(title,current); viewport.prepend(controls);
  const stops = journeyStops(o.stages.length);
  let selected = o.stages.find(s => s.id === o.selectedId) ?? o.stages[0];
  let at = stops[Math.max(0, o.stages.indexOf(selected))];
  // A locked preview must not teleport the avatar into an unopened destination.
  if (!o.unlocked(selected)) at = stops[Math.max(0, o.stages.findIndex(s => o.unlocked(s)))];
  let raf = 0, dead = false, moving = false;
  const nodes: HTMLButtonElement[] = [];
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function place(x: number, y: number) { avatar.style.left = `${x * 100}%`; avatar.style.top = `${y * 100}%`; }
  function focus(y: number, smooth = false) {
    const top = y * world.offsetHeight - viewport.clientHeight * .65;
    viewport.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
  }
  function refresh() {
    const open = o.unlocked(selected);
    go.disabled = moving || !open;
    go.textContent = moving ? '이동 중…' : open ? `${o.cleared.includes(selected.id) ? '다시 도전' : '출발'} · ${selected.title}` : '앞선 기억을 먼저 되찾아 주세요';
    status.textContent = moving ? '돌길을 따라 이동하고 있어요' : `${o.chapter.n ? o.chapter.n + '장' : '튜토리얼'} · ${selected.title}`;
    nodes.forEach((b,i) => b.setAttribute('aria-pressed', String(o.stages[i].id === selected.id)));
  }
  function arrive(st: StoryStage, target: number) {
    at = target; selected = st; moving = false; avatar.classList.remove('walking');
    o.select(st); refresh();
  }
  function move(st: StoryStage, target: number) {
    if (moving) return;
    if (!o.unlocked(st)) { toast('앞선 기억을 먼저 되찾으면 이 길이 열려요'); return; }
    const steps = roadSteps(at, target);
    if (reduceMotion() || !steps.length) { place(...AGORA_ROAD[target]); focus(AGORA_ROAD[target][1], true); arrive(st,target); return; }
    moving = true; avatar.classList.add('walking'); refresh();
    let segment = 0, progress = 0, previous = performance.now(), from = AGORA_ROAD[at];
    const frame = (now: number) => {
      if (dead || !viewport.isConnected) return;
      let remaining = Math.min(.05, (now - previous) / 1000) * 180; previous = now;
      while (segment < steps.length) {
        const to = AGORA_ROAD[steps[segment]];
        const length = Math.hypot((to[0]-from[0])*world.offsetWidth, (to[1]-from[1])*world.offsetHeight);
        const needed = length * (1-progress);
        if (remaining < needed) { progress += remaining / Math.max(1,length); break; }
        remaining -= needed; from = to; at = steps[segment]; segment++; progress = 0;
      }
      if (segment === steps.length) { place(...AGORA_ROAD[target]); focus(AGORA_ROAD[target][1]); arrive(st,target); return; }
      const to = AGORA_ROAD[steps[segment]];
      const x = from[0]+(to[0]-from[0])*progress, y = from[1]+(to[1]-from[1])*progress;
      place(x,y); focus(y); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  o.stages.forEach((st,i) => {
    const [x,y] = AGORA_ROAD[stops[i]];
    const b = document.createElement('button'); b.className = 'image-route-stop'; b.type = 'button';
    b.dataset.st = st.id; b.style.left = `${x*100}%`; b.style.top = `${y*100}%`;
    const open = o.unlocked(st), cleared = o.cleared.includes(st.id);
    b.dataset.state = cleared ? 'done' : open ? 'open' : 'lock';
    b.setAttribute('aria-disabled',String(!open)); b.setAttribute('aria-label', `${st.title}${cleared ? ' · 클리어' : !open ? ' · 잠김' : ''}로 이동`);
    const label = document.createElement('span'); label.textContent = `${cleared ? '✓ ' : !open ? '🔒 ' : ''}${o.chapter.n || 'T'}-${i+1}`;
    b.append(label); b.onclick = () => move(st,stops[i]); world.append(b); nodes.push(b);
  });
  current.onclick = () => focus(AGORA_ROAD[at][1],true);
  go.onclick = () => { if (!moving && o.unlocked(selected)) o.enter(selected); };
  info.onclick = () => { if (!moving && o.unlocked(selected)) o.info(selected); };
  const next = document.createElement('button'); next.type = 'button'; next.className = 'ghost small'; next.textContent = '다음 열린 기억으로 →'; next.onclick = o.next; bar.append(next);
  if (o.skipTutorial) { const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'ghost small'; skip.textContent = '튜토리얼 건너뛰기 → 1장'; skip.onclick = o.skipTutorial; bar.append(skip); }
  const observer = new ResizeObserver(() => { if (!moving) focus(AGORA_ROAD[at][1]); }); observer.observe(viewport);
  const mutations = new MutationObserver(() => { if (!viewport.isConnected) destroy(); }); mutations.observe(host,{childList:true});
  function destroy() { dead = true; cancelAnimationFrame(raf); observer.disconnect(); mutations.disconnect(); }
  place(...AGORA_ROAD[at]); refresh(); requestAnimationFrame(() => { if (!dead) focus(AGORA_ROAD[at][1]); });
  return { destroy };
}
