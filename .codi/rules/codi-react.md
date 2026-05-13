---
name: codi-react
description: React-specific conventions — components, hooks, state management, performance
priority: medium
alwaysApply: false
managed_by: codi
language: typescript
version: 1
---

# React Conventions

## Components
- Use functional components with TypeScript interfaces for props
- One component per file — name the file after the component (PascalCase)
- Keep components under 150 lines — large components signal mixed responsibilities
- Colocate related files: component, styles, tests, types in the same directory — reduces cognitive overhead when modifying a feature

```typescript
// Component file: UserCard.tsx
interface UserCardProps {
  name: string;
  email: string;
  onEdit: (id: string) => void;
}

export function UserCard({ name, email, onEdit }: UserCardProps) {
  return (/* ... */);
}
```

## React 19 Features
- Use `use()` to read Promises and Context directly in render — replaces many useEffect data-fetching patterns
- `use()` can be called inside conditionals and loops — unlike other hooks
- Use `useActionState` to manage form submission state — consolidates pending state, error handling, and result
- Use `useFormStatus` in child components to access parent form submission state without prop drilling
- Use `useOptimistic` for immediate UI updates while async operations complete
- Pass `ref` as a regular prop — `forwardRef` is deprecated in React 19
- Render `<title>`, `<link>`, `<meta>` directly in components — React 19 hoists them to `<head>` automatically

## React Compiler
- With React Compiler enabled, manual `useMemo`, `useCallback`, and `memo` are unnecessary — the compiler auto-memoizes
- Follow the Rules of React strictly: components and hooks must be pure, no mutation of props/state during render
- If not using React Compiler, continue using `useMemo`/`useCallback` for expensive computations and stable callback references

## Hooks
- Extract reusable logic into custom hooks (`use` prefix)
- Keep hooks focused — one concern per hook

## State Management
- Start with local state (`useState`) — lift only when needed
- Use `useReducer` for complex state with multiple related fields — prevents inconsistent partial updates
- Keep server state separate from UI state (use React Query, SWR, or similar) — mixing them causes stale data bugs
- Avoid prop drilling beyond 2 levels — use context or composition

## Performance
- Use `React.lazy()` + `Suspense` for route-level code splitting
- Avoid creating objects and functions inside render — extract to constants or hooks
- Use `key` prop correctly — stable, unique identifiers, never array indices for dynamic lists
- Profile with React DevTools before optimizing

## Server Components
- Prefer Server Components for data fetching and static content — zero client JS
- Add `'use client'` only when the component needs interactivity (event handlers, hooks, browser APIs)
- Keep client components small and push them to the leaves of the component tree
- Use Server Actions (`"use server"`) for form mutations — enables progressive enhancement

## Patterns to Avoid
- No inline styles — use CSS modules, Tailwind, or styled-components
- No nested ternaries in JSX — extract to early returns or variables for readability
- No `useEffect` for derived state — compute during render instead; useEffect for derived state causes extra renders
- No direct DOM manipulation — use refs only when necessary

