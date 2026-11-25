import selections from '../../data/river-featured-photos.json';

export function riverPhoto(slug: string) {
  return Object.hasOwn(selections, slug) ? selections[slug as keyof typeof selections] : undefined;
}
