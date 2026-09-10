/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Inverted, violet-tinted neutrals: in dark-only mode Tailwind's `dark:`
        // variants map 900/950 to deep-space backgrounds while 100–300 stay light
        // for text and inverted fills.
        neutral: {
          50: "#f8f8fb",
          100: "#f2f2f6",
          200: "#e6e6ee",
          300: "#d5d5e0",
          400: "#aaaabd",
          500: "#9a9aad",
          600: "#73738a",
          700: "#272736",
          800: "#1a1a26",
          900: "#14141e",
          950: "#0e0e16",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "drift-a": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(40px, -30px) scale(1.15)" },
        },
        "drift-b": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-50px, 25px) scale(1.1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "fade-up-1": "fade-up 0.35s ease-out 0.07s both",
        "fade-up-2": "fade-up 0.35s ease-out 0.14s both",
        "fade-up-3": "fade-up 0.35s ease-out 0.21s both",
        "drift-a": "drift-a 16s ease-in-out infinite",
        "drift-b": "drift-b 20s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
