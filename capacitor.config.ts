import type { CapacitorConfig } from '@capacitor/cli';

/**
 * PayWatch Capacitor Configuration
 * 
 * Strategy: Load the live app (app.paywatch.app) in a native shell.
 * This approach is necessary because PayWatch uses:
 * - Supabase auth cookies (don't work from capacitor://localhost)
 * - Gmail/Outlook OAuth redirects (must return to app.paywatch.app)
 * - Enable Banking PSD2 callbacks
 * - ElevenLabs WebSocket connections
 * 
 * Native plugins (push, haptics, biometrics, splash) work through
 * the Capacitor bridge regardless of where the web content loads from.
 * 
 * For App Store approval, we add native-only features:
 * - Native push notifications (replaces web push)
 * - Haptic feedback on key interactions
 * - Face ID / Touch ID for app lock
 * - Native splash screen + status bar
 */
const config: CapacitorConfig = {
  appId: 'nl.paywatch.app',
  appName: 'PayWatch',
  webDir: 'out',
  server: {
    // Load from hosted app — all API routes, auth, and OAuth work correctly
    url: 'https://app.paywatch.app',
    // Allow navigation within PayWatch domain
    allowNavigation: [
      'app.paywatch.app',
      '*.paywatch.app',
      'accounts.google.com',
      'login.microsoftonline.com',
      '*.enablebanking.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0A2540',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A2540',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'PayWatch',
    // Allow cookies for auth
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0A2540',
  },
};

export default config;
