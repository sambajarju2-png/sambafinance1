import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import ServiceWorkerRegistration from '@/components/pwa/sw-register';
import { ThemeProvider } from '@/components/theme-provider';
import SplashScreen from '@/components/splash-screen';
import dynamic from 'next/dynamic';
import './globals.css';

// Lazy-load components not needed for initial render — saves ~230 lines of JS from main bundle
const NativeShell = dynamic(() => import('@/components/native-shell'), { ssr: false });
const BiometricLock = dynamic(() => import('@/components/biometric-lock'), { ssr: false });
const OfflineDetector = dynamic(() => import('@/components/offline-detector'), { ssr: false });

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['400', '600', '800'],
});

export const metadata: Metadata = {
  title: 'PayWatch — Nooit meer verrast door een incassobureau',
  description:
    'PayWatch scant je e-mail, volgt je rekeningen, en waarschuwt je voordat het te laat is. Bescherm jezelf tegen incassokosten.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PayWatch',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A2540',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${plusJakarta.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <ServiceWorkerRegistration />
            <SplashScreen />
            <NativeShell />
            <BiometricLock />
            <OfflineDetector />
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
