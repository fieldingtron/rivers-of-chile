/** Shared WordPress REST → roc_* mapping. No network, no secrets. */

export const NEWS_CATEGORY_ID = 158;
export const CLASS_SLUG = /^class-(\d)$/;
export const REGION_SLUGS = new Set([
  'region-v',
  'region-vi',
  'region-vii',
  'region-viii',
  'region-ix',
  'region-x',
  'region-xi',
  'region-xiv-de-los-rios',
  'santiago-metropolitan-region'
]);
export const COUNTRY_SLUGS = {
  chile: 'chile',
  argentina: 'argentina',
  brasil: 'brazil',
  brazil: 'brazil'
};

export function decodeEntities(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013');
}

export function rendered(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.rendered || '';
}

export function categoryType(slug) {
  if (CLASS_SLUG.test(slug)) return 'class';
  if (REGION_SLUGS.has(slug)) return 'region';
  if (slug in COUNTRY_SLUGS) return 'country';
  if (slug === 'news') return 'news';
  return 'topic';
}

export function classifyKind(post, categoriesById) {
  const cats = (post.categories || []).map((id) => categoriesById.get(id)).filter(Boolean);
  if (cats.some((c) => c.id === NEWS_CATEGORY_ID || c.slug === 'news')) return 'news';
  if (cats.some((c) => CLASS_SLUG.test(c.slug))) return 'river';
  const slug = post.slug || '';
  if (/^(rio|estero)-/.test(slug)) return 'river';
  return 'article';
}

export function classRange(post, categoriesById) {
  const fromCats = (post.categories || [])
    .map((id) => categoriesById.get(id))
    .filter(Boolean)
    .map((c) => {
      const m = c.slug.match(CLASS_SLUG);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => n != null);
  let min = fromCats.length ? Math.min(...fromCats) : null;
  let max = fromCats.length ? Math.max(...fromCats) : null;
  const text = decodeEntities(rendered(post.content).replace(/<[^>]+>/g, ' ')).slice(0, 500);
  const m = text.match(/class\s+(\d)\s*(?:-|to|\/)\s*(\d)/i) || text.match(/class\s+(\d)/i);
  if (m) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    min = min == null ? Math.min(a, b) : Math.min(min, a, b);
    max = max == null ? Math.max(a, b) : Math.max(max, a, b);
  }
  const label = min == null ? null : min === max ? String(min) : `${min}-${max}`;
  return { class_min: min, class_max: max, class_label: label };
}

export function countryOf(post, categoriesById) {
  for (const id of post.categories || []) {
    const c = categoriesById.get(id);
    if (c && c.slug in COUNTRY_SLUGS) return COUNTRY_SLUGS[c.slug];
  }
  return null;
}

export function regionSlugOf(post, categoriesById) {
  for (const id of post.categories || []) {
    const c = categoriesById.get(id);
    if (c && REGION_SLUGS.has(c.slug)) return c.slug;
  }
  return null;
}

