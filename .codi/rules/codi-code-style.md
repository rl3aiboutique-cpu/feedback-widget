---
name: codi-code-style
description: Code style and formatting conventions
priority: medium
alwaysApply: true
managed_by: codi
version: 1
---

# Code Style

## Naming Conventions
- Variables and functions: camelCase
- Classes, interfaces, and types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for modules, PascalCase for components
- Booleans: prefix with is, has, can, should (e.g., isActive, hasPermission) — makes conditionals read like English

## Functions
- Keep functions under 30 lines — longer functions are harder to test and reason about

BAD: A 60-line function doing validation + transformation + persistence
GOOD: Three focused functions: validate(), transform(), persist()

- Single responsibility: one function does one thing
- Pure functions preferred: same input always produces same output — easier to test and cache
- Limit parameters to 3 — use an options object for more

BAD: `createUser(name, email, role, team, isActive, notify)`
GOOD: `createUser({ name, email, role, team, isActive, notify })`

## Control Flow
- Use early returns and guard clauses to handle edge cases at the top of functions — keeps the happy path at the outer scope and reduces nesting
- Prefer exhaustive pattern matching (switch/when with sealed types) over if-else chains — the compiler enforces that all cases are handled
- Avoid deep nesting: if indentation exceeds 3 levels, refactor — use early returns, extract functions, or invert conditions

## Immutability by Default
- Treat data as immutable unless mutation is explicitly required — create new objects instead of modifying existing ones
- Use language-level immutability features: const, readonly, frozen, final — mutation should require a conscious choice

## File Organization
- One primary export per file where practical — simplifies imports and dependency tracking
- Group imports: external libraries, path-aliased modules, relative modules, types
- Order imports alphabetically within each group
- Keep files focused on a single concern
- Never use deep relative imports (2+ levels of `../`) — use path aliases (`#src/*`, `@/*`) instead; deep traversals are fragile and unreadable

## Type Discipline
- Treat type errors as design feedback, not noise — fix the design, don't suppress the error
- Automate type generation in CI where applicable (API schemas, database types, GraphQL)

## Complexity Metrics
- Track cognitive complexity, not just line count — a 25-line function with 4 levels of nesting is harder to read than a 40-line flat function
- Configure linters to warn on cognitive complexity thresholds (e.g., SonarQube default of 15)

## Linting
- Always fix linting errors before moving to other tasks — never leave broken lint for later
- Never suppress linter warnings without a documented reason and ticket reference

## Error Handling
- Never silently swallow errors (empty catch blocks) — hidden failures cause hard-to-debug production issues
- Handle errors at the appropriate level, not everywhere
- Use typed errors when the language supports them
- Always clean up resources in finally blocks

## Dead Code
- Remove unused functions, imports, and variables — dead code misleads readers and increases maintenance burden
- Remove stale feature flags after rollout is complete — lingering flags accumulate as tech debt

## No Hardcoding — Single Source of Truth
- Never hardcode values that are defined or derivable elsewhere — duplicated lists drift and cause bugs
- Magic numbers and magic strings must be named constants with clear intent
- Dynamic lists (supported agents, preset names, template catalogs, flag keys) must be derived from their source of truth, not duplicated in arrays or sets
- Configuration values belong in environment variables, config files, or constants modules — not scattered in business logic
- If you find yourself copying a list from one file to another, extract it to a shared source and import it

BAD: `const presets = ['minimal', 'balanced', 'strict']` (duplicates the preset registry)
GOOD: `const presets = getPresetNames()` (derived from the registry)

BAD: `if (status === 3)` (what does 3 mean?)
GOOD: `if (status === STATUS.APPROVED)` (self-documenting constant)

## Comments
- Write self-documenting code first
- Comment the WHY, not the WHAT — the code already shows what it does

BAD: `// increment counter` above `counter++`
GOOD: `// retry count resets after successful auth per RFC 6749 §4.1.3`

- Remove commented-out code — version control has the history
- Use TODO/FIXME with ticket references, not open-ended notes
