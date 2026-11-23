/**
 * Public image origin: serve objects from the riversofchile-images R2 bucket
 * at https://riversofchile-images.pages.dev/<key>
 */
function headers(contentType) {
  const h = new Headers();
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (contentType) h.set('Content-Type', contentType);
  return h;
}

export async function onRequestGet(context) {
  const raw = context.params.path;
  const key = Array.isArray(raw) ? raw.join('/') : raw || '';
  if (!key || key.endsWith('/')) {
    return new Response('Not found', { status: 404, headers: headers('text/plain; charset=utf-8') });
  }
  if (!context.env.MEDIA) {
    return new Response('Media binding is not configured', { status: 503, headers: headers('text/plain; charset=utf-8') });
  }
  const object = await context.env.MEDIA.get(key);
  if (!object) {
    return new Response('Not found', { status: 404, headers: headers('text/plain; charset=utf-8') });
  }
  return new Response(object.body, {
    headers: headers(object.httpMetadata?.contentType || 'application/octet-stream')
  });
}
