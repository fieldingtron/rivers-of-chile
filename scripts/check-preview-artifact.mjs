#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const robots = /<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*\/?\s*>/i;

const home = read('index.html');
const home2 = read('home-2/index.html');
const home3 = read('home-3/index.html');
const river = read('rio-niblinto-de-malleco/index.html');
const page = read('about/index.html');
const category = read('category/chile/index.html');
const missing = read('404.html');

const structured = [...river.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
assert.ok(structured.some(data => data['@type'] === 'Article' && data.headline && data.inLanguage === 'en'));
assert.match(home, /<meta property="og:image" content="https:\/\//);
const production = process.env.RIVER_PRODUCTION === '1';
if (production) {
  assert.doesNotMatch(read('_headers'), /X-Robots-Tag/i);
  assert.doesNotMatch(river, /name="robots" content="noindex/i);
  assert.match(missing, /name="robots" content="noindex, follow"/);
  assert.match(read('robots.txt'), /Allow: \/\s+Sitemap:/);
} else {
  assert.match(read('_headers'), /^\/\*\s*\r?\n\s*X-Robots-Tag:\s*noindex,\s*nofollow\s*$/im, 'Missing wildcard noindex header');
  for (const html of [home, home2, home3, river, page, category, missing]) {
    assert.match(html, robots, 'Missing page noindex meta');
  }
  assert.match(read('robots.txt'), /Disallow:\s*\//);
}
assert.match(home, /Rivers of Chile/i, 'Home page missing site name');
assert.match(home, /Popular Rivers/, 'Home 1 missing Popular Rivers');
for (const html of [home, home2, home3, river, page]) assert.match(html, /Home 1[\s\S]*Home 2[\s\S]*Home 3/, 'Missing Home 1/2/3 nav links');
for (const html of [home, home2, home3, page]) assert.doesNotMatch(html, /beta preview|Search engines are asked/i, 'Visible beta text found');
assert.match(river, /<h1[^>]*>\s*Rio Niblinto de Malleco/i, 'River route did not render its heading');
assert.match(river, /Reserva Nacional Malleco/i, 'River body did not render');
assert.doesNotMatch(river, /migrated-media/, 'Built river page still contains /migrated-media/ in a URL');

const colorado = read('rio-colorado/index.html');
assert.match(colorado, /riversofchile-images\.pages\.dev\//, 'River images were not rewritten to the R2 image origin');
assert.match(colorado, /id="lightbox"/, 'Rio Colorado is missing the lightbox');
assert.match(colorado, /data-lightbox/, 'Rio Colorado images are not wired to the lightbox');
assert.match(colorado, /srcset="/, 'Rio Colorado images are missing srcset');
assert.match(colorado, /content-photo-link/, 'Rio Colorado images are not full-column photo links');
assert.doesNotMatch(colorado, /style="[^"]*width:\s*\d+px/, 'Rio Colorado still has WordPress inline image widths');
assert.match(colorado, /rivers-64x64\.png/, 'Inner pages are missing the navy-header logo');

assert.match(page, /<h1[^>]*>/i, 'Page missing heading');
assert.match(missing, /<h1[^>]*>\s*Page not found\s*<\/h1>/i);

const redirects = read('_redirects').split(/\r?\n/);
assert.ok(redirects.some((line) => line.startsWith('/river/')), 'Missing /river/:slug redirects');
assert.ok(!redirects.some((line) => /^\/\*\s+\/(?:index\.html)?\s+200\s*$/.test(line)), 'Unexpected SPA catch-all in redirects');

const files = fs.readdirSync(root, { recursive: true });
const forbidden = [process.env.DIRECTUS_BUILD_TOKEN, process.env.DIRECTUS_ADMIN_TOKEN].filter(Boolean);
for (const file of files) {
  const abs = path.join(root, file);
  if (!fs.statSync(abs).isFile()) continue;
  const bytes = fs.readFileSync(abs);
  assert.ok(!forbidden.some((secret) => bytes.includes(secret)), 'A build secret was found in the static output.');
}

console.log('Artifact checks passed for pages, indexing controls, redirects and build secrets.');

const esHome = read('es/index.html');
assert.match(esHome, /<html lang="es"/);
assert.match(esHome, /Ríos populares/);
assert.match(esHome, /🇨🇱/);
assert.match(esHome, /href="\/es\/rivers\/#region"/);
for (const file of files.filter((file) => file.endsWith('.html') && !file.startsWith('es/'))) {
  const translated = read(file === '404.html' ? 'es/404/index.html' : 'es/' + file);
  assert.match(translated, /hreflang="es"/, file);
  assert.doesNotMatch(translated, /ZXQ\d|QXZ/, file);
}
assert.match(read('es/contact-us/index.html'), /action="\/api\/contact"/);
assert.match(read('es/rio-niblinto-de-malleco/index.html'), /action="\/api\/comment"/);
console.log('Bilingual routes, Chilean flag and visitor forms verified.');
