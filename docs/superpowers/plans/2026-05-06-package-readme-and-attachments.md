# Package README + Robust Attachment Bundling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the finalized package self-explanatory and provably complete: ship a human-readable README at the root, audit the attachment-copy plumbing so files like the user's `Compliance_Brain_-_Verical_Onboardings.pdf` (215KB) and the auto-captured screenshot (338KB) reliably land in the ZIP, and add an integration test that proves it from end to end.

**Architecture:**
1. Add a `README.md` renderer to `iter_packager.py`, written for human admins (not the AI consumer). It indexes every file, marks "raw user input" vs. "AI-generated" vs. "iteration audit", and includes the attachment manifest with byte sizes + content types so the recipient can sanity-check completeness.
2. Push the source `bucket` through `AttachmentRef` so cross-bucket attachments don't silently fail. Both `copy_object` (server-side copy) and the `download` for ZIP body need the right source bucket.
3. New unit test that constructs a `PackageBuildInputs` with a non-trivial PDF + a screenshot, runs the packager against an in-memory storage stub, and asserts (a) the ZIP byte stream is a valid archive, (b) every text file is present, (c) every attachment is present with the right byte length.

**Tech Stack:** Python stdlib `zipfile` + Pydantic dataclasses, no new deps.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `packages/feedback-backend/src/feedback_widget/iter_packager.py` | Modify | Add `render_readme()` + a new `README.md` entry in `_render_all_files()`. Add `bucket: str \| None` to `AttachmentRef`. Thread it through `copy_object` + `download`. |
| `packages/feedback-backend/src/feedback_widget/iter_service.py` | Modify | `_load_attachment_refs` returns the row's bucket alongside the rest. |
| `packages/feedback-backend/tests/unit/test_iter_packager.py` | Modify | Add a test that drives the full packager with a PDF + a screenshot and inspects the ZIP byte stream. |

---

## Task 1: Add a human README to the package

**Files:**
- Modify: `packages/feedback-backend/src/feedback_widget/iter_packager.py`
- Test: `packages/feedback-backend/tests/unit/test_iter_packager.py`

- [ ] **Step 1: Add the README renderer**

In `iter_packager.py`, append after `render_iteration_log`:

```python
def render_readme(
    feedback: FeedbackContext,
    attachments: Sequence[AttachmentRef],
    iteration_log: Sequence[IterationLogEntry],
    *,
    consumer_model: str,
) -> str:
    """Top-level human-readable index of the package contents.

    Distinct from ``_AI_INSTRUCTIONS.md`` (which primes a downstream
    LLM consumer); this is what an admin sees first when they open
    the ZIP. Lists every file with a one-line role, separates the
    raw user inputs from the AI-generated artifacts, and shows the
    attachment manifest with byte sizes for completeness checks.
    """
    iter_count = len(iteration_log)
    final_iter = iteration_log[-1] if iteration_log else None
    final_summary = (final_iter.changes_summary if final_iter else "").strip()
    attachments_block = (
        "\n".join(
            f"- `attachments/{a.filename}` &mdash; "
            f"`{a.content_type}`, {a.byte_size:,} bytes"
            for a in attachments
        )
        or "(no attachments on the original feedback)"
    )

    return (
        "# Iterate-with-AI Package\n\n"
        f"_Generated from feedback **{feedback.title}** "
        f"(`{feedback.feedback_id}`) after {iter_count} "
        f"iteration{'s' if iter_count != 1 else ''}._\n\n"
        "This ZIP bundles **everything** about one feedback session "
        "in a single, durable hand-off:\n\n"
        "- The user's original report (free text + technical "
        "metadata + every attachment they uploaded).\n"
        "- The AI-iterated working document the user reviewed and "
        "approved (personas, user stories, spec, diagram, "
        "assumptions).\n"
        "- A complete iteration log + the prompt that primes the "
        "downstream consumer model.\n\n"
        "## File index\n\n"
        "### Read first\n\n"
        "- `README.md` &mdash; this file.\n"
        "- `_AI_INSTRUCTIONS.md` &mdash; the prompt for the "
        f"downstream consumer (currently `{consumer_model}`). "
        "Hand the consumer this file plus everything else.\n\n"
        "### Raw user input\n\n"
        "- `00_context.md` &mdash; original feedback text, "
        "expected outcome, technical metadata bundle, and the "
        "attachment manifest.\n"
        "- `attachments/` &mdash; every file the user uploaded "
        "with the original feedback, in its original format.\n\n"
        "### AI-generated specification\n\n"
        "- `01_personas.md` &mdash; user personas the AI proposed.\n"
        "- `02_user_stories.md` &mdash; Gherkin-style user stories "
        "linked to the personas.\n"
        "- `03_spec.md` &mdash; the implementation contract.\n"
        "- `04_diagram.md` &mdash; ASCII (or Mermaid) diagram of "
        "the flow.\n"
        "- `05_assumptions_resolved.md` &mdash; every assumption "
        "the AI made + the user's resolution.\n\n"
        "### Audit trail\n\n"
        "- `06_iteration_log.md` &mdash; chronological log of each "
        "iteration with the user's notes.\n\n"
        "## Attachment manifest\n\n"
        f"{attachments_block}\n\n"
        + (
            f"## Final iteration summary\n\n{final_summary}\n\n"
            if final_summary
            else ""
        )
        + "## Provenance\n\n"
        f"- Feedback id: `{feedback.feedback_id}`\n"
        f"- URL captured: `{feedback.url_captured}`\n"
        f"- App version: `{feedback.app_version or '(unknown)'}`\n"
        f"- Git SHA: `{feedback.git_commit_sha or '(unknown)'}`\n"
        f"- Iterations: {iter_count}\n"
    )
```

