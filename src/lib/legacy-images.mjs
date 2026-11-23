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


function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/\n+/g, ' ')
    .trim();
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(attrs, name) {
  const m = new RegExp(`\\s${name}=["']([^"']*)["']`, 'i').exec(attrs);
  return m ? m[1] : '';
}

function stripAttr(attrs, name) {
  return attrs.replace(new RegExp(`\\s${name}=["'][^"']*["']`, 'gi'), '');
}

function setAttr(attrs, name, value) {
  const cleaned = stripAttr(attrs, name);
  return `${cleaned} ${name}="${escapeAttr(value)}"`;
}

function assetFromSrc(manifest, src) {
  if (!manifest || !src) return undefined;
  const direct = assetFor(manifest, src);
  if (direct) return direct;
  const key = String(src).replace(/^https?:\/\/[^/]+\//, '').replace(/^migrated-media\//, '');
  return Object.values(manifest.assets || {}).find((a) => a.variants?.some((v) => publicObjectKey(v.key) === key || v.key === key));
}

function imageVariants(asset) {
  return [...(asset?.variants || [])]
    .filter((v) => (v.mime || 'image/').includes('image') && v.width)
    .sort((a, b) => a.width - b.width);
}

function pickCaption(...candidates) {
  for (const raw of candidates) {
    const text = plainText(raw);
    if (!text) continue;
    const lower = text.toLowerCase();
    if (/^(image|photo|img|picture|olympus digital camera|dscn?\d+|img[_-]?\d+)$/i.test(lower)) continue;
    return text;
  }
  return '';
}

function enhanceImgTag(tag, manifest, forcedCaption) {
  const parsed = tag.match(/^<img\b([^>]*)\/?>$/i);
  if (!parsed) return tag;
  let attrs = parsed[1].replace(/\/\s*$/, ' ');
  const src = attr(attrs, 'src');
  const asset = assetFromSrc(manifest, src);
  const variants = imageVariants(asset);
  const full = variants[variants.length - 1];
  const fullUrl = full ? variantUrl(manifest, full) : src;
  if (fullUrl) attrs = setAttr(attrs, 'src', fullUrl);
  if (variants.length) {
    attrs = setAttr(attrs, 'srcset', variants.map((v) => `${variantUrl(manifest, v)} ${v.width}w`).join(', '));
    attrs = setAttr(attrs, 'sizes', '(max-width: 1000px) 100vw, 1000px');
    if (full.width) attrs = setAttr(attrs, 'width', String(full.width));
    if (full.height) attrs = setAttr(attrs, 'height', String(full.height));
  }
  if (!/\sdecoding=/i.test(attrs)) attrs += ' decoding="async"';
  if (!/\sloading=/i.test(attrs)) attrs += ' loading="lazy"';
  const caption = pickCaption(
    forcedCaption,
    attr(attrs, 'data-caption'),
    asset?.caption,
    attr(attrs, 'alt'),
    attr(attrs, 'title'),
    asset?.alt
  );
  attrs = setAttr(attrs, 'data-full', fullUrl || src);
  if (caption) attrs = setAttr(attrs, 'data-caption', caption);
  const cleanedClass = attr(attrs, 'class')
    .replace(/\b(alignleft|alignright|aligncenter|alignnone|size-medium|size-thumbnail|size-full|size-large|content-photo)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  attrs = setAttr(attrs, 'class', `${cleanedClass} content-photo`.trim());
  attrs = attrs.replace(/\sstyle="[^"]*"/gi, '');
  return `<img${attrs}>`;
}


function alreadyInsideLink(before) {
  const lastOpen = before.toLowerCase().lastIndexOf('<a ');
  const lastClose = before.toLowerCase().lastIndexOf('</a>');
  return lastOpen > lastClose;
}

function linkifyImage(img, href) {
  if (/<a\b/i.test(img)) return img;
  const full = /data-full="([^"]*)"/i.exec(img)?.[1] || href || /src="([^"]*)"/i.exec(img)?.[1] || '#';
  const caption = /data-caption="([^"]*)"/i.exec(img)?.[1] || '';
  return `<a class="content-photo-link" href="${escapeAttr(full)}" data-lightbox data-full="${escapeAttr(full)}"${caption ? ` data-caption="${caption}"` : ''}>${img}</a>`;
}

function wrapAsFigure(inner, captionHtml) {
  const cap = captionHtml ? `\n  <figcaption>${captionHtml}</figcaption>` : '';
  return `<figure class="content-figure">${inner}${cap}\n</figure>`;
}

