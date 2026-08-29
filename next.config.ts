import type { NextConfig } from "next";

// This app handles special-category health data (medication, care reports)
// about a vulnerable population, so it ships with a strict baseline of
// browser security headers rather than relying on Vercel's defaults alone.
//
// Content-Security-Policy is intentionally NOT set here: it needs a fresh
// per-request nonce so Next.js's own inline hydration/streaming scripts are
// allowed to run (a static script-src without that nonce blocks them —
// the page renders its initial HTML fine, then goes blank when React can't
// hydrate). See middleware.ts, which sets it per-request instead.
const securityHeaders = [
  // Force HTTPS for a year, including subdomains, and allow HSTS preload.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // No third party may frame this app — blocks clickjacking on /login.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in this app needs any of these device/browser capabilities.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
