import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const analyticsOrigin = originOf(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL);

// Next.js injects inline bootstrap scripts, so 'unsafe-inline' is required for
// script-src unless every page is rendered with a per-request nonce. The site
// never renders user-supplied HTML (all content is escaped text), which keeps
// the residual XSS exposure low. All other directives are locked down.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // A separate build directory lets end-to-end tests run beside a dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Media uploads go through a server action; the media service enforces its own 5 MB limit.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
