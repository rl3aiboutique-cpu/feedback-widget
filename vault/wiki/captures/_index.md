---
type: domain
title: "Captures"
created: 2026-05-13
updated: 2026-05-13
tags:
  - domain
  - captures
status: seed
subdomain_of: ""
page_count: 0
---

# Captures — Iron Law 9

Markers de captura del agente. Cada marker emitido en chat también ESCRIBE una página aquí (rule: `dev-vault-discipline.md`).

## Estructura

| Tipo | Carpeta | Modo |
|---|---|---|
| DECISION | `decision/` | un archivo por decisión |
| OBSERVATION | `observation/` | append por artifact/area |
| DEFECT | `defect/` | un archivo por defecto |
| CORRECTION | `correction/` | append por topic |
| INSIGHT | `insight/` | append por topic |
| PROMPT | `prompt/` | un archivo por prompt |
| RULE | `rule/` | un archivo por regla |
| PROHIBITION | `prohibition/` | un archivo por prohibición |
| PREFERENCE | `preference/` | un archivo por preferencia |
| FEEDBACK | `feedback/` | diario por fecha |
| QUESTION | `question/` | un archivo por pregunta |

## Reglas

- Slug kebab-case, máx 6 palabras.
- Frontmatter obligatorio: `type`, `created`, `author: claude-code`, `source`, `tags`.
- Append-mode: cada entrada lleva header `## YYYY-MM-DD HH:MM`.
- Wikilinks entre captures permitidos.
