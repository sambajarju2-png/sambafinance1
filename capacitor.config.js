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
      launchAutoHide: false,
      launchShowDuration: 30000,
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
