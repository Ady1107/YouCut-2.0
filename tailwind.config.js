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
        background: '#0B0C10',
        sidebar: '#0F1116',
        card: '#14161D',
        surface: {
          DEFAULT: '#1B1E27',
          hover: '#242834',
          active: '#2A2E3B'
        },
        border: {
          DEFAULT: '#232733',
          subtle: '#1E212B',
          strong: '#2A2E3B',
          muted: '#3A3F4E',
          gray: '#6B7285'
        },
        foreground: {
          DEFAULT: '#F3F4F7',
          muted: '#9BA1B0',
          subtle: '#C6CAD5',
          dark: '#1A0805'
        },
        accent: {
          DEFAULT: '#FF5B4A',
          hover: '#FF4532',
          tint: '#2A1B19',
          tintText: '#FF8C7E',
          youtube: '#FF5B4A',
          instagram: '#E1306C',
          facebook: '#1877F2'
        },
        status: {
          success: '#3DDC97'
        },
        ticks: '#4A5062'
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
