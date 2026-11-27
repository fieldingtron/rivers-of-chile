import { decodeHTML } from 'entities';

const slugs: Record<string, string> = {
  "22-teacups-22-tazas-rio-claro": "22-teacups-rio-claro",
  "rio-laja-2": "rio-laja-salto-las-chilcas",
  "rio-claro-tinguiririca-2": "rio-claro-puente-las-pinas"
};
const headings: Record<string, string> = {
  "rio-laja-2": "Río Laja — Salto Las Chilcas",
  "rio-claro-tinguiririca-2": "Río Claro — Puente Las Piñas"
};

export const publicSlug = (slug: string) => slugs[slug] ?? slug;
export const guideHeading = (slug: string, title: string) => headings[slug] ?? title;

export function guidePath(path: string) {
  return path.replace(/^(\/(?:es\/)?)([a-z0-9-]+)\/?(?=[?#]|$)/, (original, prefix, slug) =>
    slugs[slug] ? prefix + slugs[slug] + '/' : original);
}

export function guideLinks(html: string) {
  return html.replace(/(\shref=["'])(?:https?:\/\/(?:www\.)?riversofchile\.com)?(\/[^"'\s]*)(["'])/gi,
    (original, attr, path, quote) => guidePath(path) === path ? original : attr + guidePath(path) + quote);
}

function plain(value?: string | null) {
  return decodeHTML((value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const pageDescriptions: Record<string, [string, string]> = {
  "contact-us": [
    "Contact the Rivers of Chile editors with questions about the guide, corrections or updates to a river description.",
    "Contacta con el equipo de Rivers of Chile para hacer preguntas sobre la guía, enviar correcciones o actualizar la descripción de un río."
  ],
  "dedication": [
    "Read the dedication to the paddlers remembered in this whitewater guide.",
    "Lee la dedicatoria a los kayakistas que se recuerdan en esta guía de aguas bravas."
  ],
  "history-of-first-descents": [
    "Explore the history of first descents documented by Rivers of Chile, including the rivers, expeditions and paddlers involved.",
    "Explora la historia de los primeros descensos documentados por Rivers of Chile, con los ríos, las expediciones y sus protagonistas."
  ],
  "map-of-chile": [
    "Locate Chilean rivers on the map to plan your whitewater trip.",
    "Localiza los ríos de Chile en el mapa para planificar tu viaje de kayak."
  ],
  "about-authors": [
    "Meet the paddlers behind the Rivers of Chile whitewater guide.",
    "Conoce a los kayakistas que escribieron la guía de aguas bravas Rivers of Chile."
  ],
  "site-map": [
    "Browse the Rivers of Chile site directory to find river guides and articles.",
    "Consulta el índice de Rivers of Chile para encontrar guías de ríos y artículos."
  ],
  "hardcopy-guidebook": [
    "Learn about the printed guidebook to kayaking the whitewater rivers of Chile.",
    "Conoce la edición impresa de la guía de kayak en los ríos de aguas bravas de Chile."
  ]
};

export function guideDescription(item: {slug: string; content?: string | null; seo_description?: string | null}, heading: string, es: boolean) {
  const page = pageDescriptions[item.slug];
  if (page) return page[es ? 1 : 0];
  const editorial = plain(item.seo_description);
  const paragraphs = [...(item.content || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => plain(match[1]));
  const text = (editorial && editorial.split(',').length < 5 ? editorial : '')
    || paragraphs.find(p => p.length > 55 && !/^https?:|^\[/.test(p))
    || (es ? 'Consulta la información sobre ' + heading + '.' : 'Read the guide to ' + heading + '.');
  if (text.length <= 165) return text;
  const clipped = text.slice(0, 162).replace(/\s+\S*$/, '');
  const sentence = clipped.match(/^(.{65,}[.!?])(?:\s|$)/);
  return sentence?.[1] || clipped.replace(/[,;:–-]+$/, '') + '…';
}
