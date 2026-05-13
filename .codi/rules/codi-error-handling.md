---
name: codi-error-handling
description: Error handling, resilience patterns, and observability integration
priority: high
alwaysApply: true
managed_by: codi
version: 1
---

# Error Handling

## Core Principles
- Never silently swallow errors — every error must be handled or propagated

BAD: `catch (e) { /* ignore */ }`
GOOD: `catch (e) { logger.error("payment failed", { orderId, error: e }); throw; }`

- Use typed errors with error codes for programmatic handling — callers can branch on error type
- Return Result types for recoverable operations
- Throw/raise only for programmer errors (bugs), not expected failures — expected failures are control flow, not exceptions

## Error Messages
- Write actionable error messages: what happened, why, and how to fix it

BAD: `"Error occurred"`
GOOD: `"Failed to connect to database at localhost:5432 — check DB_HOST and ensure PostgreSQL is running"`

- Include relevant context: operation, input, expected vs actual
- Never expose internal details (stack traces, SQL) to end users — attackers use these to find vulnerabilities
- Log full details server-side, return sanitized messages to clients

## Logging & Observability
- Log errors with structured context (who, what, where, when) — enables filtering and alerting in log aggregation tools
- Use appropriate severity levels: debug, info, warn, error, fatal
- Include correlation IDs for request tracing — essential for debugging in distributed systems
- Do not log sensitive data (passwords, tokens, PII)
- Record errors as OpenTelemetry span events with structured attributes — enables correlation across distributed services
- Include trace IDs in error responses — allows support teams to trace user-reported errors through the entire system
- Track error rates as SLIs and define error budgets — pause feature releases when the budget is depleted

## Circuit Breaker
- Use circuit breakers for calls to external services — stop calling a failing service and fail fast instead of queuing timeouts
- Circuit breaker states: Closed (normal), Open (fail fast), Half-Open (probe recovery) — monitor state transitions as metrics
- Combine with retries: retries handle transient blips, circuit breakers handle persistent failures

## Bulkhead Isolation
- Isolate failure domains with bulkheads — a failure in one integration should not exhaust resources for unrelated requests
- Use separate thread pools or connection pools per external dependency

## Resilience
- Implement timeouts for all external calls — prevents a single slow service from blocking the entire system
- Use retries with exponential backoff for transient failures
- Provide fallback behavior where appropriate
- Fail fast on configuration errors at startup, not at runtime — surfaces problems before they reach users

## Async Error Handling
- Use dead letter queues for messages that fail processing after max retries — prevents poison messages from blocking the queue
- Implement compensation (saga) patterns for multi-step distributed operations — partial completion must be reversible

## Frontend Error Boundaries
- Wrap UI sections in error boundaries — a crash in one widget should not take down the entire page
- Display user-friendly fallback UI with a retry option — never show raw stack traces

## Cleanup
- Always release resources in finally blocks or equivalent
- Close database connections, file handles, and network sockets — leaked connections exhaust pools and cause outages
- Roll back partial operations on failure
- Leave the system in a consistent state after errors
