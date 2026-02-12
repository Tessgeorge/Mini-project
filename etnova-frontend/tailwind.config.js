/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand Color - Bright Teal
        primary: {
          DEFAULT: '#00D2C4',
          hover: '#00BFB3',
          light: '#00E6D6',
        },
        
        // Background Colors
        'background-light': '#F4F8F8',
        'background-dark': '#0F2322',
        
        // Text Colors (using Tailwind's slate as base)
        'ink': '#0f172a',          // slate-900 - primary text
        'muted': '#64748b',        // slate-500 - secondary text
        
        // Borders
        'line': '#E6EEF0',
        
        // Additional semantic colors
        'bg-left': '#0F2322',      // For dark backgrounds/buttons
      },
      
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      
      boxShadow: {
        primary: "0 14px 35px rgba(0, 230, 214, 0.22)",
      },
    },
  },
  plugins: [],
}
