/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors
        primary: {
          DEFAULT: '#3E6A8A',
          50: '#E8EEF3',
          100: '#C5D6E3',
          200: '#9FBDD1',
          300: '#79A4BF',
          400: '#5C8BA5',
          500: '#3E6A8A',
          600: '#365E7A',
          700: '#2C5270',
          800: '#224260',
          900: '#1A344C',
        },
        secondary: {
          DEFAULT: '#2C5270',
          light: '#3E6A8A',
          dark: '#1A344C',
        },
        accent: {
          DEFAULT: '#5C8BA5',
          light: '#79A4BF',
          dark: '#3E6A8A',
        }
      },
    },
  },
  plugins: [],
}

