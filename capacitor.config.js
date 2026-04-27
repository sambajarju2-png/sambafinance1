/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'nl.paywatch.app',
  appName: 'PayWatch',
  webDir: 'out',
  server: {
    url: 'https://app.paywatch.app',
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
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#0A2540',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
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
    appendUserAgent: 'PayWatch-iOS',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0A2540',
  },
};

module.exports = config;
