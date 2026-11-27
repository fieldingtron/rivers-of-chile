import { decodeHTML, escapeAttribute } from 'entities';

const regionHeadings = new Set([
  'santiago metropolitan area', 'region metropolitana de santiago',
  'southcentral andes', 'andes del centro-sur', 'patagonia',
  'selected history for argentina', 'primeros descensos seleccionados de argentina'
]);

// Reviewed source headings and guide slugs. Reach-specific links are handled below.
const riverGuides = new Map(Object.entries({
  'rio colorado (aconcagua)': 'rio-colorado-aconcagua',
  'rio maipo': 'rio-maipo',
  'rio clarillo': 'rio-clarillo',
  'rio colorado (maipo tributary)': 'rio-colorado',
  'rio colorado (maipo — afluente)': 'rio-colorado',
  'rio yeso': 'rio-yeso',
  'rio teno': 'rio-teno',
  'rio colorado (lontue tributary)': 'rio-colorado-lontue',
  'rio colorado (lontue — afluente)': 'rio-colorado-lontue',
  'rio melado': 'rio-melado',
  'quebrada el toro': 'quebrada-el-toro',
  'rio ancoa': 'rio-ancoa',
  'rio achibueno': 'rio-achibueno',
  'rio longavi': 'rio-longavi',
  'rio bullileo upper section': 'rio-bullileo',
  'rio bullileo, tramo superior': 'rio-bullileo',
  'rio nuble': 'rio-nuble',
  'rio gonzalez': 'rio-gonzalez',
  'rio de las truchas': 'rio-las-truchas',
  'rio cato': 'rio-cato',
  'rio niblinto': 'rio-niblinto',
  'rio chillan': 'rio-chillan',
  'rio renegado': 'rio-renegado',
  'rio polcura': 'rio-polcura',
  'rio cholguan': 'rio-cholguan',
  'rio huepil': 'rio-huepil',
  'rio rucue': 'rio-rucue',
  'rio quillaleo': 'rio-quillaleo',
  'rio queuco': 'rio-queuco',
  'rio nirementum': 'rio-nirementum',
  'rio pangue': 'rio-pangue',
  'rio lolco': 'rio-lolco',
  'rio ralco': 'rio-ralco',
  'rio chalquilvin': 'rio-chalquilvin',
  'rio llanquen': 'rio-llanquen',
  'rio renaico': 'rio-renaico',
  'rio amargo': 'rio-amargo',
  'rio malleco': 'rio-malleco',
  'rio dillo': 'rio-dillo',
  'rio cautin': 'rio-cautin',
  'rio calbuco': 'rio-calbuco',
  'rio huichahue': 'rio-huichahue',
  'rio pichipinga or llaima': 'rio-pichipinga-or-llaima',
  'rio curacalco': 'rio-curacalco',
  'rio truful-truful': 'rio-truful-truful',
  'rio queupude/alpehue': 'rios-queupude-alpehue',
  'rio quepe': 'rio-quepe',
  'rio codihue': 'rio-codihue',
  'rio trafanpulli': 'rio-trafanpulli',
  puesco: 'rio-puesco',
  'rio blanco de caburgua': 'rio-blanco-de-caburgua',
  'rio llancalil': 'rio-llancalil',
  'rio panqui': 'rio-panqui',
  'rio nevado': 'rio-nevado',
  'rio liucura': 'rio-liucura',
  'estero coilaco': 'estero-coilaco',
  'rio desague or caburgua': 'rio-desague',
  'rio carhuello': 'rio-carhuello',
  'rio de la plata': 'rio-plata',
  'rio turbio (correntoso)': 'rio-turbio',
  'rio blanco (del enco)': 'rio-blanco-del-enco',
  'rio san pedro': 'rio-san-pedro',
  'rio reyehueco': 'rio-reyehueco',
  'rio llizan': 'rio-llizan',
  'rio caunehue': 'rio-canahue',
  'rio manio': 'rio-manio',
  'rio reca': 'rio-reca',
  'rio florin': 'florin-river',
  'rio curringue': 'rio-curringue',
  'rio hueinahue lower and middle': 'rio-hueinahue',
  'rio hueinahue, tramos inferior y medio': 'rio-hueinahue',
  'rio iculpe': 'rio-iculpe',
  'rio pilmaiquen': 'rio-pilmaiquen',
  'rio bonito': 'rio-bonito',
  coihueco: 'rio-coihueco',
  'rio blanco de coihueco': 'rio-blanco-de-coihueco',
  'rio petrohue': 'rio-petrohue-upper',
  'rio blanco de calbuco': 'rio-blanco-de-calbuco',
  'rio cochamo and la junta': 'rio-cochamo',
  'rio cochamo y la junta': 'rio-cochamo',
  'rio negro': 'rio-negro',
  'rio el tigre (lower ??)': 'rio-el-tigre',
  'rio el tigre (¿tramo inferior?)': 'rio-el-tigre',
  'rio el tigre upper': 'rio-salto-del-tigre',
  'rio el tigre, tramo superior': 'rio-salto-del-tigre',
  'rio palena': 'rio-palena',
  'rio figueroa': 'rio-figueroa',
  'rio ventisqueros': 'rio-ventisqueros',
  'rio manihuales': 'rio-manihuales',
  'rio blanco (parque nacional cerro castillo)': 'rio-blanco-cerro-castillo',
  'rio cajon': 'rio-cajon',
  'estero del bosque': 'estero-del-bosque',
  'rio claro (ibanez)': 'rio-claro-ibanez',
  'estero lechoso': 'estero-lechoso',
  'rio resbalon': 'rio-resbalon',
  'rio el canal': 'rio-el-canal',
  'rio aviles': 'rio-aviles',
  'rio los maitenes': 'rio-los-maitenes',
  'rio jeinimeni': 'rio-jeinemeni',
  'rio cochrane': 'rio-cochrane',
  'rip maier': 'rio-maier',
  'rio perez': 'rio-perez',
  'rio mosco': 'rio-mosco'
}));

