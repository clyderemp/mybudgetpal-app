import { NextResponse, type NextRequest } from "next/server";

// UX-only routing guard (real auth is enforced by the backend).
// Next.js 16 renamed middleware.ts → proxy.ts (same semantics).

const AUTH_ROUTES = ["/login", "/join", "/setup"];

/**
 * Per-request nonce CSP (pages are dynamically rendered; Next applies the nonce to its own
 * scripts from the request's CSP header, and the root layout passes it to MUI's
 * InitColorSchemeScript). 'unsafe-inline' stays only for styles (emotion injects <style>).
 */
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has("mbp_access") || request.cookies.has("mbp_refresh");
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Logged-in users hitting /login go home — unless api.ts sent them here after a
  // failed refresh (?reauth=1), which means the cookies are stale (avoids a loop).
  if (hasSession && pathname === "/login" && !searchParams.has("reauth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip API proxying, Next internals and static files.
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|json|webmanifest)$).*)"],
};
