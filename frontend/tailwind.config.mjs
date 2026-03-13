/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#050507",
        foreground: "#f5f5f5",
        cyan: {
          DEFAULT: "#00e5ff"
        }
      }
    }
  },
  plugins: []
};

