import { riverPhoto } from './river-photos';
import { defaultLanguage, type Language } from './languages';
import { taxonomyName } from './spanish';
/**
 * Directus API client for the Rivers of Chile static site.
 * Hosted builds fetch published roc_* collections over HTTPS with a scoped
 * read-only token. Local builds without a token use data/snapshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { registerFiles, registeredCount, fileById, assetById, publicUrlFor, registerAvatar } from './file-registry.mjs';
import { guidePhoto, loadImageManifest, publicBase, pickDisplay, publicObjectKey } from './legacy-images.mjs';

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'https://content.fieldsmarshall.com';
const DIRECTUS_BUILD_TOKEN = process.env.DIRECTUS_BUILD_TOKEN?.trim();
const HOSTED_BUILD = process.env.CI === 'true' || process.env.CF_PAGES === '1' || process.env.RENDER === 'true';
const REQUIRED_CONTENT = new Set(['roc_posts', 'roc_pages', 'roc_comments']);
const SNAPSHOT_DIR = path.resolve('data/snapshot');

export interface AuthorItem {
  id?: number;
  wp_user_id: number;
  status: string;
  name: string;
  slug: string;
  bio?: string | null;
  avatar?: string | null; // Directus file id
}

export interface CategoryItem {
  id?: number;
  wp_id: number;
  status: string;
  slug: string;
  name: string;
  type?: string;
  parent_wp_id?: number | null;
  count?: number;
}

export interface TagItem {
  id?: number;
  wp_id: number;
  status: string;
  slug: string;
  name: string;
  count?: number;
}

export interface PostItem {
  id?: number;
  wp_id: number;
  status: string;
  kind: 'river' | 'news' | 'article' | string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  published_at?: string;
  updated_at?: string;
  author_wp_id?: number;
  author_name?: string | null;
  author_slug?: string | null;
  featured_media_wp_id?: number | null;
  featured_image?: string | null; // Directus file id (File Library)
  featured_image_url?: string | null; // derived at build from featured_image, else legacy WordPress URL
  seo_title?: string | null;
  seo_description?: string | null;
  country?: string | null;
  region?: string | null;
  class_min?: number | null;
  class_max?: number | null;
  class_label?: string | null;
  put_in?: string | null;
  take_out?: string | null;
  length_km?: number | null;
  gradient?: string | null;
  season?: string | null;
  last_verified?: string | null;
  lat?: number | null;
  lng?: number | null;
  legacy_categories?: string[];
  legacy_tags?: string[];
  tag_wp_ids?: number[];
  category_wp_ids?: number[];
}

export interface PageItem {
  id?: number;
  wp_id: number;
  status: string;
  title: string;
  slug: string;
  content?: string;
  page_template?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string;
  updated_at?: string;
  author_wp_id?: number;
}

const FILE_MAP: Record<string, string> = {
  roc_comments: 'comments.json',
  roc_posts: 'posts.json',
  roc_pages: 'pages.json',
  roc_categories: 'categories.json',
  roc_tags: 'tags.json',
  roc_authors: 'authors.json',
  roc_media: 'media.json'
};

// A static build should read each collection once. Local development reads it on demand.
const buildReads = new Map<string, Promise<unknown[]>>();
async function fetchDirectus<T>(collection: string): Promise<T[]> {
  if (import.meta.env.DEV) return readCollection<T>(collection);
  let pending = buildReads.get(collection);
  if (!pending) {
    pending = readCollection(collection);
    buildReads.set(collection, pending);
  }
  // Image and translation helpers can modify records while rendering a language.
  return structuredClone(await pending) as T[];
}

async function readCollection<T>(collection: string): Promise<T[]> {
  const required = REQUIRED_CONTENT.has(collection);
  const remoteBuild = HOSTED_BUILD || Boolean(DIRECTUS_BUILD_TOKEN);
  if (HOSTED_BUILD && !DIRECTUS_BUILD_TOKEN) {
    throw new Error('Hosted build needs DIRECTUS_BUILD_TOKEN with read-only access to published roc_* content.');
  }

  let failure = 'request failed';
  if (DIRECTUS_BUILD_TOKEN) {
    const endpoint = new URL(DIRECTUS_URL);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
      throw new Error('DIRECTUS_URL must be an HTTPS endpoint without embedded credentials.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(`/items/${collection}`, endpoint);
      url.searchParams.set('limit', '-1');
      if (collection === 'roc_comments') {
        url.searchParams.set('fields', 'id,wp_id,parent_wp_id,status,author_name,content,original_language,published_at,post.slug,page.slug');
      }
      if (required) url.searchParams.set('filter[status][_eq]', 'published');
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${DIRECTUS_BUILD_TOKEN}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && (json.data.length > 0 || collection === 'roc_comments')) {
          return json.data as T[];
        }
        failure = 'empty or invalid response';
      } else {
        failure = `HTTP ${res.status}`;
      }
    } catch {
      // Do not log credentials, environment values, URLs, or response bodies.
    } finally {
      clearTimeout(timeout);
    }
  }
  if (remoteBuild && required) {
    throw new Error(`Cannot build required published collection ${collection}: ${failure}.`);
  }

  try {
    const targetFile = FILE_MAP[collection];
    if (targetFile) {
      const fullPath = path.join(SNAPSHOT_DIR, targetFile);
      if (fs.existsSync(fullPath)) {
        return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T[];
      }
    }
  } catch {
    // Fall through to the required-collection error below.
  }

  if (required) throw new Error(`Missing local snapshot for required collection ${collection}.`);
  return [];
}

function requirePublished<T extends { status: string; slug: string; title: string }>(items: T[], collection: string): T[] {
  const published = items.filter((item) => item.status === 'published' || item.status === 'publish');
  if (published.length === 0 || published.some((item) => !item.slug?.trim() || !item.title?.trim())) {
    throw new Error(`Invalid published content for ${collection}: expected named, routable entries.`);
  }
  return published;
}

/**
 * Load the Directus File Library (River Sites folder tree) once per build and
 * register it for image helpers. Uses the same read-only build token.
 */
