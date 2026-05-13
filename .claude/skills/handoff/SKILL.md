---
name: handoff
description: Compact the current conversation into a handoff document so a fresh agent can pick up the work without re-reading the transcript. Use when the user says "hand off", "handoff", "summarise for the next session", "pass this to another agent", "wrap this up for tomorrow", or when the conversation is long enough that a fresh context window would help. Skip when natural artefacts (PR description, ADR, commit messages) already serve the same purpose.
argument-hint: "What will the next session be used for?"
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to a path produced by `mktemp -t handoff-XXXXXX.md` (read the file before you write to it).

Suggest the skills to be used, if any, by the next session.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
