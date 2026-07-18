---
type: correction
created: 2026-07-18
author: claude-code
source: spec-001-session
tags: [vault, hot-cache, discipline]
---

# hot.md pruning policy — owner correction

## 2026-07-18 18:58

**What was wrong**: during the end-of-session hot.md rewrite the agent deleted durable,
still-true facts (CBP local ports :8002/:3001, cbp-postgres :5433 DSN, agent-browser tooling
line) that were unrelated to the session's topic, chasing the ≤500-word budget.

**Correct behavior**: when overwriting hot.md, prune ONLY (a) facts proven false or obsolete
(state the correction, e.g. "LLM keys dead", never silently drop) and (b) threads that are
closed/superseded (compress to a log.md pointer). Durable environment facts — ports, DSNs,
tooling, login fixtures — survive every rewrite regardless of the session's topic. The word
budget is met by compressing prose, not by discarding unrelated knowledge.
