import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // PayWatch Design System
        pw: {
          bg: '#F4F7FB',
          surface: '#FFFFFF',
          navy: '#0A2540',
          blue: '#2563EB',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E2E8F0',
          green: '#059669',
          amber: '#D97706',
          orange: '#EA580C',
          red: '#DC2626',
          'dark-red': '#991B1B',
          purple: '#7C3AED',
        },
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '16px',
        'button': '4px',
        'input': '8px',
      },
      fontSize: {
        'hero': ['28px', { lineHeight: '1.2', fontWeight: '800' }],
        'heading': ['22px', { lineHeight: '1.3', fontWeight: '700' }],
        'heading-sm': ['20px', { lineHeight: '1.3', fontWeight: '700' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        'tiny': ['11px', { lineHeight: '1.3', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};

export default config;
