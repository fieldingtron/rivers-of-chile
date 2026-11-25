// Export the repository rules for a Render static site's Blueprint.
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
const routes = [];
for (const line of rules.split(/\r?\n/)) {
  const rule = line.trim();
  if (!rule || rule.startsWith('#')) continue;
  const [source, destination, status, ...extra] = rule.split(/\s+/);
  if (!source.startsWith('/') || !destination || status !== '301' || extra.length ||
      source.includes('*') || destination.includes(':splat')) {
    throw new Error(`Cannot export this rule as a Render 301 redirect: ${rule}`);
  }
  routes.push({ type: 'redirect', source, destination });
}

// JSON is valid YAML, so this mapping can be added to the static site's service.
console.log(JSON.stringify({ routes }, null, 2));
