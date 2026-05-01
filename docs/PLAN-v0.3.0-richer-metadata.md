# Plan: v0.3.0 — richer metadata capture

## Context

v0.2.0 captures, on every submission, a `metadata_bundle` JSONB with:

```
url, route_name, viewport (w/h/dpr), user_agent, platform, locale,
timezone, app_version, git_commit_sha, console_tail, network_tail,
breadcrumbs, selected_element, feature_flags, timestamp
```

Triagers say this is "good enough to file a ticket but rarely enough
to reproduce a bug". v0.3.0 extends it with signals that consistently
help an LLM hand-off: performance metrics, browser environment depth,
recent route history, and React Query cache health.

This is **additive only** — no schema change, the bundle is JSONB.
Existing v0.2.0 rows keep working; new rows include the extra keys.

## What we add

### Web Vitals (performance)
| Field | Source | Why |
|---|---|---|
| `lcp_ms` | `PerformanceObserver({type: 'largest-contentful-paint'})` last value | "Page felt slow" complaints get an objective number. |
| `cls` | `PerformanceObserver({type: 'layout-shift'})` cumulative | Catches "stuff jumped" UI bugs. |
| `inp_ms` | `PerformanceObserver({type: 'event'})` 98th-percentile interaction-to-next-paint | Replaces FID; the v3 web-vital. |
| `ttfb_ms` | `performance.getEntriesByType('navigation')[0].responseStart` | Backend latency at submission time. |
| `dom_loaded_ms` | same source `domContentLoadedEventEnd` | DOM-ready latency. |

Buffered into the same observer that already captures `console_tail`
and `network_tail`. Reset on route change.

### Memory + connection
| Field | Source | Why |
|---|---|---|
| `memory_used_mb` | `performance.memory.usedJSHeapSize / 1024 / 1024` (Chrome only) | "Tab feels heavy" diagnostics. |
| `memory_limit_mb` | `performance.memory.jsHeapSizeLimit / 1024 / 1024` | Surfaces near-OOM bugs. |
| `connection_effective_type` | `navigator.connection.effectiveType` | "It's slow on my phone" — is it the network? |
| `connection_downlink_mbps` | `navigator.connection.downlink` | Bandwidth bucket. |
| `connection_save_data` | `navigator.connection.saveData` | User has data-saver on; explains low-fi UI. |

All wrapped in feature-detect (`'memory' in performance`,
`'connection' in navigator`) — not all browsers expose these.

### Route history
| Field | Source | Why |
|---|---|---|
| `route_history` | Last 10 navigations: `[{path, method: 'push'\|'replace'\|'back', ts}]` | "I clicked X then Y then it broke." Replaces guesswork from console_tail. |

Wired into `FeedbackProvider` via a host binding (TanStack Router has
its own subscription; React Router also; vanilla wins via
`navigation.addEventListener('navigate', …)` on Chromium). The host
opts in by passing `getRouteHistory?: () => RouteEvent[]` in bindings.
Default: empty list.

### React Query / TanStack health (host-opt-in)
| Field | Source | Why |
|---|---|---|
| `query_cache_total` | `queryClient.getQueryCache().getAll().length` | Spot leaking subscriptions. |
| `query_cache_errored` | filter `state.error !== null` | "I see a red toast" — which queries are failing? |
| `recent_failed_queries` | last 5 errored queries: `[{queryKey, errorName}]` | Direct diagnosis link. |

Host opts in by passing `getQueryCacheHealth?: () => QueryCacheHealth`
in bindings. Default: omitted from bundle. Avoids leaking arbitrary
host data to the widget by default.

### Errors + theme
| Field | Source | Why |
|---|---|---|
| `recent_errors` | Last 5 caught by a registered error boundary in the host (binding) | "It crashed and I refreshed" — the boundary catches before the user reloads. |
| `theme` | `data-theme` on `<html>` or `prefers-color-scheme` | Dark-mode bugs are real. |
| `dom_node_count` | `document.querySelectorAll('*').length` at submit time | Page weight signal. |
| `time_on_page_ms` | `Date.now() - performance.timeOrigin` | "I was here for 3 minutes before it broke" vs "5 seconds ago". |

## Privacy + size

- **Bundle size cap**: `metadata_bundle` is already 5 KB-50 KB
  typical. New keys add ~500 B. Cap stays at 256 KB (settings
  `MAX_METADATA_BYTES`); helper truncates oversize bundles.
- **No PII added**: route paths and query keys can leak IDs but those
  were already in the URL we capture.
- **Host opt-in for sensitive bits**: route history (URL paths) is
  default-off in the binding. Hosts who don't pass `getRouteHistory`
  see no change.
- **Redactor pass**: every new free-text key (route paths, error
  messages) goes through the existing client + server redactor.

## Files touched

Frontend (additive — no breaking changes):
- `packages/feedback-frontend/src/capture/metadata.ts` — extend
  `buildMetadataBundle` to call new collectors.
- `packages/feedback-frontend/src/capture/web-vitals.ts` (new) —
  PerformanceObserver wiring with reset-on-route-change.
- `packages/feedback-frontend/src/capture/route-history.ts` (new) —
  default vanilla-navigation collector + binding hook.
- `packages/feedback-frontend/src/capture/query-cache.ts` (new) —
  optional host-opt-in collector.
- `packages/feedback-frontend/src/adapter.ts` — extend
  `FeedbackHostBindings` with `getRouteHistory?`,
  `getQueryCacheHealth?`, `getRecentErrors?`.

Backend (no change):
- The bundle is already JSONB; new keys flow through.
- `bundle.py` already serializes metadata as `metadata.json`. The
  LLM-handoff README block can be extended to call out the new sections.

## Test plan

- Unit: each collector handles its feature-detect path (run on JSDOM
  without `performance.memory` etc.).
- Integration: a sandbox-host submission produces a bundle with the new
  keys present and the bundle stays under the size cap.
- Privacy: a `tests/privacy_redactor_test.ts` adds cases for route
  paths containing `/users/<email>` and verifies the redactor strips
  them before submit.

## Out of scope (defer to v0.4.0)

- Recording video / DOM snapshots (storage cost too high for a default).
- Recording user keystrokes (PII risk).
- Backend-side richer telemetry (server logs at the time of submission).
