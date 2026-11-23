#!/usr/bin/env node
/**
 * Build data/snapshot/*.json (Directus-shaped) from a local WordPress REST export.
 * Default input: ../wp-export, then data/wp, then ROC_WP_EXPORT_DIR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexes } from './lib/wp-map.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'data', 'snapshot');

function resolveExportDir() {
  const candidates = [
    process.env.ROC_WP_EXPORT_DIR,
    path.resolve(root, '..', 'wp-export'),
    path.join(root, 'data', 'wp')
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'posts.json')));
}

function load(dir, name, fallback = []) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const exportDir = resolveExportDir();
if (!exportDir) {
  throw new Error('No WordPress export found. Set ROC_WP_EXPORT_DIR or place posts.json under data/wp or ../wp-export.');
}

const categories = load(exportDir, 'categories.json');
const tags = load(exportDir, 'tags.json');
const posts = load(exportDir, 'posts.json');
const pages = load(exportDir, 'pages.json');
const media = load(exportDir, 'media.json');
const authorsFromYoast = load(exportDir, 'authors-from-yoast.json', {});

const snapshot = buildIndexes({ categories, tags, posts, pages, media, authorsFromYoast });

const usedMedia = new Set();
for (const p of snapshot.posts) {
  if (p.featured_media_wp_id) usedMedia.add(p.featured_media_wp_id);
}
const contentRefs = new Set();
const uploadRe = /https:\/\/www\.riversofchile\.com\/wp-content\/uploads\/[^"'\\s)]+/g;
for (const item of [...snapshot.posts, ...snapshot.pages]) {
  const html = item.content || '';
  for (const url of html.match(uploadRe) || []) {
    contentRefs.add(url.replace(/-\d+x\d+(?=\.\w+$)/, ''));
  }
}
for (const m of snapshot.media) {
  const base = (m.source_url || '').replace(/-\d+x\d+(?=\.\w+$)/, '');
  m.referenced = usedMedia.has(m.wp_id) || contentRefs.has(m.source_url) || contentRefs.has(base);
}

const redirects = [];
for (const p of snapshot.posts) {
  redirects.push({ url_from: `/river/${p.slug}`, url_to: `/${p.slug}/`, type: '301', status: 'published' });
}
redirects.push(
  { url_from: '/feed', url_to: '/feed.xml', type: '301', status: 'published' },
  { url_from: '/feed/', url_to: '/feed.xml', type: '301', status: 'published' },
  { url_from: '/sitemap_index.xml', url_to: '/sitemap-index.xml', type: '301', status: 'published' }
);

fs.mkdirSync(outDir, { recursive: true });
const files = {
  'posts.json': snapshot.posts,
  'pages.json': snapshot.pages,
  'categories.json': snapshot.categories,
  'tags.json': snapshot.tags,
  'authors.json': snapshot.authors,
  'media.json': snapshot.media,
  'redirects.json': redirects
};
for (const [name, data] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2));
}
console.log(`Wrote ${Object.keys(files).length} snapshot files from ${exportDir} to ${outDir} (${snapshot.posts.length} posts, ${snapshot.pages.length} pages, ${snapshot.media.length} media).`);
