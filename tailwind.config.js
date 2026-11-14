/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-app)',
        sidebar: 'var(--bg-sidebar)',
        card: 'var(--bg-card)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          hover: 'var(--bg-surface-hover)',
          active: 'var(--bg-surface-active)'
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          muted: 'var(--border-muted)',
          gray: 'var(--border-gray)'
        },
        foreground: {
          DEFAULT: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          dark: 'var(--text-dark)'
        },
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          tint: 'var(--accent-tint)',
          tintText: 'var(--accent-tint-text)',
          youtube: 'var(--accent-youtube)',
          instagram: 'var(--accent-instagram)',
          facebook: 'var(--accent-facebook)'
        },
        status: {
          success: 'var(--status-success)'
        },
        ticks: 'var(--ticks-color)'
      },
      fontFamily: {
        sans: ['Inter', 'Nirmala UI', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'Nirmala UI', 'Segoe UI', 'sans-serif']
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '18px'
      }
    }
  },
  plugins: []
};
