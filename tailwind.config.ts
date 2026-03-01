import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.25rem'
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        soft: '0 24px 60px -24px hsl(var(--shadow) / 0.45)',
        hard: '0 12px 28px -12px hsl(var(--shadow) / 0.55)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulsebar: {
          '0%': { transform: 'scaleX(0.7)', opacity: '0.75' },
          '50%': { transform: 'scaleX(1)', opacity: '1' },
          '100%': { transform: 'scaleX(0.7)', opacity: '0.75' }
        }
      },
      animation: {
        rise: 'rise 0.5s ease-out both',
        pulsebar: 'pulsebar 1.7s ease-in-out infinite'
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
        display: ['"Newsreader"', 'ui-serif', 'serif']
      }
    }
  },
  plugins: []
};

export default config;
