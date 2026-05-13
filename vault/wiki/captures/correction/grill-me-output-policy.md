---
type: correction
created: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - vault-discipline
  - grill-me
  - process
---

# Grill-me output policy

Append-mode.

## 2026-05-13 14:30

**What was wrong**: Durante la primera /grill-me session escribí UN archivo por decisión bajo `vault/wiki/captures/decision/` (D-001..D-009 = 9 archivos pequeños).

**Correct version**: Per `dev-vault-discipline.md` § "Grill sessions — ONE consolidated doc per session":
- Suprimir Iron Law 9 markers de DECISION/QUESTION/OBSERVATION/INSIGHT/PREFERENCE/PROMPT durante la sesión.
- Mantener en memoria de trabajo.
- Al cierre (natural o explícito "ok ya está"), escribir UN doc consolidado: `vault/wiki/captures/decision/<YYYY-MM-DD>_grilled-<slug>.md`.
- Pendientes y branches no resueltos van en sección "Pending" del mismo doc.
- CORRECTION + DEFECT siguen siendo individuales (alta severidad).

**Acción**: Continúo el grill en memoria. Al cierre escribo el consolidado y, si procede, refactorizo los 9 individuales en stubs apuntando al consolidado.
