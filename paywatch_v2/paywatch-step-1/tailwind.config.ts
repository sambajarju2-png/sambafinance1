import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        navy: 'var(--navy)',
        blue: {
          DEFAULT: 'var(--blue)',
          light: 'var(--blue-light)',
        },
        text: 'var(--text)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        green: {
          DEFAULT: 'var(--green)',
          light: 'var(--green-light)',
        },
        amber: {
          DEFAULT: 'var(--amber)',
          light: 'var(--amber-light)',
        },
        orange: {
          DEFAULT: 'var(--orange)',
          light: 'var(--orange-light)',
        },
        red: {
          DEFAULT: 'var(--red)',
          light: 'var(--red-light)',
        },
        'dark-red': 'var(--dark-red)',
        purple: {
          DEFAULT: 'var(--purple)',
          light: 'var(--purple-light)',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero': ['28px', { lineHeight: '1.2', fontWeight: '800', letterSpacing: '-0.03em' }],
        'heading': ['22px', { lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.02em' }],
        'section': ['16px', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '-0.01em' }],
        'card-title': ['14px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        'caption': ['11px', { lineHeight: '1.4', fontWeight: '400' }],
        'tiny': ['10px', { lineHeight: '1.3', fontWeight: '600' }],
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '16px',
        'button': '4px',
        'badge': '4px',
        'input': '8px',
        'segment': '8px',
        'segment-inner': '6px',
        'drawer': '20px',
      },
      boxShadow: {
        'modal': '0 8px 30px rgba(0, 0, 0, 0.15)',
        'toast': '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite ease-in-out',
        'slide-up': 'slideUp 300ms ease-out',
        'slide-down': 'slideDown 200ms ease-out',
        'fade-in': 'fadeIn 200ms ease-out',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