const lower = /^(?:lower(?: run)?|tramo inferior):/;
const upper = /^(?:upper(?: run)?|tramo superior|tramo alto):/;
const reachGuides = new Map([
  ['rio aconcagua', [[/^(?:salto del soldado canyon|canon del salto del soldado):/, 'rio-aconcagua-salto-de-soldado']]],
  ['rio volcan', [[lower, 'rio-volcan-lower'], [upper, 'rio-volcan-upper']]],
  ['rio cachapoal', [[lower, 'rio-cachapoal-lower'], [upper, 'rio-cachapoal-upper']]],
  ['rio pangal', [[lower, 'rio-pangal']]],
  ['rio claro', [[/^veintidos saltos:/, '22-teacups-22-tazas-rio-claro']]],
  ['rio maule', [[/^(?:la mina run|tramo la mina):/, 'rio-maule']]],
  ['rio laja', [[upper, 'rio-laja-2']]],
  ['rio bio-bio', [[lower, 'rio-bio-bio-lower'], [upper, 'rio-bio-bio-el-nacimiento']]],
  ['rio trancura', [[lower, 'trancura-lower']]],
  ['rio palguin', [[upper, 'rio-palguin-upper']]],
  ['rio maichin', [[lower, 'rio-maichin'], [upper, 'rio-machin-upper']]],
  ['rio llancahue', [[lower, 'lower-llancahue'], [upper, 'rio-llancahue']]],
  ['rio fuy', [[lower, 'rio-fuy-lower'], [upper, 'river-fuy']]],
  ['rio gol gol', [[upper, 'rio-gol-gol']]],
  ['rio cisnes', [[/^(?:piedra el gato canyon|canon de piedra el gato):/, 'rio-cisnes-piedra-del-gato'], [upper, 'rio-cisnes-upper']]],
  ['rio simpson', [[lower, 'rio-simpson-lower'], [/^cajon de farrellones:/, 'rio-simpson-cajon-de-farrellones']]],
  ['rio baker', [[lower, 'rio-baker-lower'], [upper, 'rio-baker']]]
]);

