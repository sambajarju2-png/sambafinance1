import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F4F7FB',
        surface: '#FFFFFF',
        'surface-2': '#F8FAFD',
        navy: { DEFAULT: '#0A2540', light: '#0d2f4e' },
        brand: { blue: '#2563EB', 'blue-hover': '#3B82F6', 'blue-pale': '#EFF6FF', 'blue-mid': '#DBEAFE' },
        txt: '#0F172A',
        muted: { DEFAULT: '#64748B', light: '#94A3B8' },
        border: { DEFAULT: '#E2E8F0', strong: '#CBD5E1' },
        status: {
          red: '#DC2626', 'red-pale': '#FEF2F2', 'red-mid': '#FEE2E2',
          amber: '#D97706', 'amber-pale': '#FFFBEB', 'amber-mid': '#FEF3C7',
          green: '#059669', 'green-pale': '#F0FDF4', 'green-mid': '#D1FAE5',
          purple: '#7C3AED', 'purple-pale': '#F5F3FF', 'purple-mid': '#EDE9FE',
        },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 3px rgba(10,37,64,.07), 0 1px 2px rgba(10,37,64,.04)',
        'card-hover': '0 4px 16px rgba(10,37,64,.09), 0 2px 6px rgba(10,37,64,.04)',
        elevated: '0 12px 40px rgba(10,37,64,.13), 0 4px 12px rgba(10,37,64,.06)',
        drawer: '0 24px 64px rgba(10,37,64,.18)',
      },
      borderRadius: { card: '14px' },
      animation: { 'fade-up': 'fadeUp 0.4s ease both', blink: 'blink 2s infinite' },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
      },
    },
  },
  plugins: [],
}
export default config
