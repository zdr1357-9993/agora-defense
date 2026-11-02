import { defineConfig } from 'vite';

// GitHub Pages 주소(/agora-defense/)에서도 동작하도록 상대 경로 사용
export default defineConfig({
  base: './',
  server: { host: true },
});