let filesLoaded: Promise<void> | undefined;
function loadFileLibrary(): Promise<void> {
  filesLoaded ||= (async () => {
    if (!DIRECTUS_BUILD_TOKEN) return; // local snapshot builds keep legacy URLs
    try {
      const endpoint = new URL(DIRECTUS_URL);
      const url = new URL('/files', endpoint);
      url.searchParams.set('limit', '-1');
      url.searchParams.set('fields', 'id,storage,filename_disk,type,width,height,filesize,title,description,metadata,folder');
      const res = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'application/json', Authorization: `Bearer ${DIRECTUS_BUILD_TOKEN}` }
      });
      if (res.ok) registerFiles((await res.json()).data || []);
    } catch {
      // Fall back to legacy image URLs; never log URLs or credentials.
    }
    if (HOSTED_BUILD && registeredCount() === 0) {
      throw new Error('Hosted build could not load the Directus File Library.');
    }
  })();
  return filesLoaded;
}

/** Resolve featured_image (file id) to the public R2 URL; legacy URL otherwise. */
function applyFileFields<T extends { featured_image?: string | null; featured_image_url?: string | null }>(items: T[]): T[] {
  const base = publicBase(loadImageManifest());
  for (const item of items) {
    const file = item.featured_image ? fileById(item.featured_image) : undefined;
    if (file) {
      // Use a ~1200px display variant, never the camera original.
      const asset = assetById(item.featured_image!);
      const pick = asset ? pickDisplay(asset) : undefined;
      item.featured_image_url = pick ? `${base}/${publicObjectKey(pick.key)}` : publicUrlFor(file, base);
    }
  }
  return items;
}

