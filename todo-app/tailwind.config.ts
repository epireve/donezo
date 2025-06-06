import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Define custom colors for light and dark mode if needed
        // For now, we'll rely on Tailwind's default dark mode variants
        // and the variables in globals.css
        light: {
          background: 'var(--background)', // from globals.css
          foreground: 'var(--foreground)', // from globals.css
          card: '#ffffff',
          'card-foreground': '#0f172a',
          primary: '#3b82f6',
          'primary-foreground': '#ffffff',
        },
        dark: {
          background: 'var(--background)', // from globals.css
          foreground: 'var(--foreground)', // from globals.css
          card: '#1e293b',
          'card-foreground': '#f8fafc',
          primary: '#2563eb',
          'primary-foreground': '#ffffff',
        }
      }
    },
  },
  plugins: [],
}
export default config
