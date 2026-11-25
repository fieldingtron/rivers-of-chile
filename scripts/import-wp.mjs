#!/usr/bin/env node
/**
 * Import WordPress REST export JSON into roc_* collections in 50-item batches.
 * Idempotent: existing rows (matched on wp_id / wp_user_id / url_from) are left alone;
 * only missing rows are inserted. Reads DIRECTUS_ADMIN_TOKEN. Never prints secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexes } from './lib/wp-map.mjs';

const DEFAULT_URL = 'https://content.fieldsmarshall.com';
const BATCH = 50;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireAdminToken() {
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim();
  if (!token) {
    throw new Error('DIRECTUS_ADMIN_TOKEN is required. Do not paste it into chat; set it in the environment.');
  }
  return token;
}

function directusUrl() {
  const raw = process.env.DIRECTUS_URL?.trim() || DEFAULT_URL;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('DIRECTUS_URL must be an HTTPS origin without embedded credentials.');
  }
  return url.origin;
}

async function api(method, pathname, body) {
  const url = new URL(pathname, directusUrl());
  const res = await fetch(url, {
    method,
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${requireAdminToken()}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    throw new Error(`Directus ${method} ${pathname} failed: HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

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

async function existingKeys(collection, keyField) {
  const json = await api('GET', `/items/${collection}?limit=-1&fields=${keyField}`);
  const keys = new Set();
  for (const row of json.data || []) {
    if (row[keyField] != null) keys.add(String(row[keyField]));
  }
  return keys;
}

async function insertMissing(collection, items, keyField) {
  const have = await existingKeys(collection, keyField);
  const fresh = items.filter((item) => item[keyField] != null && !have.has(String(item[keyField])));
  if (!fresh.length) {
    console.log(`Collection ${collection}: ${items.length} source rows, all already present; nothing to insert.`);
    return 0;
  }
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const chunk = fresh.slice(i, i + BATCH);
    await api('POST', `/items/${collection}`, chunk);
    inserted += chunk.length;
  }
  console.log(`Collection ${collection}: inserted ${inserted} of ${items.length} (${have.size} already present).`);
  return inserted;
}

const REGIONS = [
  { slug: 'santiago-metropolitan-region', name: 'Santiago Metropolitan Region', roman: null, sort: 0 },
  { slug: 'region-v', name: 'Region V', roman: 'V', sort: 5 },
  { slug: 'region-vi', name: 'Region VI', roman: 'VI', sort: 6 },
  { slug: 'region-vii', name: 'Region VII', roman: 'VII', sort: 7 },
  { slug: 'region-viii', name: 'Region VIII', roman: 'VIII', sort: 8 },
  { slug: 'region-ix', name: 'Region IX', roman: 'IX', sort: 9 },
  { slug: 'region-x', name: 'Region X', roman: 'X', sort: 10 },
  { slug: 'region-xi', name: 'Region XI', roman: 'XI', sort: 11 },
  { slug: 'region-xiv-de-los-rios', name: 'Region XIV De Los Rios', roman: 'XIV', sort: 14 }
];

async function main() {
  requireAdminToken();
  const exportDir = resolveExportDir();
  if (!exportDir) throw new Error('No WordPress export found (posts.json). Set ROC_WP_EXPORT_DIR.');

  const snapshot = buildIndexes({
    categories: load(exportDir, 'categories.json'),
    tags: load(exportDir, 'tags.json'),
    posts: load(exportDir, 'posts.json'),
    pages: load(exportDir, 'pages.json'),
    media: load(exportDir, 'media.json'),
    authorsFromYoast: load(exportDir, 'authors-from-yoast.json', {})
  });

  await insertMissing('roc_authors', snapshot.authors, 'wp_user_id');
  await insertMissing('roc_media', snapshot.media, 'wp_id');
  await insertMissing('roc_regions', REGIONS, 'slug');
  await insertMissing('roc_categories', snapshot.categories, 'wp_id');
  await insertMissing('roc_tags', snapshot.tags, 'wp_id');
  await insertMissing('roc_posts', snapshot.posts, 'wp_id');
  await insertMissing('roc_pages', snapshot.pages, 'wp_id');
  console.log('Import complete.');
}

main().catch((err) => {
  console.error(err.message || 'Import failed');
  process.exit(1);
});
