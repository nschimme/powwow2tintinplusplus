/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: [
    "./index.html",
    "./docs/**/*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./docs/layouts/**/*.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    typography,
  ],
}
