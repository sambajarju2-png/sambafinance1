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
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0A2540',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
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
