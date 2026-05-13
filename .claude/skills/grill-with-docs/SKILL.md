---
name: grill-with-docs
description: Grill session that challenges your plan against the project's existing domain model (CONTEXT.md, docs/adr/), sharpens terminology, and updates documentation inline as decisions crystallise. Use when the user wants to stress-test a plan AND the project has CONTEXT.md or ADRs to anchor it. Skip when grill-me applies (no documented domain model yet, greenfield design).
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

Don't couple `CONTEXT.md` to implementation details. Only include terms that are meaningful to domain experts.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

## Vault output — ONE doc per session

During the grill, **do NOT file individual capture pages in the vault**. CONTEXT.md and ADR updates happen INLINE in the repo (they are project docs, not vault captures) — keep doing those as they crystallise. But the per-turn Iron Law 9 stream into `vault/wiki/captures/` must be suppressed.

Suppress Iron Law 9 marker emission for `DECISION`, `QUESTION`, `OBSERVATION`, `INSIGHT`, `PREFERENCE`, `PROMPT` during the grill — emitting them per turn would scatter the resolved tree across N pages. Exception: `CORRECTION` markers still fire (always high-severity, always durable) and `DEFECT` markers fire if you find real code bugs during exploration.

When the user signals close ("ok ya está", "hemos terminado", "gracias", "pausemos", or natural conclusion), write ONE consolidated document:

- Path: `vault/wiki/captures/decision/<YYYY-MM-DD>_grilled-<slug>.md`
- Slug: kebab-case, 3-6 words capturing the plan
- Frontmatter: `type: decision`, `created: <YYYY-MM-DD>`, `author: claude-code`, tags reflecting the area
- Sections:
  - **Plan summary** — what was being grilled, in 2-3 sentences
  - **Domain anchoring** — which CONTEXT.md terms and ADRs anchored the conversation, with wikilinks
  - **Resolved branches** — each as `### Question` + `**Answer:**` + `**Rationale:**` (one line). If the answer caused an inline CONTEXT.md or ADR update, link it
  - **Pending** — branches paused or deferred, with the unresolved sub-questions
  - **Next session resume hint** — exact phrase the user can use to pick up

If the user aborts before any branch is resolved, write nothing — the grill produced no durable artefact. Inline CONTEXT.md / ADR updates still stand on their own merits.

</supporting-info>
