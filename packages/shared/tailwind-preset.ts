import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#131313',
        foreground: '#e2e2e2',
        card: '#1f1f1f',
        'card-foreground': '#e2e2e2',
        primary: '#c6c6cf',
        'primary-foreground': '#2f3037',
        secondary: '#c7c6c9',
        'secondary-foreground': '#303033',
        muted: '#353535',
        'muted-foreground': '#c7c6cb',
        accent: '#4edea3',
        'accent-foreground': '#003824',
        destructive: '#ffb4ab',
        'destructive-foreground': '#690005',
        border: '#353535',
        input: '#353535',
        ring: '#4edea3',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.25rem',
        sm: '0.125rem',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        float: 'float 4s infinite ease-in-out',
        sweep: 'sweep 3s infinite linear',
      },
      aspectRatio: {
        'table-desktop': '16 / 9',
      },
    },
  },
  plugins: [],
} as Config;
