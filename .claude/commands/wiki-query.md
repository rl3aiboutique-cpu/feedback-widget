---
description: Answer a question using the project Obsidian vault. Reads hot.md → index.md → relevant pages, synthesizes with citations, files the answer back.
---

Run the `wiki-query` skill on the user's question. Workflow:

1. Read `vault/wiki/hot.md` first — recent context.
2. Read `vault/wiki/index.md` if hot cache lacks the answer.
3. Drill into `vault/wiki/{entities,concepts,sources,captures}/` for specifics.
4. Synthesize the answer with explicit citations to `[[page-name]]` (wikilinks).
5. If the answer is substantive and worth filing, write it under `vault/wiki/captures/insight/<slug>.md` per the dev-vault-discipline rule.
