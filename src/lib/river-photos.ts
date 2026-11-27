import selections from '../../data/river-featured-photos.json';
import { assetById, fileById, publicKeyOf, publicUrlFor } from './file-registry.mjs';
import { guideHeading } from './guide-seo';
import { loadImageManifest, publicBase } from './legacy-images.mjs';
import type { PostItem } from './directus';

export interface RiverPhoto {
  title: string;
  image: string;
  listing: string;
  full: string;
  source?: string;
  credit?: string;
  license?: string;
  licenseUrl?: string;
  location?: string;
  locationEs?: string;
  match?: string;
  matchEs?: string;
  original?: string;
  representative?: boolean;
  width?: number;
  height?: number;
  directusKey?: string;
  description?: string;
}

const photos: Record<string, RiverPhoto> = selections;
const base = publicBase(loadImageManifest());

export function riverPhoto(post: PostItem): RiverPhoto | undefined {
  const curated = Object.hasOwn(photos, post.slug) ? photos[post.slug] : undefined;
  const file = post.featured_image ? fileById(post.featured_image) : undefined;
  if (!file || file.storage !== 'r2' || !file.type?.startsWith('image/')) return curated;

  if (curated) {
    if (publicKeyOf(file.filename_disk) === curated.directusKey) return curated;
    const variants = assetById(file.id)?.variants || [];
    if (!curated.full.startsWith('/') && variants.some((variant: { key: string }) =>
      publicKeyOf(variant.key) === new URL(curated.full).pathname.slice(1)
    )) return curated;
  }

  const image = publicUrlFor(file, base);
  return {
    image, full: image, listing: image,
    title: file.metadata?.alt?.trim() || file.title?.trim() || guideHeading(post.slug, post.title),
    description: file.description?.trim() || file.metadata?.caption?.trim(),
    width: file.width || undefined,
    height: file.height || undefined
  };
}

export function riverPhotoAlt(photo: RiverPhoto, es: boolean) {
  if (!photo.representative) return photo.title;
  return [es ? 'Foto de referencia' : 'Representative photo', riverPhotoLocation(photo, es)].filter(Boolean).join(' · ');
}

export function riverPhotoLocation(photo: RiverPhoto, es: boolean) {
  return es ? photo.locationEs || photo.location : photo.location;
}
