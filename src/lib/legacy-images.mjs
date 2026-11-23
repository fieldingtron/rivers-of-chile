/**
 * Rewrite legacy WordPress image URLs using the migration manifest.
 * Unmatched URLs are left pointing at WordPress.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MANIFEST = path.resolve('data/images/manifest-v1.json');
const DEFAULT_BASE = 'https://riversofchile-images.pages.dev';

export function loadImageManifest(file = process.env.ROC_IMAGE_MANIFEST || DEFAULT_MANIFEST) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function publicBase(manifest) {
  return (process.env.R2_PUBLIC_BASE_URL || manifest?.publicBase || DEFAULT_BASE).replace(/\/$/, '');
}

function normalize(url) {
  if (!url) return '';
  try {
    const u = new URL(url, 'https://www.riversofchile.com');
    return u.origin + u.pathname;
  } catch {
    return String(url).split('?')[0];
  }
}

function stripSize(url) {
  return normalize(url).replace(/-\d+x\d+(?=\.\w+$)/, '');
}

export function assetFor(manifest, url) {
  if (!manifest || !url) return undefined;
  const exact = normalize(url);
  const stripped = stripSize(url);
  const aliases = manifest.aliases || {};
  const hash = aliases[exact] || aliases[stripped] || aliases[url] || aliases[decodeURI(exact)] || aliases[exact.replace('https://www.', 'https://')];
  if (!hash) return undefined;
  return manifest.assets[hash];
}

export function publicObjectKey(key) {
  return String(key || '').replace(/^migrated-media\//, '');
}

export function variantUrl(manifest, variant) {
  return `${publicBase(manifest)}/${publicObjectKey(variant.key)}`;
}

export function featuredImageUrl(manifest, url) {
  const asset = assetFor(manifest, url);
  if (!asset?.variants?.length) return url || undefined;
  const full = asset.variants[asset.variants.length - 1];
  return variantUrl(manifest, full);
}

function rewriteSrcset(value, manifest) {
  return value
    .split(',')
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      const asset = assetFor(manifest, bits[0]);
      if (!asset) return part.trim();
      const desc = bits.slice(1).join(' ');
      // Prefer a variant matching the requested width when present.
      let variant = asset.variants[asset.variants.length - 1];
      const width = desc.match(/^(\d+)w$/);
      if (width) {
        const target = Number(width[1]);
        variant = asset.variants.find((v) => v.width === target) || asset.variants.find((v) => v.width >= target) || variant;
      }
      return desc ? `${variantUrl(manifest, variant)} ${desc}` : variantUrl(manifest, variant);
    })
    .join(', ');
}

function rewriteTag(tag, manifest) {
  return tag.replace(/\s(src|href|data-src|data-lazy-src|data-orig-file)=["']([^"']+)["']/gi, (all, attr, value) => {
    const asset = assetFor(manifest, value);
    if (!asset?.variants?.length) return all;
    const full = asset.variants[asset.variants.length - 1];
    return ` ${attr}="${variantUrl(manifest, full)}"`;
  }).replace(/\s(srcset|data-srcset|data-lazy-srcset)=["']([^"']+)["']/gi, (all, attr, value) => {
    return ` ${attr}="${rewriteSrcset(value, manifest)}"`;
  });
}

export function rewriteLegacyImages(html, manifest) {
  if (!html || !manifest) return html || '';
  let out = html.replace(/<(img|a|source|video)\b[^>]*>/gi, (tag) => rewriteTag(tag, manifest));
  // Bare upload URLs in text/href leftovers
  out = out.replace(/https?:\/\/(?:www\.)?riversofchile\.com\/wp-content\/uploads\/[^"'\\s)]+/g, (url) => {
    const asset = assetFor(manifest, url);
    if (!asset?.variants?.length) return url;
    return variantUrl(manifest, asset.variants[asset.variants.length - 1]);
  });
  return out;
}

export function addResponsiveAttrs(html, manifest) {
  if (!html || !manifest) return html || '';
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const src = /src=["']([^"']+)["']/i.exec(attrs);
    const asset = src ? assetFor(manifest, src[1]) : undefined;
    // After rewrite, src may already be the public URL; look up by key too.
    let found = asset;
    if (!found && src?.[1]) {
      const key = src[1].replace(/^https?:\/\/[^/]+\//, '');
      found = Object.values(manifest.assets || {}).find((a) => a.variants?.some((v) => v.key === key));
    }
    if (!found?.variants?.length) return full;
    const variants = found.variants.filter((v) => (v.mime || '').includes('image') && v.width);
    if (variants.length < 2) return full;
    let next = attrs;
    if (!/\ssrcset=/i.test(next)) {
      next += ` srcset="${variants.map((v) => `${variantUrl(manifest, v)} ${v.width}w`).join(', ')}"`;
      next += ` sizes="(max-width: 900px) 100vw, 900px"`;
    }
    const fullV = variants[variants.length - 1];
    if (!/\swidth=/i.test(next) && fullV.width) next += ` width="${fullV.width}"`;
    if (!/\sheight=/i.test(next) && fullV.height) next += ` height="${fullV.height}"`;
    if (!/\sdecoding=/i.test(next)) next += ` decoding="async"`;
    if (!/\sloading=/i.test(next)) next += ` loading="lazy"`;
    return `<img${next}>`;
  });
}
