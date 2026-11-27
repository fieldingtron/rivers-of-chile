import type { PostItem } from './directus';
import { guideRegion } from './guide-regions';
import { relatedRiverGroups } from './river-guide.mjs';

export function relatedGuides(post: PostItem, rivers: PostItem[]) {
  const preferred = post.slug === 'rio-bullileo'
    ? ['rio-longavi', 'rio-melado', 'rio-achibueno', 'rio-ancoa'] : [];
  return relatedRiverGroups(post, rivers, guideRegion, preferred);
}
