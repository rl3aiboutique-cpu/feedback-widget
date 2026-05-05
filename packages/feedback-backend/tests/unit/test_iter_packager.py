"""Unit tests for the iter packager.

Hits an in-memory storage stand-in (no MinIO) to verify:

* All 8 markdown files (incl. ``_AI_INSTRUCTIONS.md``) end up under
  the expected folder prefix.
* The ZIP entry list matches the folder file list.
* The ``_AI_INSTRUCTIONS.md`` interpolates the configured downstream
  consumer model.
* Attachment copy-object is called with the right keys.
"""

from __future__ import annotations

import io
import uuid
import zipfile
from datetime import UTC, datetime

from feedback_widget.iter_models import FeedbackIterAssumptionStatus
from feedback_widget.iter_packager import (
    AssumptionResolution,
    AttachmentRef,
    FeedbackContext,
    IterationLogEntry,
    PackageBuildInputs,
    build_iter_package,
)
from feedback_widget.iter_parser import parse_iteration_output
from feedback_widget.iter_llm import FakeLLMProvider
from feedback_widget.settings import FeedbackSettings


class _InMemStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.copies: list[tuple[str, str]] = []

    def upload(
        self,
        *,
        key: str,
        data: bytes,
        content_type: str,
        bucket: str | None = None,
    ) -> None:
        del content_type, bucket
        self.objects[key] = data

    def download(self, key: str, *, bucket: str | None = None) -> bytes:
        del bucket
        return self.objects.get(key, b"")

    def copy_object(
        self,
        *,
        source_key: str,
        dest_key: str,
        bucket: str | None = None,
        source_bucket: str | None = None,
    ) -> None:
        del bucket, source_bucket
        self.copies.append((source_key, dest_key))
        # Mirror the copy in-memory so subsequent download() works.
        if source_key in self.objects:
            self.objects[dest_key] = self.objects[source_key]


def _settings() -> FeedbackSettings:
    s = FeedbackSettings()
    object.__setattr__(s, "ITER_DOWNSTREAM_CONSUMER_MODEL", "claude-opus-4-7")
    return s


def _final_output() -> object:
    """Fresh canned IterationOutput for a synthetic session."""
    import asyncio

    fake = FakeLLMProvider()
    raw = asyncio.run(
        fake.generate(
            system_prompt="SYS",
            user_prompt="USR",
            attachments=[],
            timeout_seconds=5,
            max_output_tokens=4_000,
        )
    )
    return parse_iteration_output(raw.raw_text, restructure_allowed=False)


def test_package_builds_all_required_files() -> None:
    storage = _InMemStorage()
    # Pre-populate one fake attachment so copy_object has something
    # to mirror.
    storage.objects["feedback/2026/05/05/abc/screenshot.png"] = b"\x89PNG\r\n\x1a\n"

    feedback_id = uuid.uuid4()
    inputs = PackageBuildInputs(
        feedback=FeedbackContext(
            feedback_id=feedback_id,
            title="T",
            description="D",
            expected_outcome=None,
            url_captured="http://x",
            route_name=None,
            metadata_bundle={"viewport": {"width": 1280, "height": 800}},
            app_version="0.1.0",
            git_commit_sha="abc1234",
        ),
        final_output=_final_output(),  # type: ignore[arg-type]
        session_id=uuid.uuid4(),
        package_id=uuid.uuid4(),
        attachments=[
            AttachmentRef(
                object_key="feedback/2026/05/05/abc/screenshot.png",
                filename="00_widget_screenshot.png",
                content_type="image/png",
                byte_size=8,
            )
        ],
        assumptions=[
            AssumptionResolution(
                slot_key="asm_demo_user_role",
                kind="ux",
                statement="user is submitter",
                status=FeedbackIterAssumptionStatus.CONFIRMED,
                user_response=None,
            )
        ],
        iteration_log=[
            IterationLogEntry(
                version_number=1,
                created_at=datetime.now(UTC),
                user_message="",
                restructure_allowed=False,
                changes_summary="",
            )
        ],
    )

    result = build_iter_package(
        inputs=inputs,
        storage=storage,  # type: ignore[arg-type]
        settings=_settings(),
        feedback_created_at=datetime(2026, 5, 5, 12, 0, tzinfo=UTC),
    )

    folder_keys = [
        k for k in storage.objects if k.startswith(f"{result.folder_prefix}/folder/")
    ]
    expected = {
        f"{result.folder_prefix}/folder/_AI_INSTRUCTIONS.md",
        f"{result.folder_prefix}/folder/00_context.md",
        f"{result.folder_prefix}/folder/01_personas.md",
        f"{result.folder_prefix}/folder/02_user_stories.md",
        f"{result.folder_prefix}/folder/03_spec.md",
        f"{result.folder_prefix}/folder/04_diagram.md",
        f"{result.folder_prefix}/folder/05_assumptions_resolved.md",
        f"{result.folder_prefix}/folder/06_iteration_log.md",
    }
    assert expected.issubset(set(folder_keys))

    # The attachment was copied via copy_object to the package folder.
    assert any(
        dest.endswith("/folder/attachments/00_widget_screenshot.png")
        for _, dest in storage.copies
    )

    # ZIP exists at the package root and contains every text file.
    zip_bytes = storage.objects[result.zip_key]
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        names = set(z.namelist())
    assert "_AI_INSTRUCTIONS.md" in names
    assert "00_context.md" in names
    assert "06_iteration_log.md" in names
    assert "attachments/00_widget_screenshot.png" in names

    # Consumer model interpolated.
    instructions = storage.objects[
        f"{result.folder_prefix}/folder/_AI_INSTRUCTIONS.md"
    ].decode("utf-8")
    assert "claude-opus-4-7" in instructions
