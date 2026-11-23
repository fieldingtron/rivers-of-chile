#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'public', '_redirects');
const snapshotFile = path.join(root, 'data', 'snapshot', 'redirects.json');

const lines = [
  '# Cloudflare Pages redirects',
  '# Auto-generated. Do not edit by hand — see scripts/generate-redirects.mjs',
  ''
];

if (fs.existsSync(snapshotFile)) {
  const rules = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  for (const r of rules) {
    if (r.url_from && r.url_to) {
      lines.push(`${r.url_from} ${r.url_to} ${r.type || '301'}`);
    }
  }
} else {
  lines.push('/river/:slug /:slug/ 301');
  lines.push('/feed /feed.xml 301');
  lines.push('/feed/ /feed.xml 301');
  lines.push('/sitemap_index.xml /sitemap-index.xml 301');
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log(`Wrote ${lines.filter((l) => l.startsWith('/')).length} redirect rules to ${outFile}`);
