import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const backendUrl = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

// Pages get a per-request nonce CSP from src/proxy.ts (no 'unsafe-inline' for scripts).
// This static policy only covers responses the proxy doesn't touch (static files, 404s
// for asset-like paths): no inline scripts at all there. Styles keep 'unsafe-inline'
// (MUI/emotion inject <style>). Dev also needs 'unsafe-eval' and ws: for HMR.
const csp = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Receipt OCR worker (public/ocr/<version>/): the worker gets its own policy from its response.
// It loads the engine with importScripts and compiles WebAssembly (needs 'wasm-unsafe-eval',
// which allows wasm compilation only, not JS eval), and fetches the language data. Versioned
// paths, so the files are cached for a year.
const ocrCsp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Off: bottom-left covers the sidebar user menu and phone tab bar, top-right covers the
  // avatar menu and bottom-right covers the phone add button.
  devIndicators: false,
  turbopack: {
    // Pin root to this app (a stray lockfile in $HOME otherwise confuses root detection).
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The /api rewrite gives up after 30 s by default; receipt reading can take up to ~30 s
  // (backend RECEIPT_AI_DEADLINE_SECONDS=28) before falling back to its local parser.
  experimental: { proxyTimeout: 60_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Fallback CSP only where proxy.ts doesn't set the nonce policy (two CSP headers on
      // one response would be intersected, which is safe but noisy).
      { source: "/_next/:path*", headers: [{ key: "Content-Security-Policy", value: csp }] },
      {
        source: "/ocr/:path*",
        headers: [
          { key: "Content-Security-Policy", value: ocrCsp },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
