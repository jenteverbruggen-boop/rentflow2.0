import type { NextConfig } from "next";

// Basic hardening headers. No CSP on purpose: Next's inline bootstrap
// scripts need a nonce-based policy that has to be tested against the whole
// UI. HSTS is ignored by browsers over plain HTTP (the LAN setup) and only
// takes effect on genuine HTTPS.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@prisma/adapter-pg",
    "pg",
    "@prisma/adapter-libsql",
    "@libsql/client",
  ],
};

export default nextConfig;
