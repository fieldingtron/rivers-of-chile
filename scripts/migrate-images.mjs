#!/usr/bin/env node
/**
 * Process downloaded WP media, upload to the riversofchile-images R2 bucket,
 * write data/images/manifest-v1.json, and update roc_media in Directus.
 *
 * Reads CLOUDFLARE_API_TOKEN (or /workspace/roc/.cf_api_token) and optional
 * DIRECTUS_ADMIN_TOKEN. Never prints secrets.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.image-migration');
const variantDir = path.join(outDir, 'variants');
const manifestPath = path.join(root, 'data', 'images', 'manifest-v1.json');
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '380ad23988b4ff82b4994eac826b8bab';
const BUCKET = process.env.R2_BUCKET || 'riversofchile-images';
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || 'https://riversofchile-images.pages.dev').replace(/\/$/, '');
const WIDTHS = [400, 800, 1200];

function readToken(file, envName) {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  return '';
}

const cfToken = readToken('/workspace/roc/.cf_api_token', 'CLOUDFLARE_API_TOKEN');
const adminToken = readToken('/workspace/roc/.directus_admin_token', 'DIRECTUS_ADMIN_TOKEN');
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://content.fieldsmarshall.com';

function slugName(name) {
  return String(name || 'image')
    .replace(/\.[A-Za-z0-9]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'image';
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function r2KeyFor(name, width, height, digest, ext) {
  return `migrated-media/${name}-${width}x${height}-${digest.slice(0, 20)}.${ext}`;
}

function publicKeyFor(r2Key) {
  return String(r2Key || '').replace(/^migrated-media\//, '');
}

function toPublicVariant({ r2Key, width, height, bytes, mime, local, kind }) {
  return {
    key: publicKeyFor(r2Key),
    r2_key: r2Key,
    width,
    height,
    bytes,
    mime,
    local,
    kind
  };
}


function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return String(url).split('?')[0];
  }
}

async function processImage(file, baseName) {
  const input = fs.readFileSync(file);
  const digestSource = sha256(input);
  let meta;
  try {
    meta = await sharp(input, { failOn: 'none' }).metadata();
  } catch {
    return null;
  }
  if (!meta.format || !meta.width || !meta.height) return null;
  const variants = [];
  const origExt = (meta.format === 'jpeg' ? 'jpg' : meta.format);
  const origKey = r2KeyFor(baseName, meta.width, meta.height, sha256(input), origExt);
  const origPath = path.join(variantDir, origKey.replace(/^migrated-media\//, ''));
  fs.mkdirSync(path.dirname(origPath), { recursive: true });
  fs.writeFileSync(origPath, input);
  variants.push(toPublicVariant({
    r2Key: origKey,
    width: meta.width,
    height: meta.height,
    bytes: input.length,
    mime: `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`,
    local: origPath,
    kind: 'original'
  }));

  // Generate WebP only when the requested width is not larger than the source.
  for (const width of WIDTHS) {
    if (width >= meta.width) continue;
    const height = Math.round((meta.height * width) / meta.width);
    let pipeline = sharp(input, { failOn: 'none' }).resize({ width, height, fit: 'inside', withoutEnlargement: true }).rotate();
    // Strip metadata (EXIF) by default; keep transparency.
    const webp = await pipeline.webp({ quality: 80, effort: 4 }).toBuffer();
    const origAtSize = await sharp(input, { failOn: 'none' })
      .resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .rotate()
      .toBuffer();
    let out = webp;
    let ext = 'webp';
    let mime = 'image/webp';
    if (origAtSize.length < webp.length) {
      out = origAtSize;
      ext = origExt;
      mime = `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`;
    }
    const key = r2KeyFor(baseName, width, height, sha256(out), ext);
    const dest = path.join(variantDir, key.replace(/^migrated-media\//, ''));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, out);
    variants.push(toPublicVariant({
      r2Key: key,
      width,
      height,
      bytes: out.length,
      mime,
      local: dest,
      kind: 'variant'
    }));
  }
  // Sort small → large; original last if it is the largest width.
  variants.sort((a, b) => a.width - b.width || a.bytes - b.bytes);
  return { sourceSha256: digestSource, width: meta.width, height: meta.height, mime: `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`, variants };
}

async function processBinary(file, baseName, mime) {
  const input = fs.readFileSync(file);
  const digest = sha256(input);
  const ext = path.extname(file).replace('.', '').toLowerCase() || 'bin';
  const key = `migrated-media/${baseName}-${digest.slice(0, 20)}.${ext}`;
  const dest = path.join(variantDir, key.replace(/^migrated-media\//, ''));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, input);
  return {
    sourceSha256: digest,
    width: null,
    height: null,
    mime,
    variants: [toPublicVariant({ r2Key: key, width: 0, height: 0, bytes: input.length, mime, local: dest, kind: 'original' })]
  };
}

async function r2Put(key, file, mime) {
  if (!cfToken) throw new Error('CLOUDFLARE_API_TOKEN is required for R2 upload.');
  const body = fs.readFileSync(file);
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': mime || 'application/octet-stream',
      'Content-Length': String(body.length),
      'If-None-Match': '*'
    },
    body
  });
  if (res.status === 412 || res.status === 409) return 'exists';
  if (!res.ok) {
    // If-None-Match may be rejected; retry without it only when the object is missing.
    if (res.status === 400 || res.status === 501) {
      const retry = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${cfToken}`,
          'Content-Type': mime || 'application/octet-stream',
          'Content-Length': String(body.length)
        },
        body
      });
      if (!retry.ok) throw new Error(`R2 PUT ${key} failed: HTTP ${retry.status}`);
      return 'uploaded';
    }
    throw new Error(`R2 PUT ${key} failed: HTTP ${res.status}`);
  }
  return 'uploaded';
}

async function directusApi(method, pathname, body) {
  const url = new URL(pathname, DIRECTUS_URL);
  const res = await fetch(url, {
    method,
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${adminToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Directus ${method} ${pathname} failed: HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

function addAliases(aliases, url, hash) {
  if (!url) return;
  const exact = normalizeUrl(url);
  aliases[exact] = hash;
  aliases[url] = hash;
  aliases[exact.replace(/-\d+x\d+(?=\.\w+$)/, '')] = hash;
}

async function main() {
  const download = JSON.parse(fs.readFileSync(path.join(outDir, 'download-report.json'), 'utf8'));
  const media = JSON.parse(fs.readFileSync(path.join(root, 'data/snapshot/media.json'), 'utf8'));
  const mediaByUrl = new Map(media.map((m) => [normalizeUrl(m.source_url), m]));
  const mediaById = new Map(media.map((m) => [m.wp_id, m]));
  fs.mkdirSync(variantDir, { recursive: true });

  const okItems = [...download.ok, ...download.skipped];
  const assets = {};
  const aliases = {};
  const processed = [];
  let i = 0;
  for (const item of okItems) {
    i += 1;
    const file = path.resolve(root, item.dest);
    if (!fs.existsSync(file)) continue;
    const rec = item.wp_id ? mediaById.get(item.wp_id) : mediaByUrl.get(normalizeUrl(item.url));
    const baseName = slugName(rec?.filename || path.basename(item.url));
    const mime = rec?.mime || item.contentType || '';
    let result;
    if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|tiff?)$/i.test(file)) {
      result = await processImage(file, baseName);
    }
    if (!result) {
      result = await processBinary(file, baseName, mime || 'application/octet-stream');
    }
    const hash = result.sourceSha256;
    if (assets[hash]) {
      addAliases(aliases, item.url, hash);
      addAliases(aliases, rec?.source_url, hash);
      const extraId = rec?.wp_id || item.wp_id;
      if (extraId && !(assets[hash].wp_ids || []).includes(extraId)) {
        assets[hash].wp_ids = [...(assets[hash].wp_ids || (assets[hash].wp_id ? [assets[hash].wp_id] : [])), extraId];
      }
      processed.push({ url: item.url, wp_id: item.wp_id, hash, deduped: true });
      continue;
    }
    assets[hash] = {
      wp_id: rec?.wp_id || item.wp_id || null,
      wp_ids: [rec?.wp_id || item.wp_id].filter(Boolean),
      alt: rec?.alt || '',
      caption: rec?.caption || '',
      source_url: rec?.source_url || item.url,
      mime: result.mime,
      bytes: result.variants.find((v) => v.kind === 'original')?.bytes,
      width: result.width,
      height: result.height,
      variants: result.variants.map(({ key, r2_key, width, height, bytes, mime, kind }) => ({ key, r2_key: r2_key || key, width, height, bytes, mime, kind }))
    };
    // Keep local paths in a side map for upload
    assets[hash]._local = result.variants;
    addAliases(aliases, item.url, hash);
    addAliases(aliases, rec?.source_url, hash);
    processed.push({ url: item.url, wp_id: item.wp_id, hash });
    if (i % 25 === 0) console.log(`processed ${i}/${okItems.length}`);
  }

  const uploads = { uploaded: 0, exists: 0, failed: [] };
  if (!cfToken) {
    console.log('No Cloudflare API token; wrote local variants only. Skipping R2 upload.');
    for (const asset of Object.values(assets)) delete asset._local;
  } else {
    const jobs = [];
    const seenKeys = new Set();
    for (const asset of Object.values(assets)) {
      for (const variant of asset._local) {
        const objectKey = variant.r2_key || variant.key;
        if (seenKeys.has(objectKey)) continue;
        seenKeys.add(objectKey);
        jobs.push({ ...variant, r2_key: objectKey });
      }
      delete asset._local;
    }
    console.log(`Uploading ${jobs.length} objects to R2…`);
    let i = 0;
    const CONCURRENCY = 6;
    async function worker() {
      while (i < jobs.length) {
        const variant = jobs[i++];
        try {
          const status = await r2Put(variant.r2_key || variant.key, variant.local, variant.mime);
          if (status === 'exists') uploads.exists += 1;
          else uploads.uploaded += 1;
        } catch (err) {
          uploads.failed.push({ key: variant.r2_key || variant.key, error: err.message });
        }
        const done = uploads.uploaded + uploads.exists + uploads.failed.length;
        if (done % 50 === 0 || done === jobs.length) {
          console.log(`upload ${done}/${jobs.length} (${uploads.uploaded} new, ${uploads.exists} existed, ${uploads.failed.length} failed)`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    publicBase: PUBLIC_BASE,
    bucket: BUCKET,
    assets,
    aliases,
    missing: download.failed || [],
    upload: { uploaded: uploads.uploaded, exists: uploads.exists, failed: uploads.failed.length }
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outDir, 'upload-report.json'), JSON.stringify(uploads, null, 2));
  console.log(`Manifest ${manifestPath}: ${Object.keys(assets).length} assets, ${Object.keys(aliases).length} aliases, ${uploads.uploaded} uploaded, ${uploads.exists} existed, ${uploads.failed.length} failed, ${download.failed.length} download failures.`);

  if (adminToken) {
    try {
      const existing = (await directusApi('GET', '/items/roc_media?limit=-1&fields=id,wp_id,source_url')).data || [];
      const byWp = new Map(existing.map((row) => [row.wp_id, row]));
      const pending = [];
      for (const [hash, asset] of Object.entries(assets)) {
        const ids = asset.wp_ids?.length ? asset.wp_ids : (asset.wp_id ? [asset.wp_id] : []);
        const full = asset.variants[asset.variants.length - 1];
        for (const wpId of ids) {
          if (!wpId || !byWp.has(wpId)) continue;
          const row = byWp.get(wpId);
          pending.push({
            id: row.id,
            r2_key: full.key,
            sha256: hash,
            variants: asset.variants,
            status: 'uploaded',
            width: asset.width,
            height: asset.height,
            bytes: asset.bytes != null ? String(asset.bytes) : undefined
            // source_url intentionally unchanged
          });
        }
      }
      for (const miss of (download.failed || []).filter((f) => f.kind === 'library' && f.wp_id)) {
        const row = byWp.get(miss.wp_id);
        if (!row) continue;
        pending.push({ id: row.id, status: 'missing' });
      }
      let updated = 0;
      for (let i = 0; i < pending.length; i += 50) {
        const batch = pending.slice(i, i + 50);
        await directusApi('PATCH', '/items/roc_media', batch);
        updated += batch.length;
        console.log(`Directus media ${updated}/${pending.length}`);
      }
      console.log(`Updated ${updated} roc_media records in Directus.`);
    } catch (err) {
      console.error(`Directus media update skipped: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