// Each reviewed export is a locale directory. No private database access is required at build time.
const editions = import.meta.glob<Record<string, Partial<PostItem>>>('../../data/*/{posts,pages}.json', {eager: true, import: 'default'});

function localizedItems<T extends PageItem | PostItem>(items: T[], language: Language, kind: 'posts' | 'pages'): T[] {
  if (language === defaultLanguage) return items;
  const translations = editions[`../../data/${language}/${kind}.json`];
  if (!translations) throw new Error(`Missing reviewed ${language} export for ${kind}`);
  return items.map((item) => {
    const translated = translations[item.slug];
    if (translated?.title && typeof translated.content === 'string') return { ...item, ...translated };
    return { ...item, seo_title: null, seo_description: null, excerpt: '', content:
      '<p>La traducción de esta página aún no está disponible. Puedes leer el original seleccionando English.</p>' };
  });
}

export async function getPosts(language: Language = defaultLanguage): Promise<PostItem[]> {
  const items = await fetchDirectus<PostItem>('roc_posts');
  await loadFileLibrary();
  await loadAvatars();
  applyFileFields(items);
  const photos = loadImageManifest();
  for (const item of items) {
    const selection = item.kind === 'river' ? riverPhoto(item) : undefined;
    item.featured_image_url = selection?.image ?? guidePhoto(photos, item);
  }
  return localizedItems(requirePublished(items, 'roc_posts'), language, 'posts').sort((a, b) => a.title.localeCompare(b.title));
}

async function loadAvatars(): Promise<void> {
  const base = publicBase(loadImageManifest());
  const authors = await fetchDirectus<AuthorItem>('roc_authors');
  for (const a of authors) {
    const file = a.avatar ? fileById(a.avatar) : undefined;
    if (file) registerAvatar(a.name, publicUrlFor(file, base));
  }
}

export async function getPages(language: Language = defaultLanguage): Promise<PageItem[]> {
  const items = await fetchDirectus<PageItem>('roc_pages');
  await loadFileLibrary();
  return localizedItems(requirePublished(items, 'roc_pages'), language, 'pages');
}

export async function getCategories(es = false): Promise<CategoryItem[]> {
  const items = await fetchDirectus<CategoryItem>('roc_categories');
  const published = items.filter((item) => item.status === 'published' || !item.status);
  return es ? published.map((item) => ({...item, name: taxonomyName(item.name)})) : published;
}

export async function getTags(es = false): Promise<TagItem[]> {
  const items = await fetchDirectus<TagItem>('roc_tags');
  const published = items.filter((item) => item.status === 'published' || !item.status);
  return es ? published.map((item) => ({...item, name: taxonomyName(item.name)})) : published;
}

export async function getAuthors(): Promise<AuthorItem[]> {
  const items = await fetchDirectus<AuthorItem>('roc_authors');
  return items.filter((item) => item.status === 'published' || !item.status);
}

export const RESERVED_SLUGS = new Set([
  'rivers',
  'index',
  'es',
  'home-2',
  'home-3',
  '404',
  'category',
  'tag',
  'news',
  'region',
  'class',
  'photo-credits',
  'robots.txt',
  'sitemap',
  'sitemap-index',
  'feed',
  '_redirects',
  '_headers'
]);

export interface CommentItem {
  original_language?: string | null;
  id: number;
  wp_id: number | null;
  parent_wp_id: number | null;
  author_name: string | null;
  content: string | null;
  published_at: string | null;
  status: string;
  post: { slug: string } | null;
  page: { slug: string } | null;
}

export async function getComments(): Promise<CommentItem[]> {
  const items = await fetchDirectus<CommentItem>('roc_comments');
  return items.filter(item => item.status === 'published').sort((a, b) =>
    (a.published_at || '').localeCompare(b.published_at || '') || a.id - b.id);
}

// WordPress encoded a soft hyphen into one legacy tag slug.
export function tagPathSlug(slug: string): string {
  return slug.replace(/%c2%ad/gi, '');
}
