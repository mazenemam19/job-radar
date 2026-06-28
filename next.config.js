// next.config.js
/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

// The Supabase JS client runs in the browser (src/lib/supabase/client.ts), so
// connect-src must allow it. Read from the same env var the client already
// uses — no new config surface, no hardcoded project ref committed here.
let supabaseOrigin = "";
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
  }
} catch {
  // Unset/malformed at build time (e.g. CI without secrets) — fall back to
  // the wildcard below instead of breaking the build.
}

const connectSrc = [
  "'self'",
  supabaseOrigin || "https://*.supabase.co",
  "wss://*.supabase.co", // Supabase realtime — not used today, but harmless to allow
].join(" ");

// script-src uses 'unsafe-inline', not a per-request nonce — written down
// here because it looks like a downgrade and isn't an oversight:
//
// A nonce-based CSP was tried first (the "correct" modern answer, threaded
// through src/middleware.ts so Next could nonce its own RSC-hydration
// <script> tags). It broke in production specifically on this app's
// statically-prerendered routes (/, /login, /submit — the ○ entries in
// `next build`'s route table). Those are rendered once at build time, so
// their HTML has no nonce baked into Next's inline scripts at all; the
// per-request nonce in the header never matches anything in the cached
// body, and with 'strict-dynamic' in play (which makes browsers ignore
// 'self' for scripts entirely) every one of those inline scripts gets
// silently blocked — the exact "Executing inline script violates ...
// script-src" error this fix is meant to prevent, just moved from dev to a
// prod-only failure on 3 specific pages. Fixing it properly means forcing
// those routes to render dynamically (`export const dynamic =
// "force-dynamic"`), which trades away static prerendering on the
// lowest-stakes pages in the app to harden a script-src directive against
// a threat (arbitrary inline script injection) this app doesn't otherwise
// have: the only place user content reaches the DOM as HTML
// (job/[id]/page.tsx's dangerouslySetInnerHTML) already goes through
// DOMPurify, which strips <script> tags regardless of what CSP allows.
// Given that, 'unsafe-inline' here is a deliberate, documented tradeoff,
// not a gap — script-src still blocks every *other* origin, which is what
// actually matters for this app's threat model (no third-party scripts,
// no ad/analytics tags, nothing to inject from). Revisit if either
// changes.
const csp = [
  "default-src 'self'",
  `connect-src ${connectSrc}`,
  "img-src 'self' data:",
  "font-src 'self'",
  // Next dev's HMR/fast-refresh needs 'unsafe-eval'; the production bundle does not.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  // Tailwind/React's data-driven inline `style={{}}` (CONTEXT.md hard rule 5) needs this.
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Legacy/defense-in-depth alongside frame-ancestors above.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS only means anything over HTTPS; scoping to prod avoids any
  // local-dev confusion over plain http://localhost.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["nodemailer"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
