import { loadArtwork, iconUrl, artworkCharacter, RELEASE } from './artwork';

const loader = document.createElement('div');
loader.className = 'art-loader';
loader.innerHTML = '<b>AGORA</b><p>철학자들이 광장으로 오는 중…</p><progress max="16" value="0"></progress><small>잠깐, 망치는 니체만 들고 오세요.</small>';
document.body.appendChild(loader);

loadArtwork((done, total) => {
  const bar = loader.querySelector('progress')!; bar.max = total; bar.value = done;
}).then(async (missing) => {
  document.body.dataset.artwork = missing.length ? 'partial' : 'ready';
  document.body.dataset.version = RELEASE;
  if (missing.length) console.warn('Artwork fallback:', missing);
  for (const el of document.querySelectorAll<HTMLElement>('[data-art-icon]')) {
    const url = iconUrl(el.dataset.artIcon!); if (url) el.setAttribute('src', url);
  }
  const hero = document.querySelector<HTMLImageElement>('[data-login-hero]');
  const socrates = artworkCharacter('T106');
  if (hero && socrates) hero.src = socrates.toDataURL();
  for (const name of ['sell', 'merge', 'upgrade', 'recipe', 'settings', 'sound']) {
    const url = iconUrl(name); if (url) document.documentElement.style.setProperty(`--art-${name}`, `url("${url}")`);
  }
  await import('./main');
  loader.remove();
}).catch((error) => {
  console.error(error);
  loader.innerHTML = '<b>잠깐, 철학자들이 길을 잃었어요.</b><p>새로고침하면 다시 광장으로 모여요.</p><button type="button">다시 불러오기</button>';
  loader.querySelector('button')!.onclick = () => location.reload();
});
