import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // <--- This enables the switch
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // This maps your Tailwind classes (like 'bg-pw-surface') 
        // to your CSS variables (like '--surface')
        pw: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          navy: 'var(--navy)',
          blue: 'var(--blue)',
          text: 'var(--text)',
          muted: 'var(--muted)',
          border: 'var(--border)',
          green: 'var(--green)',
          amber: 'var(--amber)',
          orange: 'var(--orange)',
          red: 'var(--red)',
          'dark-red': 'var(--dark-red)',
          purple: 'var(--purple)',
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
