/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                background: "#141414",
                foreground: "#e5e5e5",
                ncyan: {
                    DEFAULT: "#06b6d4",
                    dark: "#0891b2",
                    light: "#22d3ee"
                },
                surface: {
                    DEFAULT: "#181818",
                    hover: "#232323",
                    light: "#2a2a2a"
                }
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"]
            }
        }
    },
    plugins: []
};
