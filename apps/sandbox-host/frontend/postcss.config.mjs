// Tailwind v4 via PostCSS. Without this file Vite serves @import "tailwindcss"
// as a raw CSS import that never gets processed and the @source scan never
// runs — so any class used only in App.tsx (zinc/cyan/grid utilities) ends
// up missing from the compiled bundle.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
