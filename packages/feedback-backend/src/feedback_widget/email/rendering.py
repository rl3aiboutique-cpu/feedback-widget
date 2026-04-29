"""Jinja environment for email templates.

Templates live alongside this module in ``app/emails/templates/``. Per-feature
modules (e.g. ``app/feedback``) drop their own ``*.html`` / ``*.txt`` files
into the same directory so a single Jinja env loader finds everything.

Autoescape is enabled for any ``.html`` extension; ``.txt`` templates are
*not* escaped (plain-text fallback bodies should pass through verbatim).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATES_DIR = Path(__file__).parent / "templates"

_env: Environment | None = None


def get_env() -> Environment:
    """Return the lazy-built Jinja environment for email templates."""
    global _env
    if _env is None:
        _env = Environment(
            loader=FileSystemLoader(_TEMPLATES_DIR),
            autoescape=select_autoescape(enabled_extensions=("html",)),
            trim_blocks=True,
            lstrip_blocks=True,
        )
    return _env


def render_template(template_name: str, **context: Any) -> str:
    """Render the named template with the given context.

    The template can live in this module's ``templates/`` directory or in
    any sibling feature module that places its files there.
    """
    return get_env().get_template(template_name).render(**context)
