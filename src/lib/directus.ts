/**
 * Directus API client for the Rivers of Chile static site.
 * Hosted builds fetch published roc_* collections over HTTPS with a scoped
 * read-only token. Local builds without a token use data/snapshot.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'https://content.fieldsmarshall.com';
const DIRECTUS_BUILD_TOKEN = process.env.DIRECTUS_BUILD_TOKEN?.trim();
const HOSTED_BUILD = process.env.CI === 'true' || process.env.CF_PAGES === '1' || process.env.RENDER === 'true';
const REQUIRED_CONTENT = new Set(['roc_posts', 'roc_pages']);
const SNAPSHOT_DIR = path.resolve('data/snapshot');

export interface AuthorItem {
  id?: number;
  wp_user_id: number;
  status: string;
  name: string;
  slug: string;
  bio?: string | null;
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
  featured_image_url?: string | null;
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

export interface RedirectItem {
  url_from: string;
  url_to: string;
  type?: string;
  status?: string;
}

const FILE_MAP: Record<string, string> = {
  roc_posts: 'posts.json',
  roc_pages: 'pages.json',
  roc_categories: 'categories.json',
  roc_tags: 'tags.json',
  roc_authors: 'authors.json',
  roc_redirects: 'redirects.json',
  roc_media: 'media.json'
};

async function fetchDirectus<T>(collection: string): Promise<T[]> {
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
        if (Array.isArray(json.data) && json.data.length > 0) {
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

export async function getPosts(): Promise<PostItem[]> {
  const items = await fetchDirectus<PostItem>('roc_posts');
  return requirePublished(items, 'roc_posts').sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPages(): Promise<PageItem[]> {
  const items = await fetchDirectus<PageItem>('roc_pages');
  return requirePublished(items, 'roc_pages');
}

export async function getCategories(): Promise<CategoryItem[]> {
  const items = await fetchDirectus<CategoryItem>('roc_categories');
  return items.filter((item) => item.status === 'published' || !item.status);
}

export async function getTags(): Promise<TagItem[]> {
  const items = await fetchDirectus<TagItem>('roc_tags');
  return items.filter((item) => item.status === 'published' || !item.status);
}

export async function getAuthors(): Promise<AuthorItem[]> {
  const items = await fetchDirectus<AuthorItem>('roc_authors');
  return items.filter((item) => item.status === 'published' || !item.status);
}

export async function getRedirectRules(): Promise<RedirectItem[]> {
  return fetchDirectus<RedirectItem>('roc_redirects');
}

export const RESERVED_SLUGS = new Set([
  'index',
  'home-2',
  'home-3',
  '404',
  'category',
  'tag',
  'news',
  'rivers',
  'robots.txt',
  'sitemap',
  'sitemap-index',
  'feed',
  '_redirects',
  '_headers'
]);
