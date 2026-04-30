import { Config } from 'tailwindcss';

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

declare const preset: Partial<Config>;

export { preset as default };