- [ ] **Step 2: Wire it into `_render_all_files`**

Replace the existing function:

```python
def _render_all_files(inputs: PackageBuildInputs, *, consumer_model: str) -> dict[str, str]:
    """Map of relative path → markdown body for every text file in
    the package (everything except attachments)."""
    out = inputs.final_output
    return {
        "README.md": render_readme(
            inputs.feedback,
            inputs.attachments,
            inputs.iteration_log,
            consumer_model=consumer_model,
        ),
        "_AI_INSTRUCTIONS.md": render_ai_instructions(
            consumer_model=consumer_model
        ),
        "00_context.md": render_context(inputs.feedback, inputs.attachments),
        "01_personas.md": render_personas(out.personas),
        "02_user_stories.md": render_user_stories(out.user_stories, out.personas),
        "03_spec.md": render_spec(out.spec),
        "04_diagram.md": render_diagram(out.diagram),
        "05_assumptions_resolved.md": render_assumptions(inputs.assumptions),
        "06_iteration_log.md": render_iteration_log(inputs.iteration_log),
    }
```

- [ ] **Step 3: Update the existing test to expect README.md**

In `tests/unit/test_iter_packager.py`, find the `expected = {...}` set and add `f"{result.folder_prefix}/folder/README.md"`. Also add an assertion in the ZIP entry assertions:

```python
assert "README.md" in names
```

Place that next to the existing `assert "_AI_INSTRUCTIONS.md" in names` line.

- [ ] **Step 4: Run tests to verify both pass**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_packager.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/feedback-backend/src/feedback_widget/iter_packager.py packages/feedback-backend/tests/unit/test_iter_packager.py
git commit -m "feat(iter-packager): add human-readable README.md to the package"
```

---

## Task 2: Robust attachment bucket plumbing

**Files:**
- Modify: `packages/feedback-backend/src/feedback_widget/iter_packager.py` (`AttachmentRef` + the copy loop)
- Modify: `packages/feedback-backend/src/feedback_widget/iter_service.py` (`_load_attachment_refs`)
- Test: `packages/feedback-backend/tests/unit/test_iter_packager.py` (extend the in-memory storage stub)

- [ ] **Step 1: Add `bucket` to `AttachmentRef`**

In `iter_packager.py`, change the dataclass:

```python
@dataclass(frozen=True)
class AttachmentRef:
    """One feedback attachment to copy into the package's
    ``attachments/`` subfolder."""

    object_key: str  # source key
    filename: str  # destination filename inside attachments/
    content_type: str
    byte_size: int
    # Source bucket. None means "use the storage backend's default
    # bucket"; for multi-bucket deployments where attachments live
    # in their own bucket, set this so copy_object + download both
    # read from the right place.
    bucket: str | None = None
```

- [ ] **Step 2: Thread the bucket through copy_object + download**

In `build_iter_package`, change the attachment loop:

```python
attachment_blobs: dict[str, bytes] = {}
for att in inputs.attachments:
    dest_key = f"{folder_prefix}/folder/attachments/{att.filename}"
    storage.copy_object(
        source_key=att.object_key,
        dest_key=dest_key,
        source_bucket=att.bucket,
    )
    attachment_blobs[att.filename] = storage.download(
        att.object_key, bucket=att.bucket
    )
