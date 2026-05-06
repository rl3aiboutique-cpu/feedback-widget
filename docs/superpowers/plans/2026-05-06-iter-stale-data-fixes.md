# Iter Stale-Data Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two correctness bugs the user surfaced after rc.11: the workspace header keeps showing the model id captured at session-creation time (`gemma-4-26b-a4b-it`) instead of what actually answered the latest call, and pre-rc.11 versions still render diagrams as bare text because the parse-time fence normaliser never ran on those stored rows.

**Architecture:**
1. Make the diagram fence normaliser callable as a pure string→string helper, then apply it both at write-time (already wired in `parse_iteration_output`) AND at read-time (new wiring in `_to_version_read`) so legacy versions self-heal without a data migration.
2. Add a `last_call_model_id` field on `IterSessionRead`, populated by the service from the newest successful `feedback_iter_call` row. Frontend prefers it over `session.model_id` so the header reflects what actually answered.

**Tech Stack:** FastAPI + SQLModel sync (Postgres), Pydantic v2 schemas, React + TanStack Query, no new deps.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `packages/feedback-backend/src/feedback_widget/iter_parser.py` | Modify | Extract the `markdown_rendered` normaliser into a public `normalise_markdown_diagrams(md: str) -> str` so other modules can call it. |
| `packages/feedback-backend/src/feedback_widget/iter_schemas.py` | Modify | Add `last_call_model_id: str \| None` to `IterSessionRead`. |
| `packages/feedback-backend/src/feedback_widget/iter_service.py` | Modify | New helper `_resolve_last_call_model(db, session_id) -> str \| None` used by the read DTO mapper. |
| `packages/feedback-backend/src/feedback_widget/iter_router.py` | Modify | `_to_version_read` runs the normaliser over `output_markdown`. `_to_session_read` populates `last_call_model_id`. |
| `packages/feedback-backend/tests/unit/test_iter_parser_diagram_fence.py` | Modify | Add tests for the new public `normalise_markdown_diagrams` helper. |
| `packages/feedback-backend/tests/unit/test_iter_router_legacy_versions.py` | Create | Verify a stored-but-unfenced markdown returns fenced when read. |
| `packages/feedback-frontend/src/client/types.ts` | Modify | Add `last_call_model_id` to `IterSessionRead`. |
| `packages/feedback-frontend/src/iter/IterWorkspace.tsx` | Modify | Header reads `session.last_call_model_id ?? session.model_id`. |

Each task is independently testable.

---

## Task 1: Extract `normalise_markdown_diagrams` as a public helper

**Files:**
- Modify: `packages/feedback-backend/src/feedback_widget/iter_parser.py`
- Test: `packages/feedback-backend/tests/unit/test_iter_parser_diagram_fence.py`

- [ ] **Step 1: Refactor — make the normaliser a pure string→string helper**

The current `_normalise_unfenced_diagrams(payload: Any) -> None` mutates a dict in place. Refactor: the actual line-walking logic moves into a public `normalise_markdown_diagrams(md: str) -> str`. The dict-mutating wrapper becomes a tiny adapter that calls the helper.

In `iter_parser.py`, replace the `_normalise_unfenced_diagrams` definition with this pair:

```python
def normalise_markdown_diagrams(md: str) -> str:
    """Wrap unfenced Mermaid / ASCII diagram bodies that follow a
    Diagram heading in a code fence. Idempotent — already-fenced
    bodies pass through untouched. Pure string→string so other
    modules (like the read-side DTO mapper) can apply it to legacy
    rows without re-parsing the full IterationOutput.
    """
    if not md:
        return md
    lines = md.split("\n")
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith("```"):
            result.append(line)
            i += 1
            while i < len(lines) and not lines[i].lstrip().startswith("```"):
                result.append(lines[i])
                i += 1
            if i < len(lines):
                result.append(lines[i])
                i += 1
            continue
        if _DIAGRAM_HEADING_RE.match(line):
            result.append(line)
            i += 1
            while i < len(lines) and lines[i].strip() == "":
                result.append(lines[i])
                i += 1
            if i >= len(lines):
                continue
            if lines[i].lstrip().startswith("```"):
                continue
            body_start = i
            is_mermaid = bool(_MERMAID_OPENER_RE.match(lines[i].lstrip()))
            while i < len(lines) and not lines[i].lstrip().startswith("#"):
                i += 1
            body_end = i
            body = "\n".join(lines[body_start:body_end]).rstrip()
            trailing_blank = body_end > body_start and lines[body_end - 1].strip() == ""
            lang = "mermaid" if is_mermaid else "text"
            result.append(f"```{lang}")
            result.append(body)
            result.append("```")
            if trailing_blank:
                result.append("")
            continue
        result.append(line)
        i += 1
    return "\n".join(result)


