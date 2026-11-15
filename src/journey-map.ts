import './journey-map.css';

/** Pixel signs are images; the actual buttons keep their accessible stage names. */
export function journeySign(label: string, complete: boolean, locked: boolean): string {
  const ink = locked ? '#929184' : '#fff5d1';
  const face = locked ? '#665f56' : complete ? '#536a45' : '#89603c';
  const safe = label.replace(/[^0-9T-]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="52" viewBox="0 0 72 52" shape-rendering="crispEdges"><path fill="#3f382b" d="M31 26h10v26H31z"/><path fill="#917147" d="M34 26h4v25h-4z"/><path fill="#39382c" d="M5 5h62v31H5z"/><path fill="#c39b60" d="M8 8h56v25H8z"/><path fill="${face}" d="M10 10h52v21H10z"/><path fill="#f0d69b" d="M11 11h3v3h-3zm47 0h3v3h-3z"/><text x="36" y="25" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" fill="${ink}">${safe}</text>${complete ? '<path fill="#e9d27b" d="M60 0h8v4h4v8h-4v4h-8v-4h-4V4h4z"/>' : ''}${locked ? '<path fill="#b9b4a4" d="M55 1h9v4h3v10H52V5h3zm3 3v4h3V4z"/>' : ''}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function mountJourneyWorld(viewport: HTMLElement, fallback: string) {
  viewport.classList.add('pixel-journey');
  const world = document.createElement('div');
  world.className = 'journey-world';
  // Each era retains its own art; the Greek chapter gets the new tile map.
  world.style.backgroundImage = `url(${fallback})`;
  if (viewport.dataset.era === '고대') {
    const art = new Image();
    art.onload = () => { world.style.backgroundImage = `url(${art.src})`; world.classList.add('has-tile-map'); };
    art.src = new URL('journey/greek-tile-map.png', document.baseURI).href;
  }
  while (viewport.firstChild) world.appendChild(viewport.firstChild);
  viewport.appendChild(world);
  const hint = document.createElement('span'); hint.className = 'journey-direction';
  hint.textContent = '↑ 길을 따라 다음 기억으로';
  viewport.appendChild(hint);
}

export function focusJourney(viewport: HTMLElement, index: number, initial: boolean) {
  requestAnimationFrame(() => {
    const world = viewport.querySelector<HTMLElement>('.journey-world');
    const node = world?.querySelectorAll<HTMLElement>('.roam-node')[index];
    if (!world || !node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodeTop = node.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
    const top = Math.max(0, nodeTop - viewport.clientHeight * .58);
    if (initial || reduce) {
      const previous = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = 'auto';
      viewport.scrollTop = top;
      requestAnimationFrame(() => { viewport.style.scrollBehavior = previous; });
    } else viewport.scrollTo({ top, behavior: 'smooth' });
    if (!initial && !reduce) {
      viewport.classList.remove('journey-stepping');
      void viewport.offsetWidth;
      viewport.classList.add('journey-stepping');
    }
  });
}
