import { riverPhoto } from './river-photos';
import { avatarFor } from './file-registry.mjs';
import { loadImageManifest, assetFor, variantUrl, featuredImageUrl, displayVariants, pickDisplay } from './legacy-images.mjs';
import type { PostItem } from './directus';

const manifest = loadImageManifest();

const REGIONS: Record<string, { label: string; order: number; roman: string }> = {
  'region-v': { label: 'Valparaíso', order: 5, roman: 'V' },
  'santiago-metropolitan-region': { label: 'Santiago Metropolitan', order: 6, roman: 'RM' },
  'region-vi': { label: "O'Higgins", order: 7, roman: 'VI' },
  'region-vii': { label: 'Maule', order: 8, roman: 'VII' },
  'region-viii': { label: 'Biobío', order: 9, roman: 'VIII' },
  'region-ix': { label: 'La Araucanía', order: 10, roman: 'IX' },
  'region-xiv-de-los-rios': { label: 'Los Ríos', order: 11, roman: 'XIV' },
  'region-x': { label: 'Los Lagos', order: 12, roman: 'X' },
  'region-xi': { label: 'Aysén', order: 13, roman: 'XI' }
};

export function regionLabel(post: PostItem): string {
  if (post.region && REGIONS[post.region]) return REGIONS[post.region].label;
  if (post.country) return post.country.charAt(0).toUpperCase() + post.country.slice(1);
  return 'Chile';
}

export function regionList(posts: PostItem[]) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const slug of guideRegions(post)) counts.set(slug, (counts.get(slug) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count, ...REGIONS[slug] }))
    .sort((a, b) => a.order - b.order); // north (V) to south (XI)
}

export function stripHtml(html = ''): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function excerptOf(post: PostItem, max = 150): string {
  const text = stripHtml(post.excerpt || post.content || '');
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

export function initials(name?: string | null): string {
  const parts = String(name || 'RC').replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return ((parts[0]?.[0] || 'R') + (parts[1]?.[0] || '')).toUpperCase();
}

export function authorLabel(name?: string | null): string {
  return String(name || 'Rivers of Chile').replace(/\s*\(posthumously\)/i, '').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pick an R2 variant at least `width` wide (falls back to the largest, capped at 2400px). */
export function imageAt(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  const asset = assetFor(manifest, url);
  if (!asset?.variants?.length) return url;
  const pick = pickDisplay(asset, width) || asset.variants[0];
  return variantUrl(manifest, pick);
}

export function fullImage(url: string | null | undefined): string | undefined {
  return featuredImageUrl(manifest, url || undefined) || undefined;
}

export function imageCount(post: PostItem): number {
  return (post.content?.match(/<img/gi) || []).length;
}

/** "Popular" = real guides with a photo, a written excerpt and plenty of photography. */
export function popularRivers(posts: PostItem[], n: number): PostItem[] {
  const rivers = posts.filter((p) => p.kind === 'river' && p.featured_image_url && p.slug && !riverPhoto(p)?.representative);
  const scored = rivers
    .map((p) => ({ p, s: imageCount(p) * 3 + Math.min((p.content || '').length / 1500, 8) + (p.class_label ? 1 : 0) }))
    .sort((a, b) => b.s - a.s);
  const out: PostItem[] = [];
  const seenRegions = new Map<string, number>();
  for (const { p } of scored) {
    const key = p.region || p.country || 'x';
    if ((seenRegions.get(key) || 0) >= 2) continue;
    seenRegions.set(key, (seenRegions.get(key) || 0) + 1);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

export function classBuckets(posts: PostItem[]) {
  const buckets: Record<string, PostItem[]> = { 'Class 2–3': [], 'Class 3–4': [], 'Class 4–5': [], 'Class 5': [] };
  for (const p of posts.filter((x) => x.kind === 'river')) {
    const max = Number(p.class_max || 0);
    const min = Number(p.class_min || 0);
    if (!max) continue;
    if (max >= 5 && min >= 5) buckets['Class 5'].push(p);
    else if (max >= 5) buckets['Class 4–5'].push(p);
    else if (max >= 4) buckets['Class 3–4'].push(p);
    else buckets['Class 2–3'].push(p);
  }
  return buckets;
}

export const SITE_NAV = [
  { href: '/rivers/', label: 'Rivers' },
  { href: '/region/', label: 'Region' },
  { href: '/class/', label: 'Difficulty' },
  { href: '/map-of-chile/', label: 'Map' }
];

const REGION_GUIDE: Record<string, string> = {
  'region-v': 'Region V',
  'santiago-metropolitan-region': 'Santiago Metropolitan Region',
  'region-vi': 'Region VI',
  'region-vii': 'Region VII',
  'region-viii': 'Region VIII',
  'region-ix': 'Region IX',
  'region-xiv-de-los-rios': 'Region XIV De Los Rios',
  'region-x': 'Region X',
  'region-xi': 'Region XI'
};

/** Category-style region labels as stored in the content (e.g. "Region VIII"). */
export function regionGuideLabel(post: PostItem): string {
  if (post.region && REGION_GUIDE[post.region]) return REGION_GUIDE[post.region];
  if (post.country) return post.country.charAt(0).toUpperCase() + post.country.slice(1);
  return 'Chile';
}

/** Solid badge color by the highest class number in a label such as "3-5". */
export function classBadgeColor(label?: string | null): string {
  const nums = String(label || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const max = nums.length ? Math.max(...nums) : 0;
  if (max >= 5) return '#dc2626';
  if (max >= 4) return '#ea580c';
  if (max >= 3) return '#ca8a04';
  return '#16a34a';
}

const AUTHOR_PHOTOS: Record<string, string> = {
  'kurt casey': '/images/kurt-casey.jpg'
};

function authorKey(name?: string | null): string {
  return String(name || '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Local author portrait if we have one; Directus has no avatar field. */
export function authorPhoto(name?: string | null): string | undefined {
  return avatarFor(name) || AUTHOR_PHOTOS[authorKey(name)];
}

// Preserve the original guide's region memberships, including runs in two regions.
export function guideRegions(post: PostItem): string[] {
  if (post.country && post.country.toLowerCase() !== 'chile') return [];
  return [...new Set([post.region, ...(post.legacy_categories || [])])]
    .filter((slug): slug is string => Boolean(slug && REGIONS[slug]));
}

export function guideClasses(post: PostItem): string[] {
  const categories = (post.legacy_categories || []).filter(slug => /^class-[1-6]$/.test(slug));
  if (categories.length) return categories;
  const min = Number(post.class_min || post.class_max);
  const max = Number(post.class_max || post.class_min);
  return [1, 2, 3, 4, 5, 6].filter(n => n >= min && n <= max).map(n => 'class-' + n);
}
