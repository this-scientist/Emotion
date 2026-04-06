/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A90D9',
          light: '#5BA0E9',
        },
        background: {
          DEFAULT: '#FFFFFF',
          secondary: '#F5F7FA',
        },
        text: {
          primary: '#2C3E50',
          secondary: '#5A6D82',
        },
        success: '#67C23A',
        warning: '#E6A23C',
        danger: '#F56C6C',
      },
      fontFamily: {
        sans: ['PingFang-SC', 'Microsoft YaHei', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
