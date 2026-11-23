#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.image-migration');
const origDir = path.join(outDir, 'originals');
const extraDir = path.join(outDir, 'unmatched');
fs.mkdirSync(origDir, { recursive: true });
fs.mkdirSync(extraDir, { recursive: true });

const UA = 'Mozilla/5.0 (compatible; RiversOfChile-migration/1.0; read-only; +https://riversofchile.pages.dev)';
const media = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot/media.json'), 'utf8'));

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return String(url).split('?')[0];
  }
}

function collectUnmatched() {
  const listed = path.join(outDir, 'unmatched-urls.json');
  const known = new Set(media.map((m) => normalizeUrl(m.source_url)));
  const found = new Set();
  const re = /https?:\/\/(?:www\.)?riversofchile\.com\/wp-content\/uploads\/[^"'\s)]+/g;
  for (const file of ['posts.json', 'pages.json']) {
    const items = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot', file), 'utf8'));
    for (const item of items) {
      const text = [item.content, item.excerpt, item.featured_image_url].filter(Boolean).join('\n');
      for (const match of text.matchAll(re)) found.add(normalizeUrl(match[0]));
    }
  }
  const unmatched = [...found].filter((url) => !known.has(url)).sort();
  fs.writeFileSync(listed, JSON.stringify(unmatched, null, 2));
  return unmatched;
}

const unmatched = collectUnmatched();

function safeName(name) {
  return String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180);
}

const jobs = [
  ...media.map((m) => ({
    kind: 'library',
    wp_id: m.wp_id,
    url: m.source_url,
    dest: path.join(origDir, `${m.wp_id}-${safeName(m.filename || path.basename(m.source_url))}`)
  })),
  ...unmatched.map((url, i) => ({
    kind: 'unmatched',
    wp_id: null,
    url,
    dest: path.join(extraDir, `${String(i).padStart(3, '0')}-${safeName(path.basename(url))}`)
  }))
];

const report = { ok: [], failed: [], skipped: [] };
const CONCURRENCY = 2;

async function fetchOne(job, attempt = 1) {
  if (fs.existsSync(job.dest) && fs.statSync(job.dest).size > 0) {
    report.skipped.push({ ...job, bytes: fs.statSync(job.dest).size });
    return;
  }
  try {
    const res = await fetch(job.url, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
      redirect: 'follow'
    });
    if (res.status === 404 || res.status === 410) {
      report.failed.push({ url: job.url, kind: job.kind, wp_id: job.wp_id, status: res.status, reason: 'not_found' });
      return;
    }
    if (!res.ok) {
      if (attempt < 3 && res.status >= 500) {
        await delay(1500 * attempt);
        return fetchOne(job, attempt + 1);
      }
      report.failed.push({ url: job.url, kind: job.kind, wp_id: job.wp_id, status: res.status, reason: 'http_error' });
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(job.dest, buf);
    report.ok.push({
      url: job.url,
      kind: job.kind,
      wp_id: job.wp_id,
      dest: path.relative(root, job.dest),
      bytes: buf.length,
      contentType: res.headers.get('content-type')
    });
  } catch (err) {
    if (attempt < 3) {
      await delay(1500 * attempt);
      return fetchOne(job, attempt + 1);
    }
    report.failed.push({ url: job.url, kind: job.kind, wp_id: job.wp_id, status: 0, reason: String(err.message || err) });
  }
}

async function run() {
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const job = jobs[i++];
      await fetchOne(job);
      await delay(350);
      if ((report.ok.length + report.failed.length + report.skipped.length) % 25 === 0) {
        console.log(`progress ${report.ok.length} ok, ${report.skipped.length} cached, ${report.failed.length} failed, ${i}/${jobs.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(path.join(outDir, 'download-report.json'), JSON.stringify(report, null, 2));
  console.log(`done: ${report.ok.length} downloaded, ${report.skipped.length} already present, ${report.failed.length} failed of ${jobs.length}`);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
