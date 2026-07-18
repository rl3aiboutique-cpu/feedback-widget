---
type: defect
created: 2026-07-18
author: claude-code
source: spec-001-feedback-email-notifications
tags: [packaging, feedback-backend, hatchling]
---

# Hatchling duplicate force-include broke wheel build (FIXED)

`packages/feedback-backend/pyproject.toml` — `[tool.hatch.build.targets.wheel]
packages = ["src/feedback_widget"]` already ships every file under the package, and the
`force-include` block re-added `email/templates`, `alembic/`, `alembic.ini`. Hatchling >= 1.27
(pulled fresh by pip/uv build isolation) rejects duplicate archive paths:
`ValueError: A second file is being added to the wheel archive at the same path:
feedback_widget/alembic/env.py`. Broke `make sandbox-up` (docker backend image) AND local
`uv build` for any fresh environment.

**Fix (shipped 2026-07-18)**: removed the redundant force-include block. Verified by wheel
listing — all 63 files present including templates, alembic.ini, env.py, script.py.mako, all 10
migrations. Regression suite `test_chat_confirm_parity.py` 11 passed.

Related: [[2026-07-18_sandbox-log-visibility-smtp-timeout]]
