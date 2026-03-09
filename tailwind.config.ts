import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'space-blue': '#0B1D3A',
        'electric-green': '#00FFA6',
        'orange-accent': '#FF7A00',
        'dark-nav': '#060F1F',
        'card-bg': '#0D2347',
        'card-border': '#1A3A5C',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulseGreen 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'wave': 'wave 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'data-flow': 'dataFlow 1.5s linear infinite',
      },
      keyframes: {
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 5px #00FFA6, 0 0 10px #00FFA6' },
          '50%': { boxShadow: '0 0 20px #00FFA6, 0 0 40px #00FFA6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        wave: {
          '0%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(2.5)' },
          '100%': { transform: 'scaleY(1)' },
        },
        glow: {
          '0%': { textShadow: '0 0 10px #00FFA6' },
          '100%': { textShadow: '0 0 30px #00FFA6, 0 0 60px #00FFA6' },
        },
        dataFlow: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(10px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