export function slugifyName(name) {
  return decodeEntities(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'author';
}

export function yoast(item) {
  return item.yoast_head_json || {};
}

export function mapCategory(c) {
  return {
    wp_id: c.id,
    status: 'published',
    slug: c.slug,
    name: decodeEntities(rendered(c.name) || c.name),
    type: categoryType(c.slug),
    parent_wp_id: c.parent || null,
    count: c.count || 0
  };
}

export function mapTag(t) {
  return {
    wp_id: t.id,
    status: 'published',
    slug: t.slug,
    name: decodeEntities(rendered(t.name) || t.name),
    count: t.count || 0
  };
}

export function mapAuthor(wpUserId, name) {
  const decoded = decodeEntities(name || '') || `user-${wpUserId}`;
  return {
    wp_user_id: wpUserId,
    status: 'published',
    name: decoded,
    slug: slugifyName(decoded),
    bio: null
  };
}

export function mapPost(post, { categoriesById, mediaById, authorsByWpId }) {
  const y = yoast(post);
  const { class_min, class_max, class_label } = classRange(post, categoriesById);
  const featuredId = post.featured_media || 0;
  const featured = featuredId && mediaById ? mediaById.get(featuredId) : null;
  const authorName = y.author || null;
  const author = authorsByWpId?.get(post.author);
  return {
    wp_id: post.id,
    status: post.status === 'publish' ? 'published' : 'draft',
    kind: classifyKind(post, categoriesById),
    title: decodeEntities(rendered(post.title)),
    slug: post.slug,
    content: rendered(post.content),
    excerpt: decodeEntities(rendered(post.excerpt).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    published_at: post.date,
    updated_at: post.modified,
    author_wp_id: post.author,
    author_name: author?.name || authorName,
    author_slug: author?.slug || (authorName ? slugifyName(authorName) : null),
    featured_media_wp_id: featuredId || null,
    featured_image_url: featured?.source_url || y.og_image?.[0]?.url || null,
    seo_title: y.title ? decodeEntities(y.title) : null,
    seo_description: y.description ? decodeEntities(y.description) : null,
    country: countryOf(post, categoriesById),
    region: regionSlugOf(post, categoriesById),
    class_min,
    class_max,
    class_label,
    put_in: null,
    take_out: null,
    length_km: null,
    gradient: null,
    season: null,
    last_verified: null,
    lat: null,
    lng: null,
    legacy_categories: (post.categories || [])
      .map((id) => categoriesById.get(id)?.slug)
      .filter(Boolean),
    legacy_tags: post._tag_slugs || [],
    tag_wp_ids: post.tags || [],
    category_wp_ids: post.categories || []
  };
}

export function mapPage(page) {
  const y = yoast(page);
  const template = page.template || '';
  let page_template = 'default';
  if (template.includes('river-map') || page.slug === 'map-of-chile') page_template = 'river_map';
  else if (template.includes('sitemap') || page.slug === 'site-map') page_template = 'sitemap';
  else if (page.slug === 'contact-us') page_template = 'contact';
  return {
    wp_id: page.id,
    status: page.status === 'publish' ? 'published' : 'draft',
    title: decodeEntities(rendered(page.title)),
    slug: page.slug,
    content: rendered(page.content),
    page_template,
    seo_title: y.title ? decodeEntities(y.title) : null,
    seo_description: y.description ? decodeEntities(y.description) : null,
    published_at: page.date,
    updated_at: page.modified,
    author_wp_id: page.author
  };
}

export function mapMedia(m) {
  const details = m.media_details && typeof m.media_details === 'object' ? m.media_details : {};
  return {
    wp_id: m.id,
    status: 'pending',
    source_url: m.source_url,
    filename: m.filename || (m.source_url || '').split('/').pop(),
    mime: m.mime_type,
    bytes: m.filesize || details.filesize || null,
    width: details.width || null,
    height: details.height || null,
    alt: m.alt_text || '',
    caption: decodeEntities(rendered(m.caption)),
    attached_to_wp_id: m.post || null,
    sha256: null,
    r2_key: null,
    variants: null,
    referenced: false
  };
}

export function buildIndexes({ categories = [], tags = [], posts = [], pages = [], media = [], authorsFromYoast = {} }) {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const authorsByWpId = new Map();
  for (const post of posts) {
    const name = yoast(post).author || authorsFromYoast[String(post.author)] || authorsFromYoast[post.author];
    if (post.author && name && !authorsByWpId.has(post.author)) {
      authorsByWpId.set(post.author, mapAuthor(post.author, name));
    }
  }
  for (const page of pages) {
    const name = yoast(page).author || authorsFromYoast[String(page.author)] || authorsFromYoast[page.author];
    if (page.author && name && !authorsByWpId.has(page.author)) {
      authorsByWpId.set(page.author, mapAuthor(page.author, name));
    }
  }
  const postsMapped = posts.map((p) => {
    const tagSlugs = (p.tags || []).map((id) => tagsById.get(id)?.slug).filter(Boolean);
    return mapPost({ ...p, _tag_slugs: tagSlugs }, { categoriesById, mediaById, authorsByWpId });
  });
  return {
    categories: categories.map(mapCategory),
    tags: tags.map(mapTag),
    authors: [...authorsByWpId.values()],
    posts: postsMapped,
    pages: pages.map(mapPage),
    media: media.map(mapMedia)
  };
}
