import { guidePath } from '../lib/guide-seo';
import { defaultLanguage, languageForPath, languages, localizedPath } from '../lib/languages';

export function createSiteUI(pathname: string) {
  const path = pathname.replace(/\/+$/, '/') || '/';
  const language = languageForPath(path);
  const spanish = language === 'es';
  const englishPath = localizedPath(path, defaultLanguage);
  const isNotFound = englishPath === '/404/' || englishPath === '/404.html';
  const languageRoutes = Object.fromEntries(languages.map(({ code }) => [
    code,
    isNotFound && code === defaultLanguage ? '/404.html' : localizedPath(isNotFound ? '/404/' : path, code)
  ]));
  const t = (english: string, translation: string) => spanish ? translation : english;
  const href = (route: string) => route.startsWith('/') ? localizedPath(guidePath(route), language) : route;
  return { language, spanish, t, href, isNotFound, languageRoutes };
}
