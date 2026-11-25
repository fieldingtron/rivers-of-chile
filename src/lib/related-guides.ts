import type { PostItem } from './directus';

export function relatedGuides(post: PostItem, rivers: PostItem[]) {
  const others = rivers.filter(p => p.slug !== post.slug);
  const region = post.region;
  const nearby = region ? others.filter(p => p.region === region).slice(0, 3) : [];
  const remaining = others.filter(p => !nearby.includes(p));
  const grade = post.legacy_categories?.find(slug =>
    /^class-\d+$/.test(slug) && remaining.some(p => p.legacy_categories?.includes(slug)));
  const similar = grade ? remaining.filter(p => p.legacy_categories?.includes(grade)).slice(0, 3) : [];
  return { region, nearby, grade, similar };
}
