import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // FIX: Remove X-Powered-By header (CWE-200)
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ectcwerjdpiurubdpxcp.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // FIX: Added includeSubDomains + preload to HSTS
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://cdn.sanity.io https://ectcwerjdpiurubdpxcp.supabase.co https://api.dicebear.com",
              // FIX: Added graph.microsoft.com + login.microsoftonline.com for Outlook OAuth
              "connect-src 'self' https://ectcwerjdpiurubdpxcp.supabase.co https://generativelanguage.googleapis.com https://api.anthropic.com https://graph.microsoft.com https://login.microsoftonline.com https://api.elevenlabs.io wss://api.elevenlabs.io https://*.livekit.cloud wss://*.livekit.cloud https://*.turn.livekit.cloud",
              "font-src 'self'",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-src 'none'",
              "object-src 'none'",
              // FIX: Added base-uri and form-action restrictions
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // FIX: geolocation() → geolocation=() (was missing = sign)
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};
export default withNextIntl(nextConfig);
