import { decodeHTML } from 'entities';

const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function gradeLabel(post) {
  return post.class_grade || post.class_label?.replace(/\b[1-6]\b/g, value => roman[Number(value) - 1]).replace(/[-−]/g, '–');
}

export function gradeTags(post) {
  const tags = (post.legacy_categories || []).filter(slug => /^class-[1-6]$/.test(slug));
  const fromLabel = (gradeLabel(post)?.match(/\b(?:VI|IV|III|II|I|V)\b/g) || []).map(value => roman.indexOf(value) + 1);
  const low = Number(post.class_min ?? post.class_max ?? fromLabel[0]);
  const high = Number(post.class_max ?? post.class_min ?? fromLabel.at(-1));
  for (let grade = 1; grade <= 6; grade++) {
    if (grade >= low && grade <= high) tags.push('class-' + grade);
  }
  return [...new Set(tags)].sort();
}

export function classNumeral(tag) {
  return roman[Number(tag?.slice(6)) - 1];
}

export function relatedRiverGroups(post, rivers, regionOf, preferred = []) {
  const candidates = [...new Map(rivers.filter(item => item.slug !== post.slug).map(item => [item.slug, item])).values()];
  if (preferred.length) {
    const rank = slug => preferred.includes(slug) ? preferred.indexOf(slug) : preferred.length;
    candidates.sort((a, b) => rank(a.slug) - rank(b.slug));
  }
  const region = regionOf(post);
  const nearby = region ? candidates.filter(item => regionOf(item) === region).slice(0, 4) : [];
  const selected = new Set(nearby.map(item => item.slug));
  const remaining = candidates.filter(item => !selected.has(item.slug));
  const grade = gradeTags(post).reverse().find(tag => remaining.some(item => gradeTags(item).includes(tag)));
  const similar = grade ? remaining.filter(item => gradeTags(item).includes(grade)).slice(0, 4) : [];
  return { region, nearby, grade, similar };
}

export function guideIntro(content, language, excerpt) {
  const source = [...(content || '').matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].slice(0, 5).map(match => match[1]);
  if (excerpt) source.push(excerpt);
  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' });
  const unrelated = /\b(?:GPS|coordinates?|coordenadas?|CFS|m³\/s|today|currently|actualmente|hoy|subscribe|contact|contacto|click|haz clic|take the|turn left|gira|directions|email|correo|wordpress|copyright|author|autor)\b|(?:\d+[.,]\d{3,}\s*°)|@/i;
  const topic = /\b(?:run|river|creek|rapids|whitewater|waterfalls?|tributary|valley|gorge|canyon|río|rio|arroyo|rápidos|cascadas?|afluente|valle|garganta|cañón|tramo|descenso)\b/i;
  for (const paragraph of source) {
    if (/<(?:img|iframe|video|figure)\b/i.test(paragraph)) continue;
    const plain = decodeHTML(paragraph.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    const intro = [];
    for (const { segment } of segmenter.segment(plain)) {
      const sentence = segment.trim();
      if (unrelated.test(sentence) || !topic.test(sentence) || sentence.length < 40 || sentence.length > 245) {
        if (intro.length) break;
        continue;
      }
      if (intro.join(' ').length + sentence.length > 300) break;
      intro.push(sentence);
    }
    if (intro.length) return intro.join(' ');
  }
}

export function guideWaterSource(content, es) {
  const text = decodeHTML((content || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
  if (/(?:fed by|water comes from) (?:the )?(?:Andean )?snowmelt|(?:alimentad[oa] por|agua (?:fría )?viene del) (?:el )?deshielo/i.test(text)) {
    return es ? 'Deshielo' : 'Snowmelt';
  }
}
