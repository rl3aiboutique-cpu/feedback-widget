# staticDir + STATIC_DIR_MAP Checklist

## When this matters

Any skill whose source tree has subdirectories that must land in the installed
copy at `.codi/skills/<name>/` — e.g. `references/`, `scripts/`, `assets/`,
`agents/`, `tests/`, `lib/` — requires two separate wirings. Miss either one
and the subdirectories silently stop propagating from `dist/` to `.codi/`,
but the source tree still *looks* correct. The failure surfaces later as
broken `[[/path]]` references at commit time.

## The three-point checklist

Each item is mandatory — no alternatives.

### 1. `index.ts` exports `staticDir`

`src/templates/skills/<name>/index.ts` must export `staticDir`, not just
`template`:

```ts
import { resolveStaticDir } from "../resolve-static-dir.js";

export { template } from "./template.js";
export const staticDir = resolveStaticDir("<name>", import.meta.url);
```

`resolveStaticDir` locates the compiled static directory under `dist/` at
runtime. Without this export, the scaffolder has no path to copy from.

### 2. `src/templates/skills/index.ts` re-exports `staticDir`

The barrel at `src/templates/skills/index.ts` must re-export the
`staticDir` alongside `template`:

```ts
export {
  template as mySkill,
  staticDir as mySkillStaticDir,
} from "./my-skill/index.js";
```

Exporting only `template` (the older pattern) is the single most common
regression — the skill still installs, but without its static files.

### 3. `STATIC_DIR_MAP` entry in the loader

`src/core/scaffolder/skill-template-loader.ts` maintains a `STATIC_DIR_MAP`
that maps prefixed skill names to their exported `staticDir`. Add the entry
for every skill with a static directory:

```ts
[prefixedName("my-skill")]: skillTemplates.mySkillStaticDir,
```

Missing this entry means `staticDir` is exported but the scaffolder never
looks it up.

## Verification

After wiring, the pre-commit hook `codi-skill-resource-check` validates
that every `[[/path]]` reference in the source resolves to a real file
inside the skill directory. If the hook fires with
`"no staticDir — resource will not be copied to scaffolded skills"`, step
1 is missing. If it fires with `"references '…' — file does not exist"`
on a path that *does* exist in source, step 2 or step 3 is missing.

## When to skip this entire checklist

A skill with no subdirectories at all (only `template.ts`, `index.ts`,
`evals/`) does not need `staticDir`. Trying to wire one in that case is
harmless but confusing; `resolveStaticDir` returns `undefined` for skills
with no static payload, and the barrel re-export is a no-op.
