---
type: correction
created: 2026-05-13
author: claude-code
source: agent-eyes-browser-skill
tags: [tooling, codi, skills, workflow]
---

# Skill creation workflow — no usar codi CLI

Append-mode page. Una correction por sesión.

## 2026-05-13 22:35

**Lo que estaba haciendo mal:** Al crear una skill nueva (`agent-eyes-browser`), seguí literalmente el lifecycle de `codi-skill-creator` que prescribe `codi add skill <name>` → scaffold en `.codi/skills/<name>/` → editar SKILL.md → `codi generate` para propagar a `.claude/skills/`.

**Lo correcto:** En este proyecto las skills se escriben **directamente** en `.claude/skills/<name>/` con `managed_by: user`. Sin pasar por `.codi/skills/` ni `codi generate`.

**Razón:** El user quiere control total y simplicidad. La three-layer pipeline (`src/templates/` → `.codi/` → `.claude/`) está pensada para artefactos `managed_by: codi` que se regeneran. Skills custom del proyecto no necesitan ese ciclo.

**How to apply:**

- Para skills nuevas: `Write .claude/skills/<name>/SKILL.md` + opcional `evals/evals.json`. Punto.
- Frontmatter siempre `managed_by: user`.
- Si en algún momento corren `codi generate`, asegurar que no sobrescriba esta skill (los `managed_by: user` están protegidos por design).
- Actualizar `.claude/skills/_index.md` manualmente para que aparezca en el catálogo humano.
- La skill aparece automáticamente en `available-skills` del system reminder en la siguiente turn (Claude Code la descubre del filesystem).

**Aplicabilidad:** TODAS las skills custom de este repo. No solo `agent-eyes-browser`.

**Skills/rules afectadas:**
- `codi-skill-creator` Step 2 — su flujo `codi add skill` NO aplica aquí. La skill misma está bien para context, pero la ejecución diverge.
- `codi-improvement-dev.md` "Source-layer improvements" — solo aplica si edito skills `managed_by: codi`. No aplica a `managed_by: user`.