function plainText(html) {
  return decodeHTML(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function fold(html) {
  return plainText(html).normalize('NFD')
    .replace(/\p{M}/gu, '').toLowerCase();
}

function riverGuide(name, paragraphs) {
  const details = paragraphs.flat().map(fold);
  if (name === 'rio claro') {
    // Repeated names are only linked when the entry identifies the reach.
    if (details.some((line) => /^(?:los quenes run|tramo los quenes):/.test(line))) return 'rio-claro-los-quenes';
    if (details.some((line) => /kurt casey.*(?:june 10, 2011|10 de junio de 2011)/.test(line))) return 'rio-claro-pucon';
  }
  return riverGuides.get(name);
}

function repairLegacyMarkup(html) {
  return html
    // A stray opening tag starts inside Wattenmaker and wraps two river names.
    .replace(/Watten<strong>(maker;[^<]*<br\s*\/?>\s*<strong>R[ií]o Palvitad<\/strong><br\s*\/?>\s*)(R[ií]o Futaleufú)<\/strong>/gi,
      'Watten$1<strong>$2</strong>')
    // Cuervos was added after the preceding record with a long run of nonbreaking spaces.
    .replace(/(?:\s|&nbsp;)+<strong>(Rio)(?:\s|&nbsp;)+<\/strong>\s*<b>(Cuervos)(?:\s|&nbsp;)*<\/b>/gi,
      '<br><strong>$1 $2</strong> ');
}

function readHeading(line) {
  const parts = line.match(/^<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*)$/i);
  if (!parts) return;
  let [, , heading, details] = parts;
  // Bullileo has its reach, date and credits in a single bold line.
  const bullileo = heading.match(/^(R[ií]o Bullileo(?: Upper section|, tramo superior:))\s+(.+)$/i);
  if (bullileo) [, heading, details] = bullileo;
  // Some headings place a geographical qualifier outside the bold tag.
  const qualifier = details.match(/^\s*(\([^()]+\))\s*$/);
  if (qualifier) {
    heading = heading.trim() + ' ' + qualifier[1];
    details = '';
  }
  if (heading.endsWith(':') && details.startsWith(':')) {
    heading += ':';
    details = details.slice(1);
  }
  return { heading: heading.trim(), details: details.trim() };
}

export function formatFirstDescents(html, guidePaths) {
  const source = repairLegacyMarkup(html);
  const paragraphs = [...source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  // Pass through content that has already been restructured in the CMS.
  if (source.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, '').trim()) return html;

  const blocks = [];
  let entry;
  for (const [, paragraph] of paragraphs) {
    const lines = [];
    for (const line of paragraph.replace(/(<(?:strong|b)\b[^>]*>)(?:\s*<br\s*\/?>)+/gi, '<br>$1')
      .split(/<br\s*\/?>/i).map((line) => line.trim()).filter(Boolean)) {
      const title = readHeading(line);
      const name = title && fold(title.heading).replace(/:+$/, '');
      const isRegion = regionHeadings.has(name);
      const isRiver = /^(?:rio |rip |estero |quebrada |arroyo |puesco$|coihueco$)/.test(name || '');
      if (!isRegion && !isRiver) {
        lines.push(line);
        continue;
      }
      if (lines.length) {
        if (entry) entry.paragraphs.push(lines.splice(0));
        else blocks.push({ intro: lines.splice(0) });
      }
      if (isRegion) {
        blocks.push({ region: title.heading });
        entry = undefined;
      } else {
        entry = { name, heading: title.heading, paragraphs: [] };
        blocks.push(entry);
      }
      if (title.details) lines.push(title.details);
    }
    if (lines.length) {
      if (entry) entry.paragraphs.push(lines);
      else blocks.push({ intro: lines });
    }
  }

  if (!blocks.some((block) => block.name)) return html;

  const link = (label, slug, context) => {
    const path = guidePaths.get(slug);
    if (!path) return label;
    const accessibleName = context ? ` aria-label="${escapeAttribute(plainText(context + ' — ' + label))}"` : '';
    return `<a href="${path}"${accessibleName}>${label}</a>`;
  };
  return blocks.map((block, index) => {
    if (block.intro) return `<p>${block.intro.join('<br>')}</p>`;
    const separator = blocks[index - 1]?.name ? '<hr>' : '';
    if (block.region) return `${separator}<h2>${block.region}</h2>`;

    const reaches = reachGuides.get(block.name) || [];
    const slug = riverGuide(block.name, block.paragraphs);
    const heading = slug === 'rio-cochamo'
      ? block.heading.replace(/^R[ií]o Cochamó/i, (label) => link(label, slug))
      : link(block.heading, slug);
    const details = block.paragraphs.map((lines) => `<p>${lines.map((line) => {
      const [, slug] = reaches.find(([pattern]) => pattern.test(fold(line))) || [];
      return line.replace(/^([^:<]+)(?=:)/, (label) => link(label, slug, block.heading));
    }).join('<br>')}</p>`).join('');
    return `${separator}<section class="descent-entry"><h3>${heading}</h3>${details}</section>`;
  }).join('\n');
}