/**
 * Prepare article HTML so photos are full-column with srcset, captions, and
 * lightbox hooks, and leftover WordPress sizing/float markup is removed.
 */
export function prepareArticleImages(html, manifest) {
  if (!html) return html || '';
  let out = rewriteLegacyImages(html, manifest);

  out = out.replace(/<(figure|div)([^>]*class="[^"]*(?:wp-caption|alignleft|alignright|aligncenter|alignnone)[^"]*"[^>]*)>/gi, (all, tag, attrs) => {
    attrs = attrs.replace(/\sstyle="[^"]*"/gi, '');
    attrs = attrs.replace(/\balign(?:left|right|none|center)\b/gi, '');
    return `<${tag}${attrs}>`;
  });

  out = out.replace(/<img\b[^>]*>/gi, (tag) => enhanceImgTag(tag, manifest));

  // Convert existing image links (including WordPress file links) into lightbox links.
  out = out.replace(/<a\b([^>]*)>\s*(<img\b[^>]*>)\s*<\/a>/gi, (all, aAttrs, img) => {
    const href = attr(aAttrs, 'href');
    const caption = /data-caption="([^"]*)"/i.exec(img)?.[1] || '';
    const enhanced = caption ? enhanceImgTag(img, manifest, caption) : img;
    return linkifyImage(enhanced, href);
  });

  // Wrap remaining bare images, skipping those already inside a link.
  out = out.replace(/<img\b[^>]*>/gi, (img, offset, whole) => {
    if (alreadyInsideLink(whole.slice(0, offset))) return img;
    return linkifyImage(img);
  });

  // Promote figcaptions onto the enclosed image and normalize the figure.
  out = out.replace(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi, (all, attrs, inner) => {
    const capMatch = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inner);
    const caption = capMatch ? plainText(capMatch[1]) : '';
    let body = inner;
    if (caption) body = body.replace(/<img\b[^>]*>/gi, (tag) => enhanceImgTag(tag, manifest, caption));
    if (caption) {
      body = body.replace(/data-caption="[^"]*"/i, `data-caption="${escapeAttr(caption)}"`);
      if (!/data-caption=/i.test(body) && /<a\b/i.test(body)) {
        body = body.replace(/<a\b/i, `<a data-caption="${escapeAttr(caption)}"`);
      }
    }
    const className = `${attr(attrs, 'class')} content-figure`.replace(/\s+/g, ' ').trim();
    attrs = setAttr(attrs.replace(/\sstyle="[^"]*"/gi, ''), 'class', className);
    return `<figure${attrs}>${body}</figure>`;
  });

  // Turn a paragraph of one image plus a typographic caption into a figure.
  out = out.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (all, inner) => {
    if ((inner.match(/<img\b/gi) || []).length !== 1) return all;
    const split = inner.match(/^([\s\S]*?)(<a\b[^>]*class="[^"]*content-photo-link[^"]*"[^>]*>\s*<img\b[^>]*>\s*<\/a>)([\s\S]*)$/i);
    if (!split) return all;
    const before = split[1].trim();
    let photo = split[2];
    const after = split[3].replace(/^(\s|<br\s*\/?>)+/gi, '').trim();
    if (!after) return all;
    const afterIsMostlyCaption = !/<img\b/i.test(after) && !/<(p|div|h[1-6]|ul|ol|table|blockquote)\b/i.test(after) && plainText(after).length > 0 && plainText(after).length < 240;
    const capStart = after.match(/^((?:<(?:em|strong|b|i)\b[^>]*>[\s\S]*?<\/(?:em|strong|b|i)>\s*(?:<br\s*\/?>\s*)?)*)/i);
    let captionHtml = '';
    let rest = '';
    if (afterIsMostlyCaption) {
      captionHtml = after;
    } else if (capStart && plainText(capStart[1]).length > 0 && plainText(capStart[1]).length < 240) {
      captionHtml = capStart[1].trim();
      rest = after.slice(capStart[0].length).replace(/^(\s|<br\s*\/?>)+/gi, '').trim();
    }
    const captionText = plainText(captionHtml);
    if (!captionText) return all;
    photo = photo.replace(/<img\b[^>]*>/i, (tag) => enhanceImgTag(tag, manifest, captionText));
    photo = photo.replace(/data-caption="[^"]*"/gi, `data-caption="${escapeAttr(captionText)}"`);
    const figure = wrapAsFigure(photo, captionHtml);
    return `${before ? `<p>${before}</p>\n` : ''}${figure}${rest ? `\n<p>${rest}</p>` : ''}`;
  });

  return out;
}