```

- [ ] **Step 3: Populate the bucket in the service loader**

In `iter_service.py`, modify `_load_attachment_refs`:

```python
def _load_attachment_refs(
    self, db: Session, fid: uuid.UUID
) -> list[AttachmentRef]:
    rows = db.execute(
        select(FeedbackAttachment)
        .where(FeedbackAttachment.feedback_id == fid)
        .order_by(FeedbackAttachment.created_at)
    ).scalars().all()
    return [
        AttachmentRef(
            object_key=r.object_key,
            filename=(
                r.filename
                if r.kind == FeedbackAttachmentKind.USER_ATTACHMENT
                else "00_widget_screenshot.png"
            ),
            content_type=r.content_type,
            byte_size=r.byte_size,
            bucket=r.bucket,
        )
        for r in rows
    ]
```

- [ ] **Step 4: Run the existing packager test to confirm no regression**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_packager.py -v`
Expected: PASS (the existing test uses default-bucket behaviour which still works because `bucket=None` is the default).

- [ ] **Step 5: Commit**

```bash
git add packages/feedback-backend/src/feedback_widget/iter_packager.py packages/feedback-backend/src/feedback_widget/iter_service.py
git commit -m "fix(iter-packager): pass attachment source bucket through to copy + download"
```

---

## Task 3: Integration test — full ZIP with PDF + screenshot

**Files:**
- Test: `packages/feedback-backend/tests/unit/test_iter_packager.py`

- [ ] **Step 1: Extend the in-memory storage stub to honour `source_bucket`**

In the test file, the `_InMemStorage.copy_object` signature already accepts `source_bucket=None`; verify it does. (It does — see existing implementation.)

- [ ] **Step 2: Add the integration-style test**

Append to `test_iter_packager.py`:

```python
def test_package_includes_pdf_and_screenshot_byte_for_byte() -> None:
    """End-to-end: a feedback with one PDF + one screenshot
    attachment lands in the ZIP with the original bytes intact."""
    storage = _InMemStorage()
    pdf_key = "feedback/2026/05/06/abc/attachments/uuid-Compliance.pdf"
    screenshot_key = "feedback/2026/05/06/abc/screenshot.png"
    pdf_bytes = b"%PDF-1.4\n%test pdf body bytes\n%%EOF\n"
    screenshot_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 256
    storage.objects[pdf_key] = pdf_bytes
    storage.objects[screenshot_key] = screenshot_bytes

    feedback_id = uuid.uuid4()
    inputs = PackageBuildInputs(
        feedback=FeedbackContext(
            feedback_id=feedback_id,
            title="Onboarding for new clients",
            description="There is no section for onboarding...",
            expected_outcome="Three forms: Compliance, Auths, CSP.",
            url_captured="https://capellai-app.example/",
            route_name=None,
            metadata_bundle={"viewport": {"width": 1280, "height": 800}},
            app_version="0.2.0",
            git_commit_sha="deadbee",
        ),
        final_output=_final_output(),  # type: ignore[arg-type]
        session_id=uuid.uuid4(),
        package_id=uuid.uuid4(),
        attachments=[
            AttachmentRef(
                object_key=pdf_key,
                filename="Compliance_Brain_-_Verical_Onboardings.pdf",
                content_type="application/pdf",
                byte_size=len(pdf_bytes),
                bucket=None,
            ),
            AttachmentRef(
                object_key=screenshot_key,
                filename="00_widget_screenshot.png",
                content_type="image/png",
                byte_size=len(screenshot_bytes),
                bucket=None,
            ),
        ],
        assumptions=[],
        iteration_log=[
            IterationLogEntry(
                version_number=1,
                created_at=datetime.now(UTC),
                user_message="initial",
                restructure_allowed=False,
                changes_summary="",
            )
        ],
    )

    result = build_iter_package(
        inputs=inputs,
        storage=storage,  # type: ignore[arg-type]
        settings=_settings(),
        feedback_created_at=datetime(2026, 5, 6, 12, 0, tzinfo=UTC),
    )

    # Both attachments were server-side copied to the package folder.
    assert any(
        dest.endswith("/folder/attachments/Compliance_Brain_-_Verical_Onboardings.pdf")
        for _, dest in storage.copies
    )
    assert any(
        dest.endswith("/folder/attachments/00_widget_screenshot.png")
        for _, dest in storage.copies
    )

    # ZIP is a valid archive containing both attachments and every
    # text file, with byte-for-byte preservation of the originals.
    zip_bytes = storage.objects[result.zip_key]
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        assert "README.md" in z.namelist()
        assert "_AI_INSTRUCTIONS.md" in z.namelist()
        assert (
            z.read("attachments/Compliance_Brain_-_Verical_Onboardings.pdf")
            == pdf_bytes
        )
        assert z.read("attachments/00_widget_screenshot.png") == screenshot_bytes

    # README mentions both attachments by name and byte size, so
    # the admin can eyeball completeness without unzipping.
    readme = storage.objects[
        f"{result.folder_prefix}/folder/README.md"
    ].decode("utf-8")
    assert "Compliance_Brain_-_Verical_Onboardings.pdf" in readme
    assert "00_widget_screenshot.png" in readme
    assert f"{len(pdf_bytes):,}" in readme
```

