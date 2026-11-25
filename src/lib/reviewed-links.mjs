export function reviewedEnglishLinks(html, slug) {
  if (slug === 'lower-llancahue') {
    html = html.replace(/<p>\s*<a\b[^>]*href="https?:\/\/vimeo\.com\/35327325"[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
  }
  if (slug === 'nublefest-2010-in-chile') {
    html = html.replace(/<p>Jon Clark has just setup a blog here[^<]*<a\b[^>]*href="https?:\/\/www\.nublefest\.blogspot\.com\/"[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
  }
  if (slug === 'futaleufu-riverkeeper') {
    html = html.replace(/Here is a link to the\s*<a\b[^>]*href="https?:\/\/waterkeeper\.org\/2014\/10\/24\/[^"]+"[^>]*>waterkeeper announcement<\/a>\s*:/gi, '');
  }
  return html.replace(/(<a\b[^>]*?\bhref=["'])http:\/\//gi, '$1https://')
    .replace(/(<a\b[^>]*>\s*)http:\/\//gi, '$1https://');
}
