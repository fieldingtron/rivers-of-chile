#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const robots = /<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*\/?\s*>/i;

const home = read('index.html');
const river = read('rio-niblinto-de-malleco/index.html');
const page = read('about/index.html');
const category = read('category/chile/index.html');
const missing = read('404.html');

assert.match(read('_headers'), /^\/\*\s*\r?\n\s*X-Robots-Tag:\s*noindex,\s*nofollow\s*$/im, 'Missing wildcard noindex header');
for (const html of [home, river, page, category, missing]) {
  assert.match(html, robots, 'Missing page noindex meta');
}
assert.match(home, /Rivers of Chile/i, 'Home page missing site name');
assert.match(home, /rio-niblinto-de-malleco/i, 'Home page missing a known river link');
assert.match(river, /<h1[^>]*>\s*Rio Niblinto de Malleco/i, 'River route did not render its heading');
assert.match(river, /Reserva Nacional Malleco/i, 'River body did not render');
assert.match(page, /<h1[^>]*>/i, 'Page missing heading');
assert.match(missing, /<h1[^>]*>\s*Page not found\s*<\/h1>/i);
assert.match(read('robots.txt'), /Disallow:\s*\//, 'robots.txt should disallow all on the beta');

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

console.log('Preview artifact checks passed: populated pages, 404, noindex header+meta, robots Disallow, redirects, no secret.');
