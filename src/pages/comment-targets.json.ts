import { getPosts, getPages, RESERVED_SLUGS } from '../lib/directus';

export async function GET() {
  const [pages, posts] = await Promise.all([getPages(), getPosts()]);
  const targets: Record<string, {kind: string; id: number}> = Object.create(null);
  for (const [kind, items] of [['page', pages], ['post', posts]] as const) {
    for (const {id, slug} of items) {
      if (id && slug && !RESERVED_SLUGS.has(slug) && !targets[slug]) targets[slug] = {kind, id};
    }
  }
  return Response.json(targets);
}
