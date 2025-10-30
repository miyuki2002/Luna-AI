import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./styles/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        background: "hsl(222.2, 84%, 4.9%)",
        foreground: "hsl(210, 40%, 96%)",
        card: {
          DEFAULT: "hsl(222.2, 47.4%, 10.2%)",
          foreground: "hsl(210, 40%, 98%)"
        },
        popover: {
          DEFAULT: "hsl(222.2, 47.4%, 11.2%)",
          foreground: "hsl(210, 40%, 98%)"
        },
        primary: {
          DEFAULT: "hsl(263.4, 70%, 50.4%)",
          foreground: "hsl(210, 40%, 98%)"
        },
        secondary: {
          DEFAULT: "hsl(217.2, 32.6%, 17.5%)",
          foreground: "hsl(210, 40%, 96%)"
        },
        muted: {
          DEFAULT: "hsl(217.2, 32.6%, 17.5%)",
          foreground: "hsl(215, 20.2%, 65.1%)"
        },
        accent: {
          DEFAULT: "hsl(216, 82%, 59%)",
          foreground: "hsl(222.2, 47.4%, 11.2%)"
        },
        destructive: {
          DEFAULT: "hsl(0, 100%, 50%)",
          foreground: "hsl(210, 40%, 98%)"
        },
        border: "hsl(217.2, 32.6%, 18.5%)",
        input: "hsl(217.2, 32.6%, 18.5%)",
        ring: "hsl(263.4, 70%, 50.4%)",
        chart: {
          1: "hsl(263.4, 70%, 50.4%)",
          2: "hsl(180.2, 82.6%, 51.4%)",
          3: "hsl(32.7, 97%, 61%)",
          4: "hsl(346.8, 74%, 61.5%)",
          5: "hsl(199, 89%, 48%)"
        }
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.4s ease forwards",
        "slide-up": "slide-up 0.4s ease forwards"
      }
    }
  },
  plugins: [animatePlugin]
};

export default config;
