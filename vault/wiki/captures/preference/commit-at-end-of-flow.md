---
type: preference
created: 2026-05-13
author: claude-code
source: brainstorming-feedback-widget-v1
tags:
  - git
  - workflow
  - commits
---

# Commit al final del flow, no por step

**Preference:** En sesiones largas de design/implementation, NO commit step-by-step. Acumular cambios y commitear al cierre del flow (e.g., al final del brainstorming + writing-plans, o al final de una slice).

**Scope:** Sesiones de diseño/planificación. NO aplica a implementación de features ya planificadas (esas siguen Iron Law 7 normal).

**How to apply:**
- Brainstorming + writing-plans → un solo commit al cierre con todo (spec + plan + vault).
- Implementation slices → commit por slice cuando demo gate pasa.
- Cambios de vault auto-committeados siguen como están (hook).
