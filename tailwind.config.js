/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        display: ["Cormorant Garamond", "serif"],
      },
      boxShadow: {
        glow: "0 18px 45px rgba(92, 64, 42, 0.08)",
      },
      colors: {
        ink: "#1f1726",
        clay: "#8f6d58",
        roseglass: "#fffcf8",
      },
    },
  },
  plugins: [],
};