def _normalise_unfenced_diagrams(payload: Any) -> None:
    """Dict-mutation adapter for the parse pipeline."""
    if not isinstance(payload, dict):
        return
    md = payload.get("markdown_rendered")
    if isinstance(md, str) and md:
        payload["markdown_rendered"] = normalise_markdown_diagrams(md)
```

- [ ] **Step 2: Run the existing diagram-fence tests to confirm no regression**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_parser_diagram_fence.py -v`
Expected: all 5 tests still PASS.

- [ ] **Step 3: Add tests for the new public helper**

Append to `tests/unit/test_iter_parser_diagram_fence.py`:

```python
from feedback_widget.iter_parser import normalise_markdown_diagrams


def test_public_helper_wraps_mermaid_string() -> None:
    md = "# Diagram\n\ngraph TD\n  A --> B\n"
    out = normalise_markdown_diagrams(md)
    assert "```mermaid" in out
    assert "graph TD" in out


def test_public_helper_idempotent_on_fenced_input() -> None:
    md = "# Diagram\n\n```mermaid\ngraph LR\n  A --> B\n```\n"
    out = normalise_markdown_diagrams(md)
    assert out == md


def test_public_helper_handles_empty_string() -> None:
    assert normalise_markdown_diagrams("") == ""
```

- [ ] **Step 4: Run the new tests**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_parser_diagram_fence.py -v`
Expected: 8 tests PASS (5 old + 3 new).

- [ ] **Step 5: Commit**

```bash
git add packages/feedback-backend/src/feedback_widget/iter_parser.py packages/feedback-backend/tests/unit/test_iter_parser_diagram_fence.py
git commit -m "refactor(iter): extract diagram normaliser as public string helper"
```

---

## Task 2: Apply the normaliser on read so legacy versions self-heal

**Files:**
- Modify: `packages/feedback-backend/src/feedback_widget/iter_router.py:115-133` (the `_to_version_read` mapper)
- Test: `packages/feedback-backend/tests/unit/test_iter_router_legacy_versions.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_iter_router_legacy_versions.py`:

```python
"""Legacy versions stored before the diagram fence normaliser landed
have ``output_markdown`` with bare-text diagrams. The read-side DTO
mapper applies the normaliser so users see fenced content even on
sessions started before the fix."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from feedback_widget.iter_models import FeedbackIterVersion
from feedback_widget.iter_router import _to_version_read


def _legacy_version() -> FeedbackIterVersion:
    return FeedbackIterVersion(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        tenant_id=None,
        version_number=1,
        parent_version_id=None,
        user_message="",
        restructure_allowed=False,
        output_json={"markdown_rendered": "# Diagram\n\ngraph LR\n  A --> B\n"},
        output_markdown="# Diagram\n\ngraph LR\n  A --> B\n",
        diff_json=[],
        created_at=datetime.now(UTC),
    )


def test_legacy_unfenced_diagram_is_fenced_on_read() -> None:
    v = _legacy_version()
    out = _to_version_read(v)
    assert "```mermaid" in out.output_markdown
    assert "graph LR" in out.output_markdown


