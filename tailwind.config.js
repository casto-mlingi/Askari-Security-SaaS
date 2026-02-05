/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e293b',
        'primary-light': '#334155',
        'primary-dark': '#0f172a',
        secondary: '#3b82f6',
        'secondary-light': '#60a5fa',
        'secondary-dark': '#2563eb',
        accent: '#06b6d4',
        'accent-light': '#22d3ee',
        'accent-dark': '#0891b2',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        dark: '#0f172a',
        'dark-light': '#1e293b',
        surface: '#ffffff',
        'surface-secondary': '#f8fafc',
        background: '#f1f5f9',
        'background-secondary': '#e2e8f0',
        border: '#e2e8f0',
        'border-light': '#f1f5f9',
        text: '#1e293b',
        'text-secondary': '#64748b',
        'text-muted': '#94a3b8',
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        hud: ['Outfit', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}