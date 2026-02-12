/**
 * Etnova Portal Theme Configuration
 * 
 * This file contains all design tokens and theme values used across the application.
 * Use these values to maintain consistency across Student, Mentor, and Admin dashboards.
 */

export const theme = {
  // Color Palette
  colors: {
    primary: '#00E6D6',           // Bright teal accent
    primaryHover: '#00D2C4',      // Slightly darker teal for hover states
    
    // Backgrounds
    backgroundLight: '#F4F8F8',   // Soft light gray
    backgroundDark: '#0F2322',    // Deep teal/greenish black
    
    // Text Colors (Slate palette)
    text: {
      primary: '#0f172a',         // slate-900 (dark)
      secondary: '#64748b',       // slate-500 (medium)
      tertiary: '#94a3b8',        // slate-400 (light)
      inverse: '#f1f5f9',         // slate-100 (light background)
      white: '#ffffff',
    },
    
    // Semantic Colors
    success: '#10b981',           // green-500
    warning: '#f59e0b',           // amber-500
    error: '#ef4444',             // red-500
    info: '#3b82f6',              // blue-500
    
    // UI Elements
    border: {
      light: '#E6EEF0',           // light separator line
      dark: '#334155',            // slate-700
    },
  },

  // Typography
  typography: {
    fontFamily: {
      display: ['Manrope', 'sans-serif'],
      body: ['Manrope', 'sans-serif'],
    },
    
    // Font Sizes (matching Tailwind defaults)
    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
    },
    
    // Font Weights
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  // Spacing (matching Tailwind defaults)
  spacing: {
    px: '1px',
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },

  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    DEFAULT: '0.25rem', // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
  },

  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    soft: '0 10px 25px rgba(15, 23, 42, 0.06)',
    primary: '0 14px 35px rgba(0, 230, 214, 0.22)',
  },

  // Transitions
  transition: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
  },

  // Breakpoints (matching Tailwind defaults)
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Z-Index layers
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 40,
    popover: 50,
    tooltip: 60,
  },
}

// Helper functions for theme usage
export const getColor = (path) => {
  const keys = path.split('.')
  let value = theme.colors
  for (const key of keys) {
    value = value?.[key]
  }
  return value
}

export const getFontSize = (size) => theme.typography.fontSize[size]
export const getSpacing = (size) => theme.spacing[size]
export const getBorderRadius = (size) => theme.borderRadius[size]

export default theme
