export const languages = [
  { code: 'en', label: 'English', prefix: '', browserLanguage: 'en' },
  { code: 'es', label: 'Español', prefix: '/es', browserLanguage: 'es' }
] as const;

export type Language = (typeof languages)[number]['code'];
export const defaultLanguage: Language = 'en';

export function languageForPath(pathname: string): Language {
  return languages.find(({ prefix }) => prefix && (
    pathname === prefix || pathname.startsWith(prefix + '/')
  ))?.code ?? defaultLanguage;
}

export function localizedPath(pathname: string, language: Language): string {
  const prefix = languages.find(({ code }) => code === language)?.prefix ?? '';
  const current = languages.find(({ code }) => code === languageForPath(pathname))?.prefix ?? '';
  return prefix + (pathname.slice(current.length) || '/');
}

export function languagePrefix(code: Language): string {
  return languages.find((language) => language.code === code)!.prefix;
}

export function languagePaths() {
  return languages.map(({ prefix }) => ({ params: { lang: prefix.slice(1) || undefined } }));
}
