/** @type {import('next').NextConfig} */

// Security headers applied to every response. Notes:
//  - Geolocation (nearby search) and camera (dashboard camera page) are explicitly allowed for this origin only;
//    everything else sensitive is switched off.
//  - HSTS makes browsers use HTTPS only (geolocation and service workers need a secure context anyway).
//  - A strict Content-Security-Policy is intentionally NOT set here: Firebase Auth popups, Stripe, Google Fonts and
//    Next inline scripts need a carefully tuned policy; add one only after testing every flow in a browser.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=(), payment=(self)' },
  // Firebase Auth's Google popup needs window.opener access from the popup.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['@opentelemetry/instrumentation', 'require-in-the-middle'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Provider webhooks and API responses must never be cached by browsers/proxies.
      { source: '/api/:path((?!public/).*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.storage.googleapis.com', pathname: '/**' }
    ],
  },
};
module.exports = nextConfig;