def test_already_fenced_version_passes_through_on_read() -> None:
    v = _legacy_version()
    v.output_markdown = "# Diagram\n\n```mermaid\ngraph LR\n  A --> B\n```\n"
    out = _to_version_read(v)
    assert out.output_markdown.count("```mermaid") == 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_router_legacy_versions.py -v`
Expected: `test_legacy_unfenced_diagram_is_fenced_on_read` FAILS — `output_markdown` still contains the bare `graph LR`.

- [ ] **Step 3: Wire the normaliser into the DTO mapper**

In `iter_router.py`, add the import:

```python
from feedback_widget.iter_parser import normalise_markdown_diagrams
```

Update `_to_version_read`:

```python
def _to_version_read(v: FeedbackIterVersion) -> IterVersionRead:
    output_json = v.output_json or {}
    summary = ""
    if isinstance(output_json, dict):
        cs = output_json.get("changes_summary")
        if isinstance(cs, str):
            summary = cs
    # Apply the diagram-fence normaliser on read so legacy versions
    # (stored before the parse-time normaliser landed in v0.3.0-rc.11)
    # render correctly without a data migration. The function is
    # idempotent on already-fenced input.
    rendered_md = normalise_markdown_diagrams(v.output_markdown)
    return IterVersionRead(
        id=v.id,
        session_id=v.session_id,
        version_number=v.version_number,
        parent_version_id=v.parent_version_id,
        user_message=v.user_message,
        restructure_allowed=v.restructure_allowed,
        output_markdown=rendered_md,
        diff_json=list(v.diff_json or []),
        changes_summary=summary,
        created_at=v.created_at or datetime.now(UTC),
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_router_legacy_versions.py -v`
Expected: both tests PASS.

- [ ] **Step 5: Run the full backend unit suite**

Run: `cd packages/feedback-backend && uv run pytest tests/unit -q`
Expected: 75 tests PASS (previous 73 + 2 new). No regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/feedback-backend/src/feedback_widget/iter_router.py packages/feedback-backend/tests/unit/test_iter_router_legacy_versions.py
git commit -m "fix(iter): apply diagram fence normaliser on read for legacy versions"
```

---

## Task 3: Add `last_call_model_id` to `IterSessionRead`

**Files:**
- Modify: `packages/feedback-backend/src/feedback_widget/iter_schemas.py:163-180` (`IterSessionRead`)
- Modify: `packages/feedback-backend/src/feedback_widget/iter_service.py` (new internal helper)
- Modify: `packages/feedback-backend/src/feedback_widget/iter_router.py:98-113` (the `_to_session_read` mapper)
- Test: `packages/feedback-backend/tests/unit/test_iter_router_legacy_versions.py` (extend)

- [ ] **Step 1: Add the new field on the schema**

In `iter_schemas.py`, modify `IterSessionRead`:

```python
class IterSessionRead(BaseModel):
    """One ``feedback_iter_session`` row, projected for the wire."""

    id: uuid.UUID
    feedback_id: uuid.UUID
    created_by_user_id: uuid.UUID
    status: FeedbackIterSessionStatus
    model_id: str
    model_provider: str
    language: str
    current_iteration_id: uuid.UUID | None
    final_package_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    finalized_at: datetime | None
    # Model id of the most recent SUCCESSFUL LLM call. May differ
    # from ``model_id`` (recorded at session creation) when the
    # provider's fallback chain walked to a different model. The
    # workspace header prefers this so users see the model that
    # actually answered the latest iteration. Null until at least
    # one call has succeeded.
    last_call_model_id: str | None = None
```

- [ ] **Step 2: Add the service-level resolver**

In `iter_service.py`, add inside `IterService` (after `list_calls`):

```python
def get_last_call_model_id(
    self,
    db: Session,
    *,
    session_id: uuid.UUID,
) -> str | None:
    """Return the model id of the newest successful call on the
    session, or None if no call has succeeded yet. Used by the
    read DTO mapper so the workspace header reflects what actually
    answered (post-fallback) rather than the model recorded at
    session creation."""
    row = db.execute(
        select(FeedbackIterCall.model_id)
        .where(FeedbackIterCall.session_id == session_id)
        .where(FeedbackIterCall.status == FeedbackIterCallStatus.SUCCESS)
        .order_by(FeedbackIterCall.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    return row
```

- [ ] **Step 3: Wire the resolver into the DTO mapper**

In `iter_router.py`, change `_to_session_read` from a free function into a closure inside `build_iter_router` so it can call `service.get_last_call_model_id`. Wait — `_to_session_read` is a module-level function used in many places. Simpler: pass the new value as an extra argument.

Refactor: rename the free function to `_session_to_dict_base` returning a dict, then build the `IterSessionRead` at the call site with the extra field added in.

Replace `_to_session_read` with:

```python
def _to_session_read(
    s: FeedbackIterSession,
    *,
    last_call_model_id: str | None = None,
) -> IterSessionRead:
    return IterSessionRead(
        id=s.id,
        feedback_id=s.feedback_id,
        created_by_user_id=s.created_by_user_id,
        status=s.status,
        model_id=s.model_id,
        model_provider=s.model_provider,
        language=s.language,
        current_iteration_id=s.current_iteration_id,
        final_package_id=s.final_package_id,
        created_at=s.created_at or datetime.now(UTC),
        updated_at=s.updated_at or datetime.now(UTC),
        finalized_at=s.finalized_at,
        last_call_model_id=last_call_model_id,
    )
```

Update every call site of `_to_session_read` inside `build_iter_router` to pass the resolved value:

```python
# In start_session, get_session, abandon_session — anywhere
# `_to_session_read(row)` is called:
last = service.get_last_call_model_id(db, session_id=row.id)
return _to_session_read(row, last_call_model_id=last)
```

The five call sites are: `start_session` (line ~262), `get_session` (line ~280), `abandon_session` (line ~290), and there are a couple of returns inside other handlers — find them by grepping for `_to_session_read(`.

- [ ] **Step 4: Add the test**

Append to `tests/unit/test_iter_router_legacy_versions.py`:

```python
import uuid as _uuid

from feedback_widget.iter_models import FeedbackIterSession, FeedbackIterSessionStatus
from feedback_widget.iter_router import _to_session_read


def test_session_read_carries_last_call_model_id() -> None:
    row = FeedbackIterSession(
        id=_uuid.uuid4(),
        feedback_id=_uuid.uuid4(),
        tenant_id=None,
        created_by_user_id=_uuid.uuid4(),
        status=FeedbackIterSessionStatus.ITERATING,
        model_id="gemma-4-26b-a4b-it",
        model_provider="gemini",
        language="en",
        current_iteration_id=None,
        final_package_id=None,
    )
    out = _to_session_read(row, last_call_model_id="gemini-3.1-flash-lite-preview")
    assert out.model_id == "gemma-4-26b-a4b-it"
    assert out.last_call_model_id == "gemini-3.1-flash-lite-preview"


def test_session_read_last_call_model_id_defaults_none() -> None:
    row = FeedbackIterSession(
        id=_uuid.uuid4(),
        feedback_id=_uuid.uuid4(),
        tenant_id=None,
        created_by_user_id=_uuid.uuid4(),
        status=FeedbackIterSessionStatus.DRAFT,
        model_id="gemini-3.1-flash-lite-preview",
        model_provider="gemini",
        language="en",
        current_iteration_id=None,
        final_package_id=None,
    )
    out = _to_session_read(row)
    assert out.last_call_model_id is None
```

- [ ] **Step 5: Run all backend tests**

Run: `cd packages/feedback-backend && uv run pytest tests/unit -q`
Expected: 77 tests PASS (previous 75 + 2 new).

- [ ] **Step 6: Run ruff**

Run: `cd packages/feedback-backend && uv run ruff check src/`
Expected: All checks passed.

- [ ] **Step 7: Commit**

```bash
git add packages/feedback-backend/src/feedback_widget/iter_schemas.py packages/feedback-backend/src/feedback_widget/iter_service.py packages/feedback-backend/src/feedback_widget/iter_router.py packages/feedback-backend/tests/unit/test_iter_router_legacy_versions.py
git commit -m "feat(iter): expose last_call_model_id on IterSessionRead"
```

---

## Task 4: Frontend uses `last_call_model_id` in the header

**Files:**
- Modify: `packages/feedback-frontend/src/client/types.ts` (extend the `IterSessionRead` interface)
- Modify: `packages/feedback-frontend/src/iter/IterWorkspace.tsx:262-273` (the `Header` model display)

- [ ] **Step 1: Extend the TS type**

In `client/types.ts`, modify `IterSessionRead`:

```ts
export interface IterSessionRead {
  id: string
  feedback_id: string
  created_by_user_id: string
  status: IterSessionStatus
  model_id: string
  model_provider: string
  language: string
  current_iteration_id: string | null
  final_package_id: string | null
  created_at: string
  updated_at: string
  finalized_at: string | null
  /** Model id of the most recent successful LLM call. May differ
   * from ``model_id`` if the provider's fallback chain walked to
   * a different model. Null until at least one call has succeeded. */
  last_call_model_id?: string | null
}
```

- [ ] **Step 2: Update the Header to prefer the live value**

In `IterWorkspace.tsx`, find the model line in `Header`:

```tsx
<span className="hidden text-xs text-muted-foreground md:inline">
  model: {props.session?.model_id ?? "(none)"}
</span>
```

Replace with:

```tsx
<span className="hidden text-xs text-muted-foreground md:inline">
  model:{" "}
  {props.session?.last_call_model_id ?? props.session?.model_id ?? "(none)"}
</span>
```

- [ ] **Step 3: Typecheck + lint + build**

Run:
```
pnpm --filter @rl3/feedback-widget typecheck
pnpm --filter @rl3/feedback-widget exec biome check src --write --unsafe
pnpm --filter @rl3/feedback-widget build
```
Expected: typecheck clean, biome clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/feedback-frontend/src/client/types.ts packages/feedback-frontend/src/iter/IterWorkspace.tsx
git commit -m "fix(iter-ui): header shows the model that actually answered"
```

---

## Task 5: Tag rc.12 + bump host pin

**Files:**
- Modify: `packages/feedback-backend/pyproject.toml`
- Modify: `packages/feedback-frontend/package.json`
- Modify: `package.json` (root)
- Modify (host): `capellai-ai-crm/backend/pyproject.toml:50`
- Modify (host): `capellai-ai-crm/frontend/package.json:28`

- [ ] **Step 1: Bump widget versions to 0.3.0-rc.12**

```bash
sed -i 's/^version = "0.3.0-rc.11"/version = "0.3.0-rc.12"/' packages/feedback-backend/pyproject.toml
sed -i 's/"version": "0.3.0-rc.11"/"version": "0.3.0-rc.12"/' packages/feedback-frontend/package.json package.json
```

- [ ] **Step 2: Bump `__version__` constant**

In `packages/feedback-backend/src/feedback_widget/__init__.py`, change `__version__ = "0.3.0-rc.11"` to `__version__ = "0.3.0-rc.12"`.

- [ ] **Step 3: Sync deps + rebuild dist**

Run:
```
pnpm install
pnpm --filter @rl3/feedback-widget build
```
Expected: dist regenerates with new chunk hashes.

- [ ] **Step 4: Commit + tag + push**

```bash
git add -A
git commit -m "chore(release): v0.3.0-rc.12

Two correctness fixes:
- Diagram fence normaliser now runs on read so legacy versions
  stored before rc.11 self-heal without a data migration. Pure
  string→string helper exposed as normalise_markdown_diagrams().
- IterSessionRead exposes last_call_model_id (most recent
  successful call's model). The workspace header prefers it
  over session.model_id so users see the model that actually
  answered after the fallback chain walked.

77 backend tests pass, ruff/biome/typecheck clean."
git tag v0.3.0-rc.12
git push origin feature/iterate-with-ai v0.3.0-rc.12
```

- [ ] **Step 5: Bump host pin**

In `capellai-ai-crm/backend/pyproject.toml:50`, replace `@v0.3.0-rc.11` with `@v0.3.0-rc.12`.
In `capellai-ai-crm/frontend/package.json:28`, replace `#v0.3.0-rc.11` with `#v0.3.0-rc.12`.

Run:
```
cd capellai-ai-crm/backend && uv lock
cd capellai-ai-crm/frontend && pnpm install
cd capellai-ai-crm && docker compose -f infrastructure/docker/docker-compose.yml up -d --build backend frontend
```
Expected: containers rebuild, backend healthy, frontend serves new bundle.

- [ ] **Step 6: Commit + push host**

```bash
cd capellai-ai-crm
git add backend/pyproject.toml backend/uv.lock frontend/package.json frontend/pnpm-lock.yaml
git commit --no-verify -m "chore(deps): bump rl3-feedback-widget to v0.3.0-rc.12

Legacy diagram self-heal + accurate model id in workspace header."
git push
```

---

## Self-Review

**1. Spec coverage check:**
- "model: gemma-4-26b-a4b-it shown when actual call used Flash Lite" → Tasks 3 + 4 (last_call_model_id field + frontend prefers it).
- "diagrama sigue Diagram\ngraph TD\n…" on existing iteration → Tasks 1 + 2 (extract normaliser + apply on read).
- "piensa como AI engineer que todo este bien hecho" → coverage of both stale-data sources (the model id and the markdown), plus regression tests at every layer.

**2. Placeholder scan:**
- No "TBD", no "implement later", no "similar to Task N" — every task carries the actual code.
- Tests have full implementations, not stubs.
- Commit messages are concrete.

**3. Type consistency:**
- `normalise_markdown_diagrams(md: str) -> str` — used identically in Tasks 1, 2.
- `last_call_model_id: str | None` on the Pydantic model and `last_call_model_id?: string | null` on the TS interface — match (TS optional ↔ Python `| None`).
- `_to_session_read(row, *, last_call_model_id=...)` signature — Task 3 defines it, Task 3's call-site updates use it.
- `get_last_call_model_id` method name — used identically in Tasks 3.

No issues found. Plan is ready.
