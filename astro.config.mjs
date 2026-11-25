import { defineConfig } from 'astro/config';
import { writeFileSync } from 'node:fs';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.RIVER_PRODUCTION === '1' ? 'https://www.riversofchile.com' : 'https://riversofchile.pages.dev',
  integrations: [{
    name: 'indexing-headers',
    hooks: { 'astro:build:done': ({ dir }) => writeFileSync(new URL('_headers', dir),
      process.env.RIVER_PRODUCTION === '1' ? '# Production indexing uses page metadata.\n' : '/*\n  X-Robots-Tag: noindex, nofollow\n') }
  }, sitemap({ filter: url => !/\/(?:home-[23]|404|rio-claro-puente-las-pinas)\/?$/.test(new URL(url).pathname) })],
  output: 'static',
  build: {
    format: 'directory'
  }
});
