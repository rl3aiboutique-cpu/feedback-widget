/**
 * Tailwind CSS preset that the host extends.
 *
 * Usage in the host's `tailwind.config.ts`:
 *
 *   import feedbackPreset from "@rl3/feedback-widget/tailwind-preset"
 *   export default {
 *     presets: [feedbackPreset],
 *     content: [
 *       "./src/**\/*.{ts,tsx}",
 *       "./node_modules/@rl3/feedback-widget/dist/**\/*.{js,mjs}",
 *     ],
 *   }
 *
 * The widget's components reference standard shadcn-style CSS variables
 * (--primary, --secondary, --background, --foreground, etc.). The host
 * defines these via `@layer base { :root { --primary: ... } }` and the
 * widget inherits them.
 */

import type { Config } from "tailwindcss";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};

export default preset;
