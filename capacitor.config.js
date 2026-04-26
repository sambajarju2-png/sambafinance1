/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'nl.paywatch.app',
  appName: 'PayWatch',
  webDir: 'out',
  server: {
    // No server.url — loads local out/index.html first (works offline)
    // The local page checks connectivity and redirects to the remote app
    // allowNavigation enables Capacitor bridge on the remote domain
    allowNavigation: [
      'app.paywatch.app',
      '*.paywatch.app',
      'accounts.google.com',
      'login.microsoftonline.com',
      '*.enablebanking.com',
      '*.elevenlabs.io',
      '*.convai.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#0A2540',
      showSpinner: true,
      spinnerColor: '#2563EB',
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 300,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    Browser: {
      presentationStyle: 'popover',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'PayWatch',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0A2540',
  },
};

module.exports = config;
