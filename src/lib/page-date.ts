import type { Language } from './languages';

const spanish = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const ordinal = new Intl.PluralRules('en-US', { type: 'ordinal' });
const suffix: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

export function pageDate(timestamp: string, language: Language) {
  // Preserve the publication's recorded calendar day across visitor time zones.
  const date = new Date(timestamp.slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return timestamp;
  if (language === 'es') return spanish.format(date);
  const day = date.getUTCDate();
  return month.format(date) + ' ' + day + suffix[ordinal.select(day)] + ', ' + date.getUTCFullYear();
}
