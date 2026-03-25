import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://cdn.sanity.io https://ectcwerjdpiurubdpxcp.supabase.co https://api.dicebear.com",
              "connect-src 'self' https://ectcwerjdpiurubdpxcp.supabase.co https://generativelanguage.googleapis.com https://api.anthropic.com",
              "font-src 'self'",
              "frame-src 'none'",
              "object-src 'none'",
            ].join('; '),
          },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation()' },
        ],
      },
    ];
  },
};
export default withNextIntl(nextConfig);
