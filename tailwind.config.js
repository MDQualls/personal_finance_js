/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#1a2332',
          text: '#8a9bb0',
          'active-bg': '#00b89c',
          'active-text': '#ffffff',
        },
        surface: {
          DEFAULT: '#ffffff',
          hover: '#f8fafc',
          page: '#f4f6f9',
        },
        text: {
          primary: '#1a2332',
          secondary: '#6b7a8d',
          disabled: '#b0bac6',
        },
        accent: {
          DEFAULT: '#00b89c',
          hover: '#009e87',
          subtle: '#e6f7f5',
        },
        border: {
          DEFAULT: '#e8ecf0',
          focus: '#00b89c',
        },
        budget: {
          ok: '#22c55e',
          warn: '#f59e0b',
          over: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        input: '8px',
        badge: '99px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        tooltip: '0 4px 12px rgba(0,0,0,0.10)',
      },
      spacing: {
        sidebar: '220px',
        topbar: '56px',
      },
    },
  },
  plugins: [],
}
