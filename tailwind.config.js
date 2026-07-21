/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Police intelligence blue theme
        ink: {
          950: '#070d1b',
          900: '#0b1426',
          850: '#0f1c33',
          800: '#13233f',
          700: '#1b3056',
          600: '#243d6b',
        },
        steel: {
          50: '#eef3fb',
          100: '#d8e4f5',
          200: '#b3c9eb',
          300: '#7ea3da',
          400: '#4d7fc6',
          500: '#2f63ad',
          600: '#234e8c',
          700: '#1c3e72',
          800: '#172f57',
          900: '#122544',
        },
        accent: {
          DEFAULT: '#3b82f6',
          glow: '#60a5fa',
          cyan: '#22d3ee',
          amber: '#f59e0b',
          red: '#ef4444',
          green: '#10b981',
        },
        risk: {
          low: '#10b981',
          medium: '#f59e0b',
          high: '#f97316',
          critical: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,130,246,0.15), 0 8px 30px -8px rgba(59,130,246,0.35)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        sweep: { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        slideIn: { from: { transform: 'translateX(-8px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s ease-out',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        sweep: 'sweep 4s linear infinite',
        slideIn: 'slideIn 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
