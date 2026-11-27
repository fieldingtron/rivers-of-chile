import type { PostItem } from './directus';

const checkedRegions: Record<string, string> = {
  'rio-bullileo': 'region-vii',
  'rio-longavi': 'region-vii',
  'rio-melado': 'region-vii',
  'rio-achibueno': 'region-vii',
  'rio-ancoa': 'region-vii',
  'rio-renegado': 'nuble',
  'rio-ralco': 'region-viii',
  'rio-laja-2': 'region-viii',
  'rio-laja-salto-las-chilcas': 'region-viii'
};

export function guideRegion(post: PostItem) {
  if (post.country && post.country.toLowerCase() !== 'chile') return undefined;
  return checkedRegions[post.slug] || post.region || undefined;
}

export function bullileoBody(content: string) {
  return content.replace(/\bLos R[ií]os Region\b/gi, 'Maule Region').replace(/\bregión de Los Ríos\b/gi, 'región del Maule');
}
