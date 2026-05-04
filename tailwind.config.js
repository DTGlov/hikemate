/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Phase 9.1 — point `font-sans` at Geist so any NativeWind
      // `font-sans`/default class resolves to the loaded family.
      // The `Text.defaultProps` override in app/_layout.tsx covers
      // <Text> elements without an explicit family.
      fontFamily: {
        sans: ['Geist_400Regular'],
        medium: ['Geist_500Medium'],
        bold: ['Geist_700Bold'],
      },
    },
  },
  plugins: [],
};
