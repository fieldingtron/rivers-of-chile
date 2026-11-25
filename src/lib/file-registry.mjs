/**
 * Directus File Library registry (build time).
 *
 * Images are native Directus files (directus_files) stored in R2. At build
 * time directus.ts loads the Rivers of Chile folder once and registers every
 * file here so image helpers can resolve: file id, public R2 key, any
 * variant key, or legacy sha256, back to one asset with alt/caption/variants.
 * Public URL rule: <R2 public base>/<filename_disk>.
 */
const byId = new Map();
const byKey = new Map();
const bySha = new Map();
const avatars = new Map();

export function publicKeyOf(value) {
  return String(value || '').replace(/^migrated-media\//, '');
}

function assetOf(file) {
  const meta = file.metadata || {};
  const original = {
    key: file.filename_disk,
    width: file.width || undefined,
    height: file.height || undefined,
    bytes: Number(file.filesize) || undefined,
    mime: file.type,
    kind: 'original'
  };
  let variants = Array.isArray(meta.variants) && meta.variants.length ? meta.variants : [original];
  if (!variants.some((v) => publicKeyOf(v.key) === file.filename_disk)) variants = [...variants, original];
  const description = (file.description || '').trim();
  return {
    id: file.id,
    sha256: meta.sha256 || undefined,
    mime: file.type,
    width: file.width || undefined,
    height: file.height || undefined,
    alt: (description || meta.alt || '').trim(),
    caption: description || (meta.caption || '').trim(),
    variants
  };
}

export function registerFiles(files) {
  for (const file of files || []) {
    if (!file?.id || file.storage !== 'r2' || !file.filename_disk) continue;
    const asset = assetOf(file);
    byId.set(file.id, { file, asset });
    for (const v of asset.variants) byKey.set(publicKeyOf(v.key), asset);
    if (asset.sha256) bySha.set(asset.sha256, asset);
  }
}

export function registeredCount() {
  return byId.size;
}

export function fileById(id) {
  return byId.get(id)?.file;
}

export function assetById(id) {
  return byId.get(id)?.asset;
}

export function assetByKey(key) {
  return byKey.get(publicKeyOf(key));
}

export function assetBySha(sha) {
  return bySha.get(sha);
}

export function publicUrlFor(file, base) {
  return `${String(base).replace(/\/$/, '')}/${file.filename_disk}`;
}

export function registerAvatar(name, url) {
  const key = String(name || '').replace(/\(.*?\)/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (key && url) avatars.set(key, url);
}

export function avatarFor(name) {
  const key = String(name || '').replace(/\(.*?\)/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  return avatars.get(key);
}

/**
 * Editors who insert an image with the Directus WYSIWYG get
 * <img src="https://<directus>/assets/<file id>?...">. Point those at the
 * public R2 URL so the static site never depends on Directus at runtime.
 */
export function rewriteDirectusAssets(html, base) {
  if (!html) return html || '';
  return html.replace(/(?:https?:\/\/[^"'\s/]+)?\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.[a-z0-9]+)?(?:\?[^"'\s<]*)?/gi, (all, id) => {
    const file = fileById(id.toLowerCase());
    return file ? publicUrlFor(file, base) : all;
  });
}
