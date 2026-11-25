import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const production = site?.hostname === 'www.riversofchile.com';
  const robots = production ? `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap-index.xml', site)}\n` : `User-agent: *
Disallow: /
`;
  return new Response(robots, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
