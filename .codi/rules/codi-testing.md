---
name: codi-testing
description: Testing strategy, TDD workflow, and test infrastructure
priority: medium
alwaysApply: true
managed_by: codi
version: 1
---

# Testing Standards

## Testing Strategy — Prioritize by ROI
- Write mostly integration tests — they provide the highest confidence-to-cost ratio (testing trophy model)
- Use unit tests for pure logic with complex branching — not for trivial code
- Use end-to-end tests sparingly for critical user journeys — they are slow and brittle
- Use static analysis (types, linters) as the first line of defense — catches bugs before tests run

## Coverage & Requirements
- Maintain minimum 80% code coverage
- All new features require tests before merging — untested code is a liability
- All bug fixes require a regression test — prevents the same bug from recurring
- Critical paths require integration tests

## Test-Driven Development (TDD)
1. RED: Write a failing test that describes the expected behavior
2. GREEN: Write the minimal implementation to make it pass
3. REFACTOR: Improve the code while keeping tests green

## Test Structure
- Follow arrange-act-assert (AAA) pattern — makes test intent immediately clear
- One assertion per test when practical
- Use descriptive names: "should [behavior] when [condition]"
- Keep tests independent — no shared mutable state between tests

BAD: Test B relies on data created by Test A
GOOD: Each test creates its own data in the arrange phase

## What to Test
- Business logic and domain rules
- Edge cases: empty inputs, nulls, boundaries, overflow — most bugs hide at boundaries
- Error paths: invalid input, network failures, timeouts
- Integration points: API endpoints, database operations

## What NOT to Test
- Framework internals or third-party library behavior — trust the library, test your usage
- Trivial getters/setters with no logic
- Implementation details (test behavior, not structure) — implementation-coupled tests break on every refactor

BAD: Assert that an internal method was called 3 times
GOOD: Assert that the output matches the expected result

## Contract Testing
- Use consumer-driven contract tests (Pact or similar) between services — catches integration breaks before deployment
- Each consumer defines its expected API contract; the provider verifies it in CI

## Realistic Test Infrastructure
- Use Testcontainers for integration tests that need real databases, message brokers, or caches — mocking persistence hides real bugs
- Reserve mocks for truly external services (third-party APIs, payment gateways)

## Mocking
- Mock only external dependencies (APIs, third-party services)
- Do not mock the module under test — you would be testing the mock, not the code
- Prefer fakes and stubs over complex mock frameworks
- Reset mocks between tests to avoid leaking state

## Advanced Techniques
- Use property-based testing for functions with large input spaces — the framework generates edge cases you would not write by hand
- Use mutation testing periodically to verify test suite effectiveness — if mutants survive, tests are weak
- Avoid large snapshot tests — developers blindly update them instead of investigating failures; keep snapshots small and focused

## Speed & Parallelism
- Run tests in parallel by default — ensure tests are isolated with no shared mutable state
- Keep the full test suite under 5 minutes — slow suites get skipped
