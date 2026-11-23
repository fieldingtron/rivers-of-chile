/**
 * Public image origin: serve objects from the riversofchile-images R2 bucket
 * at https://riversofchile-images.pages.dev/<filename>
 *
 * Objects were uploaded under the migrated-media/ prefix. Public URLs omit
 * that prefix. Requests to /migrated-media/<file> still work (alias).
 * Supports HTTP Range so large videos (e.g. the Chillán MP4) can seek.
 */
const PREFIX = 'migrated-media/';

function baseHeaders(contentType) {
  const h = new Headers();
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('Accept-Ranges', 'bytes');
  if (contentType) h.set('Content-Type', contentType);
  return h;
}

function cacheHeaders(h, immutable) {
  h.set('Cache-Control', immutable
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=31536000, immutable');
  return h;
}

function candidatesFor(key) {
  const out = [];
  const add = (k) => {
    if (k && !out.includes(k)) out.push(k);
  };
  add(key);
  if (key.startsWith(PREFIX)) add(key.slice(PREFIX.length));
  else add(PREFIX + key);
  return out;
}

function parseRange(header, size) {
  if (!header) return null;
  // Support a single byte range only.
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m) return { unsatisfiable: true };
  const startTok = m[1];
  const endTok = m[2];
  if (startTok === '' && endTok === '') return { unsatisfiable: true };
  let start;
  let end;
  if (startTok === '') {
    const suffix = Number(endTok);
    if (!Number.isFinite(suffix) || suffix <= 0) return { unsatisfiable: true };
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(startTok);
    end = endTok === '' ? size - 1 : Number(endTok);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { unsatisfiable: true };
    if (end >= size) end = size - 1;
  }
  if (start < 0 || end < start || start >= size) return { unsatisfiable: true };
  return { offset: start, length: end - start + 1, start, end };
}

async function resolveHead(bucket, key) {
  for (const candidate of candidatesFor(key)) {
    const head = await bucket.head(candidate);
    if (head) return { key: candidate, head };
  }
  return null;
}

async function handle(context) {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    const h = cacheHeaders(baseHeaders('text/plain; charset=utf-8'));
    h.set('Allow', 'GET, HEAD');
    return new Response('Method not allowed', { status: 405, headers: h });
  }

  const raw = context.params.path;
  const key = Array.isArray(raw) ? raw.join('/') : raw || '';
  if (!key || key.endsWith('/')) {
    return new Response('Not found', {
      status: 404,
      headers: cacheHeaders(baseHeaders('text/plain; charset=utf-8'))
    });
  }
  if (!context.env.MEDIA) {
    return new Response('Media binding is not configured', {
      status: 503,
      headers: cacheHeaders(baseHeaders('text/plain; charset=utf-8'))
    });
  }

  const found = await resolveHead(context.env.MEDIA, key);
  if (!found) {
    return new Response('Not found', {
      status: 404,
      headers: cacheHeaders(baseHeaders('text/plain; charset=utf-8'))
    });
  }

  const size = Number(found.head.size) || 0;
  const type = found.head.httpMetadata?.contentType || 'application/octet-stream';
  const rangeHeader = context.request.headers.get('Range');

  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);
    if (!range || range.unsatisfiable) {
      const h = cacheHeaders(baseHeaders(type));
      h.set('Content-Range', `bytes */${size}`);
      return new Response(method === 'HEAD' ? null : 'Range not satisfiable', {
        status: 416,
        headers: h
      });
    }
    const object = method === 'HEAD'
      ? found.head
      : await context.env.MEDIA.get(found.key, {
          range: { offset: range.offset, length: range.length }
        });
    if (method !== 'HEAD' && !object) {
      return new Response('Not found', {
        status: 404,
        headers: cacheHeaders(baseHeaders('text/plain; charset=utf-8'))
      });
    }
    const h = cacheHeaders(baseHeaders(type));
    h.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    h.set('Content-Length', String(range.length));
    const body = method === 'HEAD' ? null : object.body;
    return new Response(body, { status: 206, headers: h });
  }

  const h = cacheHeaders(baseHeaders(type));
  h.set('Content-Length', String(size));
  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers: h });
  }
  const object = await context.env.MEDIA.get(found.key);
  if (!object) {
    return new Response('Not found', {
      status: 404,
      headers: cacheHeaders(baseHeaders('text/plain; charset=utf-8'))
    });
  }
  return new Response(object.body, { status: 200, headers: h });
}

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestHead(context) {
  return handle(context);
}
