import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const robots = `User-agent: *
Disallow: /
`;
  return new Response(robots, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
