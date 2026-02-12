/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#00E6D6",
        "bg-right": "#F4F8F8",
        "bg-left": "#0F2322",
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E6EEF0",
      },
      boxShadow: {
        primary: "0 14px 35px rgba(0, 230, 214, 0.22)",
      },
    },
  },
  plugins: [],
}
