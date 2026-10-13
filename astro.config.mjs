import { defineConfig } from 'astro/config';
export default defineConfig({
  site: process.env.SITE_URL || 'https://kelycrane.github.io',
  base: process.env.BASE_PATH || '/',
  output: 'static', trailingSlash: 'always',
  markdown: { shikiConfig: { theme: 'github-dark' } },
  devToolbar: { enabled: false },
  vite: { cacheDir: '.storage/cache/vite', server: { watch: { ignored: ['**/.storage/**', '**/dist/**'] } }, optimizeDeps: { include: ['tone'] } },
});