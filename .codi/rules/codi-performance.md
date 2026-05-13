---
name: codi-performance
description: Performance optimization, Core Web Vitals, and observability-driven tuning
priority: medium
alwaysApply: true
managed_by: codi
version: 1
---

# Performance Guidelines

## Web Performance Metrics
- Track Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1 — these are Google's ranking signals and user experience benchmarks
- Set performance budgets in CI — fail builds that regress bundle size or LCP beyond thresholds
- Use resource hints (preload, prefetch, preconnect) for critical assets

## Database & Queries
- Avoid N+1 queries — use eager loading or batch fetching; N+1 turns a single page load into hundreds of queries

BAD: Loop fetching each user's orders one by one (100 users = 101 queries)
GOOD: Eager load with JOIN or batch fetch (100 users = 2 queries)

- Add indexes for frequently queried columns — unindexed queries degrade exponentially with data growth
- Use pagination for list endpoints — never return unbounded results
- Select only needed columns, not SELECT * — reduces memory usage and network transfer
- Control query depth aggressively in GraphQL and nested APIs — unbounded depth enables denial-of-service

## Connection Pooling
- Configure pool size based on expected concurrency — too small starves requests, too large exhausts database connections
- Set max connection lifetime to prevent stale connections — rotate connections before the database's own timeout
- Monitor pool utilization — consistently full pools signal under-provisioning

## Async & Concurrency
- Parallelize independent async operations (Promise.all or equivalent) — sequential awaits compound latency

BAD: `await fetchUser(); await fetchOrders(); await fetchSettings();` (3x latency)
GOOD: `await Promise.all([fetchUser(), fetchOrders(), fetchSettings()])` (1x latency)

- Do not block the main thread with synchronous I/O
- Use connection pooling for database and HTTP clients — creating connections per request is expensive
- Set appropriate timeouts on all async operations

## Edge & Runtime Performance
- Move latency-sensitive logic to edge functions (auth checks, personalization, redirects) — reduces round-trip to origin
- Use streaming responses for large pages — send HTML progressively instead of waiting for full render

## Memory Management
- Clean up event listeners, timers, and subscriptions when components unmount — leaked references prevent garbage collection
- Use WeakMap/WeakRef for caches that should not prevent garbage collection
- Profile memory in CI for long-running applications — memory leaks are silent until they cause OOM crashes

## Caching
- Cache expensive computations and frequently accessed data
- Define cache invalidation strategy before adding a cache — cache without invalidation causes stale data bugs
- Use appropriate TTLs — stale data is worse than no cache
- Cache at the right level: in-memory, CDN, or distributed

## Payload & Transfer
- Minimize payload sizes — send only what the client needs
- Compress responses (gzip/brotli) for text-based formats
- Use streaming for large data transfers — avoids buffering entire responses in memory
- Implement efficient serialization formats

## Observability-Driven Optimization
- Instrument critical paths with OpenTelemetry spans — measure real latency, not assumed latency
- Use distributed tracing to identify the slowest service in a request chain
- Set latency SLOs per endpoint and alert on sustained degradation

## General
- Measure before optimizing — profile to find actual bottlenecks
- Lazy load resources that are not immediately needed
- Prefer algorithms with better time complexity for large datasets
- Set performance budgets and monitor regressions — without budgets, performance degrades silently