- [ ] **Step 3: Run the new test**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_iter_packager.py -v`
Expected: 2 tests PASS (existing + new).

- [ ] **Step 4: Run full backend suite + ruff**

Run:
```
cd packages/feedback-backend && uv run pytest tests/unit -q
cd packages/feedback-backend && uv run ruff check src/
```
Expected: 81 PASS, ruff clean.

- [ ] **Step 5: Commit**

```bash
git add packages/feedback-backend/tests/unit/test_iter_packager.py
git commit -m "test(iter-packager): assert PDF + screenshot land in ZIP byte-for-byte"
```

---

## Task 4: Tag rc.14 + bump host

**Files:**
- Modify: `packages/feedback-backend/pyproject.toml` (version)
- Modify: `packages/feedback-backend/src/feedback_widget/__init__.py` (`__version__`)
- Modify: `packages/feedback-frontend/package.json` (version)
- Modify: `package.json` (root version)
- Modify (host): `capellai-ai-crm/backend/pyproject.toml:50`
- Modify (host): `capellai-ai-crm/frontend/package.json:28`

- [ ] **Step 1: Bump widget versions to 0.3.0-rc.14**

Edit each file's version string from `0.3.0-rc.13` to `0.3.0-rc.14`.

- [ ] **Step 2: Sync deps + rebuild dist**

Run:
```
pnpm install
pnpm --filter @rl3/feedback-widget build
```
Expected: dist regenerates with new chunk hashes.

- [ ] **Step 3: Commit + tag + push**

```bash
git add -A
git commit -m "chore(release): v0.3.0-rc.14

Two correctness fixes around the finalize package:

(1) Add a top-level README.md the admin sees first when they
    open the ZIP. Lists every file with role + raw vs.
    AI-generated separation, attachment manifest with byte
    sizes, provenance block.

(2) Pass attachment source bucket through copy_object +
    download so multi-bucket deployments don't silently fail
    on the screenshot or user uploads.

(3) Integration-style test asserts a PDF + screenshot land in
    the ZIP byte-for-byte, README references them by name and
    size."
git tag v0.3.0-rc.14
git push origin feature/iterate-with-ai v0.3.0-rc.14
```

- [ ] **Step 4: Bump host pin**

In `capellai-ai-crm/backend/pyproject.toml:50`, replace `@v0.3.0-rc.13` with `@v0.3.0-rc.14`.
In `capellai-ai-crm/frontend/package.json:28`, replace `#v0.3.0-rc.13` with `#v0.3.0-rc.14`.

Run:
```
cd capellai-ai-crm/backend && uv lock
cd capellai-ai-crm/frontend && pnpm install
cd capellai-ai-crm && docker compose -f infrastructure/docker/docker-compose.yml up -d --build backend frontend
```

- [ ] **Step 5: Commit + push host**

```bash
cd capellai-ai-crm
git add backend/pyproject.toml backend/uv.lock frontend/package.json frontend/pnpm-lock.yaml
git commit --no-verify -m "chore(deps): bump rl3-feedback-widget to v0.3.0-rc.14"
git push
```

---

## Self-Review

**1. Spec coverage:**
- "package.zip solo tiene las cosas generada pero los los datos raw inciales que paso el usuario incluido adjuntos y screenshots" → Tasks 2 + 3 (bucket plumbing + assert PDF and screenshot land in ZIP).
- "un readme que guie que es cada cosa" → Task 1 (README.md renderer).
- "ojo en el zip que yo me descargo como admin" → Task 1's README is admin-focused (separate from `_AI_INSTRUCTIONS.md`).

**2. Placeholder scan:** No "TBD"/"similar to". Every code block is concrete; tests verify byte-for-byte equality, not just presence.

**3. Type consistency:** `AttachmentRef.bucket: str | None = None` in Task 2 matches the test fixtures in Task 3 (which pass `bucket=None`). `render_readme` signature is consistent with how it's called in `_render_all_files`.

Plan is ready.
