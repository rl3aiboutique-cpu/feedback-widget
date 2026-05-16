# Feedback Widget Vault: LLM Wiki

Mode: B + C + D (Repo + Project + Second Brain)
Purpose: Persistent brain for the RL3 Feedback Widget — codebase map, product decisions, Iron Law 9 captures, and personal learning around feedback UX / conversational AI.
Owner: lehidalgo (le.hidalgot@gmail.com)
Created: 2026-05-13

## Structure

```
vault/
├── .raw/                # source dumps, transcripts, exports (never modify)
├── wiki/
│   ├── index.md         # master catalog
│   ├── log.md           # chronological operations log (append at top)
│   ├── hot.md           # ~500-word recent context cache
│   ├── overview.md      # executive summary
│   │
│   ├── modules/         # B — code modules (feedback-backend, frontend, iter, capture)
│   ├── components/      # B — UI primitives, hooks, providers
│   ├── decisions/       # B+C — ADRs, product decisions
│   ├── flows/           # B — data flows, user journeys, state machines
│   │
│   ├── stakeholders/    # C — people, teams, host integrators
│   ├── deliverables/    # C — milestones, phases, ship gates
│   ├── intel/           # C — competitive analysis, market research
│   │
│   ├── goals/           # D — personal/professional goals on the project
│   ├── learning/        # D — concepts being mastered (LLM UX, Whisper, GrillMe)
│   │
│   ├── captures/        # Iron Law 9 markers (one subdir per type)
│   │   ├── decision/    correction/   insight/      observation/
│   │   ├── defect/      feedback/     preference/   prohibition/
│   │   ├── prompt/      question/     rule/
│   │
│   ├── sources/         # one summary page per .raw/ source
│   ├── questions/       # filed answers to user queries
│   ├── comparisons/     # side-by-side analyses
│   └── meta/            # dashboards, lint reports, conventions
│
├── _templates/          # note templates by type
└── .obsidian/           # Obsidian config (committed, shared with team)
```

## Conventions

- Frontmatter required on every page: `type`, `title`, `created`, `updated`, `tags`, `status`.
- Wikilinks: `[[Note Name]]` — filenames are unique, no paths needed.
- `.raw/` is immutable. Never edit a source.
- `wiki/index.md` updated on every ingest / scaffold.
- `wiki/log.md` is append-only. New entries at the TOP.
- `wiki/hot.md` overwritten end of each session, ≤500 words.
- Capture markers (Iron Law 9) ALSO write a vault page in `wiki/captures/<type>/`.

## Operations

- Scaffold: done 2026-05-13.
- Ingest: drop in `.raw/`, say `ingest <file>` → `wiki-ingest`.
- Query: any question → `wiki-query` reads index first, drills down.
- Save: `/save` files a substantive conversation answer into the vault.
- Lint: `lint the wiki` → `wiki-lint` health check.
- GrillMe: `/grill-me` interview session → captures land in `captures/`.
- Autoresearch: `/autoresearch <topic>` runs a research loop.

## Cross-project reference

Other RL3 projects (sapphira, capellai-ai-crm) can point their `CLAUDE.md` at:
`/home/lehidalgo/dev/rl3/feedback-widget/vault/wiki/hot.md`
for warm context without reading the full vault.
