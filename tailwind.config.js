/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './public/**/*.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans JP"', 'sans-serif'],
        mono: ['"Roboto Mono"', 'monospace'],
      },
      colors: {
        'atom-one-dark': {
          lighter: '#3d4148',
          light: '#333842',
          DEFAULT: '#282c34',
          deep: '#21252b'
        },
        primary: '#1a7ba0'
      }
    }
  },
  plugins: [],
}
