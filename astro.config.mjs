import { defineConfig } from 'astro/config';
import { writeFileSync } from 'node:fs';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.RIVER_PRODUCTION === '1' ? 'https://www.riversofchile.com' : 'https://riversofchile.pages.dev',
  redirects: {
    '/22-teacups-22-tazas-rio-claro/': '/22-teacups-rio-claro/',
    '/es/22-teacups-22-tazas-rio-claro/': '/es/22-teacups-rio-claro/',
  },
  integrations: [{
    name: 'indexing-headers',
    hooks: { 'astro:build:done': ({ dir }) => writeFileSync(new URL('_headers', dir),
      process.env.RIVER_PRODUCTION === '1' ? '# Production indexing uses page metadata.\n' : '/*\n  X-Robots-Tag: noindex, nofollow\n') }
  }, sitemap({ filter: url => !url.includes('/22-teacups-22-tazas-rio-claro/') && !/\/(?:home-[23]|404|rio-claro-puente-las-pinas)\/?$/.test(new URL(url).pathname) })],
  devToolbar: { enabled: false },
  output: 'static',
  build: {
    format: 'directory'
  }
});
