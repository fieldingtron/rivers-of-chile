const site = 'roc';
const english = {
  comment: 'Thank you. Your comment is awaiting moderation.',
  contact: 'Thank you. Your message was delivered to the site team.',
  invalid: 'Please check the form fields and try again.',
  failed: 'We could not save your message. Please try again later.'
};
const spanish = {
  comment: 'Gracias. Tu comentario está pendiente de moderación.',
  contact: 'Gracias. Tu mensaje llegó al equipo del sitio.',
  invalid: 'Revisa los datos del formulario y vuelve a intentarlo.',
  failed: 'No pudimos guardar tu mensaje. Inténtalo de nuevo más tarde.'
};
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export async function onRequestPost({ request, env, params }) {
  const kind = params.kind;
  if (kind !== 'contact' && kind !== 'comment') return new Response(null, { status: 404 });
  const url = new URL(request.url);
  if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403 });
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) return new Response(null, { status: 415 });
  const maximum = 65536;
  if (Number(request.headers.get('Content-Length')) > maximum) return new Response(null, { status: 413 });
  let text = '';
  let size = 0;
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); return new Response(null, { status: 413 }); }
    text += decoder.decode(value, { stream: true });
  }
  const form = new URLSearchParams(text + decoder.decode());
  const field = (name) => (form.get(name) || '').trim();
  const language = field('language');
  const es = field('ui') === 'es';
  const strings = es ? spanish : english;
  const respond = (status, key, issue) => {
    const message = strings[key];
    const headers = { 'Cache-Control': 'no-store' };
    if (issue) headers['X-Delivery-Status'] = issue;
    if (request.headers.get('Accept')?.includes('application/json')) return Response.json({ message }, { status, headers });
    return new Response(`<!doctype html><html lang="${es ? 'es' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${message}</title><p>${message}</p><a href="${es ? '/es/' : '/'}">${es ? 'Volver al inicio' : 'Return home'}</a></html>`, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  };
  if (field('website')) return respond(200, kind);
  const name = field('name'), message = field('message');
  if (!name || name.length > 100 || !message || message.length > 4000 || !['en','es'].includes(language)) return respond(400,'invalid');
  try {
    let payload;
    if (kind === 'contact') {
      const email = field('email'), subject = field('subject');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || subject.length > 150) return respond(400,'invalid');
      payload = { sender_name: name, reply_to: email, subject, message, language };
    } else {
      const source = await env.ASSETS.fetch(new Request(new URL('/comment-targets.json', url)));
      if (!source.ok) return respond(503,'failed','target-list');
      const targets = await source.json();
      const target = Object.hasOwn(targets, field('slug')) && targets[field('slug')];
      if (!target || !['post','page'].includes(target.kind) || !Number.isInteger(target.id)) return respond(400,'invalid');
      payload = { author_name: escape(name), content: escape(message), original_language: language, [target.kind]: target.id };
    }
    const collection = site + (kind === 'comment' ? '_comments' : '_contact_messages');
    if (!env.DIRECTUS_FORM_TOKEN) return respond(503,'failed','configuration');
    const result = await fetch('https://content.fieldsmarshall.com/items/' + collection, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type':'application/json', 'User-Agent':'RiverSites/1.0', Authorization: 'Bearer ' + env.DIRECTUS_FORM_TOKEN },
      body: JSON.stringify(payload)
    });
    if (!result.ok) console.error('Directus form delivery returned', result.status);
    return result.ok ? respond(201,kind) : respond(503,'failed','upstream-' + result.status + (result.headers.get('cf-mitigated') === 'challenge' ? '-challenge' : ''));
  } catch (error) {
    console.error('Form delivery exception', error.name);
    return respond(503,'failed','request-' + error.name);
  }
}
