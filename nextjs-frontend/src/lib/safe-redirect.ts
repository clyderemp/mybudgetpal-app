const AUTH_PAGES = ["/login", "/join", "/setup"];
const BASE = "http://mbp.invalid";

/**
 * Only allow same-origin relative paths ("/x"). Rejects "//host", "/\\host", and anything
 * with control characters or backslashes (the URL parser strips tab/CR/LF, so "/\t/evil.com"
 * would otherwise resolve to //evil.com). The value is resolved and its origin compared.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (AUTH_PAGES.includes(url.pathname)) return fallback;
  return url.pathname + url.search + url.hash;
}
