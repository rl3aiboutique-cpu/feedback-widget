/// <reference path="./vite-env.d.ts" />

// Local declaration of `import.meta.env` instead of pulling in
// `vite/client` as a type dep. Keeps the package buildable without
// a forced peer dep on Vite — the host's env types apply at compile
// time when consuming the source; here we only need the shape so
// tsup can emit declarations.

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FEEDBACK_ENABLED?: string;
  readonly VITE_FEEDBACK_POSITION?: string;
  readonly VITE_FEEDBACK_BRAND_PRIMARY_HEX?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_GIT_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
