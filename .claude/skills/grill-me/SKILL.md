---
name: grill-me
description: Interview the user relentlessly about a plan or design until each branch of the decision tree is resolved. Use when the user says "grill me", "stress-test this plan", "challenge my design" AND the project does NOT yet have CONTEXT.md or ADRs that would anchor the conversation in an existing domain model. Skip when grill-with-docs applies (CONTEXT.md present, ADRs documented) — grill-with-docs grounds the grilling in the existing model.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Vault output — ONE doc per session

During the grill, **do NOT file individual capture pages**. Each question, each resolved branch, each insight stays in working memory.

Suppress Iron Law 9 marker emission for `DECISION`, `QUESTION`, `OBSERVATION`, `INSIGHT`, `PREFERENCE`, `PROMPT` during the grill — emitting them per turn would create scattered vault pages, which is the noise we are avoiding. Exception: `CORRECTION` markers still fire (always high-severity, always durable) and `DEFECT` markers fire if you find real code bugs.

When the user signals close ("ok ya está", "hemos terminado", "gracias", "pausemos", or natural conclusion), write ONE consolidated document:

- Path: `vault/wiki/captures/decision/<YYYY-MM-DD>_grilled-<slug>.md`
- Slug: kebab-case, 3-6 words capturing the plan
- Frontmatter: `type: decision`, `created: <YYYY-MM-DD>`, `author: claude-code`, tags reflecting the area
- Sections:
  - **Plan summary** — what was being grilled, in 2-3 sentences
  - **Resolved branches** — each as `### Question` + `**Answer:**` + `**Rationale:**` (one line)
  - **Pending** — branches paused or deferred, with the unresolved sub-questions
  - **Next session resume hint** — exact phrase the user can use to pick up

If the user aborts before any branch is resolved, write nothing — the grill produced no durable artefact.
