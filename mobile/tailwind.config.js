/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        paper: '#f3fbfb',
        ink: '#123033',
        mute: '#5c7576',
        pine: '#0f5c5e',
        moss: '#146e70',
        clay: '#4BBBBC',
        sand: '#d7f4f4',
        card: '#ffffff',
        line: '#c9e4e4',
      },
    },
  },
  plugins: [],
};
