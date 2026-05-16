---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# (codi-rule) codi-typescript

# TypeScript Conventions

## Strict Typing
- Never use `any` — use `unknown` and narrow with type guards
- Enable `strict: true` in tsconfig.json — catches entire categories of bugs at compile time
- Use discriminated unions over type assertions — type assertions bypass the compiler and hide bugs
- Prefer `interface` for object shapes, `type` for unions and intersections

```typescript
// BAD: any loses all type safety
function parse(data: any) { return data.name; }

// GOOD: unknown forces safe narrowing
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return String(data.name);
  }
  throw new Error('Invalid data');
}
```

## The `satisfies` Operator
- Use `satisfies` to validate expressions against a type without widening — retains literal types
- Prefer `satisfies` over `as` for config objects, route maps, and static data — `as` bypasses the compiler, `satisfies` validates and narrows
- Default hierarchy: type annotations first, `satisfies` when precision matters, `as` as a last resort

## Exports & Imports
- Use named exports — no default exports (improves refactoring and auto-imports)
- Group imports: external libraries, internal modules, types — makes dependency sources immediately visible
- Use `import type` for type-only imports — keeps runtime bundle clean
- Do not use index.ts barrel files for re-exporting — they break tree-shaking, inflate bundles, and slow down HMR and test runners
- Import directly from the source module, not through a barrel
- Never use deep relative imports (2+ levels of `../`) — they are fragile, unreadable, and break on file moves; use path aliases instead
- Never use `require()` in TypeScript — use ESM `import` or `createRequire` from `node:module` when dynamic require is unavoidable

## Path Aliases — Eliminate Deep Relative Imports
- Use Node.js subpath imports (`#src/*`) for projects using `moduleResolution: "NodeNext"` — native, zero-dependency, works at runtime without build tools
- Use `@/*` path aliases for projects using `moduleResolution: "Bundler"` (Vite, Next.js, webpack 5) — requires bundler to resolve at build time
- Configure aliases in both `package.json` (`"imports"` field) and `tsconfig.json` (`"paths"`) — ensures runtime resolution and IDE/type-checker support
- Keep relative imports (`./`, `../`) only for same-directory siblings — one `../` level is the maximum for relative imports

```jsonc
// package.json — Node.js subpath imports (NodeNext)
{ "imports": { "#src/*": "./src/*" } }

// tsconfig.json — type-checker + IDE resolution
{ "compilerOptions": { "paths": { "#src/*": ["./src/*"] } } }
```

```typescript
// BAD: deep relative import — fragile and unreadable
import { UserSchema } from "../../schemas/user.js";

// BAD: require() in TypeScript
const pkg = require("./package.json");

// GOOD: subpath import — clear, stable, refactor-proof
import { UserSchema } from "#src/schemas/user.js";

// GOOD: createRequire when dynamic require is unavoidable
import { createRequire } from "node:module";
const esmRequire = createRequire(import.meta.url);

// GOOD: relative import for same-directory sibling
import { validate } from "./validation.js";
```

## Module Configuration
- Enable `verbatimModuleSyntax: true` in tsconfig — enforces explicit `import type` and prevents silent import elision
- Pair with `moduleResolution: "Bundler"` for projects using modern bundlers (Vite, esbuild, webpack 5)
- Use `moduleResolution: "NodeNext"` for Node.js libraries and CLIs — strict ESM compliance with native subpath import support

## Immutability
- Prefer `const` over `let` — never use `var`
- Use `readonly` on properties that should not change after construction
- Create new objects instead of mutating: spread, map, filter
- Use `as const` for literal types

```typescript
// BAD: mutation
items.push(newItem);

// GOOD: new array
const updated = [...items, newItem];
```

## Async Patterns
- Use `Promise.all()` for independent async operations — avoid sequential await
- Always handle promise rejections — use try/catch or .catch()
- Prefer async/await over .then() chains for readability
- Set timeouts on all external calls

## Validation
- Validate external input at system boundaries with Zod or similar — compile-time types vanish at runtime
- Trust internal types — no redundant runtime checks inside the module
- Use branded types for domain identifiers (UserId, OrderId) — prevents accidentally passing an OrderId where a UserId is expected

## Enums & Constants
- Prefer `as const` objects over TypeScript enums — better tree-shaking and no runtime overhead
- Use string literal unions for simple choices: `type Status = 'active' | 'inactive'`

## Linting & Formatting
- Evaluate Biome as a unified linter and formatter — single binary, 10-25x faster than ESLint + Prettier combined
- If using ESLint, prefer flat config format (eslint.config.js) — the legacy .eslintrc format is deprecated since ESLint v9
- Run formatting and linting in pre-commit hooks — do not rely on IDE settings alone

## Decorators
- Prefer TC39 standard decorators (TS 5.0+) over `experimentalDecorators` for new projects — standard decorators are spec-compliant and forward-compatible
- Use decorator metadata (`Symbol.metadata`, TS 5.2+) instead of reflect-metadata for runtime type information

<!-- Generated by Codi | Do not edit — run: codi generate -->
