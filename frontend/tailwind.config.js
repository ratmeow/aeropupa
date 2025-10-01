/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'at-violet': '#2D0F50',
        'at-lightviolet': '#53228C',
        'at-brown': '#1C181A',
        'at-lightbrown': '#29262C',
        'at-lighterbrown': '#37343B',
        'at-gray': '#C2C2C2',
        'at-darkgray': '#404040',
      },
      fontFamily: {
        'custom': ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
}