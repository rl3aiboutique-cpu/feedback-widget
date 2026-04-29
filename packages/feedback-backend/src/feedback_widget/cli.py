"""CLI for the feedback widget.

Invoke as ``python -m feedback_widget <command>`` (or
``feedback-widget <command>`` once the entry-point is installed).

Commands:

* ``migrate``        — apply the widget's Alembic migrations.
* ``version``        — print the installed package version.
* ``check-config``   — validate the current settings + DB connectivity.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import typer
from alembic import command
from alembic.config import Config

from feedback_widget import __version__
from feedback_widget.settings import get_settings

logger = logging.getLogger(__name__)

app = typer.Typer(
    add_completion=False,
    help="rl3-feedback-widget CLI",
    no_args_is_help=True,
)


def _alembic_config(database_url: str | None) -> Config:
    """Build an Alembic ``Config`` pointing at the package's bundled migrations."""
    here = Path(__file__).parent
    cfg = Config(str(here / "alembic.ini"))
    cfg.set_main_option("script_location", str(here / "alembic"))
    if database_url:
        cfg.set_main_option("sqlalchemy.url", database_url)
    return cfg


def run_migrations(database_url: str | None = None) -> None:
    """Apply migrations up to head. Pure function for programmatic callers."""
    settings = get_settings()
    url = database_url or settings.DATABASE_URL
    if not url:
        msg = (
            "Database URL not provided: pass --database-url or set "
            "FEEDBACK_DATABASE_URL in the environment."
        )
        raise SystemExit(msg)
    cfg = _alembic_config(url)
    command.upgrade(cfg, "head")
    logger.info("feedback_widget: migrations applied (head)")


@app.command(name="migrate")
def cmd_migrate(
    database_url: str | None = typer.Option(
        None,
        "--database-url",
        "-u",
        help="Override FEEDBACK_DATABASE_URL.",
    ),
) -> None:
    """Apply the widget's Alembic migrations."""
    run_migrations(database_url=database_url)
    typer.echo("migrations applied")


@app.command(name="version")
def cmd_version() -> None:
    """Print the installed package version."""
    typer.echo(__version__)


@app.command(name="check-config")
def cmd_check_config() -> None:
    """Print the resolved settings (sensitive values redacted)."""
    settings = get_settings()
    typer.echo(f"feedback_widget {__version__}")
    typer.echo(f"  ENABLED              = {settings.ENABLED}")
    typer.echo(f"  MULTI_TENANT_MODE    = {settings.MULTI_TENANT_MODE}")
    typer.echo(f"  CSRF_REQUIRED        = {settings.CSRF_REQUIRED}")
    typer.echo(f"  BUCKET               = {settings.BUCKET}")
    typer.echo(f"  S3_ENDPOINT_URL      = {settings.S3_ENDPOINT_URL}")
    typer.echo(f"  SMTP_HOST            = {settings.SMTP_HOST}")
    typer.echo(f"  SMTP_PORT            = {settings.SMTP_PORT}")
    typer.echo(f"  emails_enabled       = {settings.emails_enabled}")
    typer.echo(f"  notify_emails        = {settings.notify_emails_list}")
    typer.echo(f"  RATE_LIMIT_PER_HOUR  = {settings.RATE_LIMIT_PER_HOUR}")
    typer.echo(f"  MAX_SCREENSHOT_BYTES = {settings.MAX_SCREENSHOT_BYTES}")
    typer.echo(f"  BRAND_NAME           = {settings.BRAND_NAME!r}")
    typer.echo(f"  ADMIN_DEEP_LINK_BASE = {settings.ADMIN_DEEP_LINK_BASE!r}")
    typer.echo(f"  REPO_URL             = {settings.REPO_URL!r}")
    if not settings.DATABASE_URL:
        typer.echo("  DATABASE_URL         = (unset)", err=True)
    else:
        typer.echo("  DATABASE_URL         = (set; redacted)")


def main(argv: list[str] | None = None) -> None:  # pragma: no cover — entry point
    if argv is not None:
        sys.argv = ["feedback-widget", *argv]
    app()


if __name__ == "__main__":  # pragma: no cover
    main()
