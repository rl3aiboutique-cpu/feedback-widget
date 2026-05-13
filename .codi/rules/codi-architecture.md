---
name: codi-architecture
description: Architecture guidelines, design patterns, and module boundaries
priority: high
alwaysApply: true
managed_by: codi
version: 1
---

# Architecture Guidelines

## File Organization
- Respect the configured maximum file line limit — large files signal too many responsibilities
- One responsibility per module
- Group by feature or domain, not by file type — reduces cross-directory coupling when a feature changes

BAD: models/, controllers/, views/ (change one feature, touch every directory)
GOOD: users/, orders/, payments/ (all feature files colocated)

- Keep related files close together in the directory tree

## Modular Monolith First
- Start with a modular monolith — extract microservices only when scaling demands prove the boundary is stable
- Enforce module boundaries at compile time (internal packages, module visibility) — boundaries without enforcement erode
- Use event-driven communication between modules when preparing for future extraction

## Architecture Patterns
- Use hexagonal architecture (ports and adapters) for core domains — separate business logic from infrastructure through defined ports
- Consider vertical slice architecture for feature delivery — each use case is self-contained with its own handler, validation, and persistence
- Use CQRS when read and write models have divergent requirements — do not apply it everywhere by default
- Define bounded contexts to identify module boundaries — a module owns its data and exposes only contracts

## Dependencies
- Depend on abstractions, not concrete implementations — enables swapping implementations without changing callers
- No circular dependencies between modules — circular deps make code untestable and hard to reason about
- Dependencies flow inward: UI → services → domain → utilities
- Use dependency injection for testability
- Use path aliases (`#src/*`, `@/*`) for cross-module imports — makes dependency direction visible and survives file moves

## Design Principles
- Reuse existing components before creating new ones — search the codebase first
- Keep business logic in services or hooks — never in UI components or controllers
- Prefer composition over inheritance — inheritance creates rigid hierarchies that are hard to change

BAD: UserController extends BaseController extends AuthController
GOOD: UserController uses AuthService and LoggingMiddleware

- Separate concerns: data access, business rules, presentation
- Design for change: isolate likely change points behind interfaces

## Event-Driven Communication
- Use the Outbox Pattern to guarantee at-least-once event delivery without distributed transactions
- Use the Inbox Pattern for message idempotency at the consumer side
- Prefer async events between modules over synchronous calls — reduces coupling and enables independent scaling

## API Boundaries
- Define clear contracts between modules
- Use types/interfaces at module boundaries — catches integration errors at compile time
- Validate data at system boundaries, trust internal data
- Keep internal implementation details private

## Avoid Over-Engineering
- Solve the current problem, not hypothetical future ones
- Three similar lines are better than a premature abstraction — wait for the pattern to emerge
- Add complexity only when it reduces overall system complexity
- If in doubt, choose the simpler approach
