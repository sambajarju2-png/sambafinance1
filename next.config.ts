import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict React mode for catching bugs early
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
