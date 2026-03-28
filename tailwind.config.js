/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'rms-blue': '#1e3a8a',
        'rms-gray': '#f3f4f6'
      }
    },
  },
  plugins: [],
}
