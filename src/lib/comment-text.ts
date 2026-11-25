import { decodeHTML } from 'entities';

// The archive contains WordPress HTML. Return text for Astro to escape.
export function commentText(html?: string | null): string {
  const text = decodeHTML((html || '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\b[^>]*>|<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, ''));
  return text
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+|(?:[\w.+%-]+@)?(?:[\p{L}\p{N}-]+\.)+(?:[\p{L}]{2,}|xn--[\w-]+)(?::\d+)?(?:[/?#][^\s<>]*)?/giu, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n(?: *\n)+/g, '\n\n')
    .trim();
}
