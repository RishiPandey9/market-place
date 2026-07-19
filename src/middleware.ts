import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Global security-headers middleware (Phase 2 security architecture).
//
// Applies defense-in-depth response headers to every route: a Content Security
// Policy, HSTS, clickjacking/MIME/referrer protections, and a conservative
// Permissions-Policy. Rate limiting is enforced per-route inside the relevant
// handlers (see src/lib/ratelimit.ts) rather than here, because middleware runs
// on the Edge runtime where our Prisma-backed identity keys aren't available.

// A per-request nonce would require rewriting inline scripts to consume it;
// Next's framework runtime injects some inline bootstrap script, so we allow
// 'self' plus the minimal inline/eval that the App Router needs in dev. In
// production 'unsafe-eval' is dropped.
function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind/Next inject inline styles; allow them.
    "style-src 'self' 'unsafe-inline'",
    // Cloudinary CDN + data URIs for images (media host per approved stack).
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    // Same-origin API + NextAuth. Allow Stripe/KYC/shipping callbacks as those
    // are added; keep 'self' as the baseline.
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  res.headers.set("Content-Security-Policy", buildCsp());
  // HSTS: force HTTPS for 2 years incl. subdomains. Harmless on localhost
  // (browsers ignore it for non-HTTPS origins).
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  return res;
}

// Apply to all routes except Next internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)",
  ],
};
