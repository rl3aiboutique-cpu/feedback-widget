"""CLI for the feedback widget.

Invoke as ``python -m feedback_widget <command>`` (or
``feedback-widget <command>`` once the entry-point is installed).

Commands:

* ``migrate``        — apply the widget's Alembic migrations.
* ``version``        — print the installed package version.
* ``check-config``   — print the resolved settings (sensitive values redacted).
* ``verify``         — actively probe DB / S3 / SMTP and report green/red.
* ``drop-tables``    — destructively drop the widget's tables. Requires --yes.
* ``init``           — print integration stubs (backend wiring + frontend mount + env).
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


@app.command(name="verify")
def cmd_verify() -> None:
    """Actively probe DB / S3 / SMTP connectivity. Exit 0 only if all green."""
    from rich.console import Console
    from rich.table import Table

    settings = get_settings()
    console = Console()
    table = Table(title="feedback-widget connectivity check")
    table.add_column("Component")
    table.add_column("Status")
    table.add_column("Detail")

    failures: list[str] = []

    # Postgres
    if not settings.DATABASE_URL:
        table.add_row("postgres", "[red]FAIL[/red]", "FEEDBACK_DATABASE_URL not set")
        failures.append("postgres")
    else:
        try:
            from sqlalchemy import create_engine, text

            eng = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
            with eng.connect() as c:
                c.execute(text("SELECT 1"))
            table.add_row("postgres", "[green]OK[/green]", "SELECT 1 succeeded")
        except Exception as exc:  # noqa: BLE001 — surface any connectivity error to user
            table.add_row("postgres", "[red]FAIL[/red]", str(exc)[:120])
            failures.append("postgres")

    # S3
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
        )
        try:
            s3.head_bucket(Bucket=settings.BUCKET)
            table.add_row("s3 bucket", "[green]OK[/green]", f"head_bucket {settings.BUCKET}")
        except (BotoCoreError, ClientError) as exc:
            table.add_row("s3 bucket", "[red]FAIL[/red]", str(exc)[:120])
            failures.append("s3")
    except Exception as exc:  # noqa: BLE001
        table.add_row("s3 bucket", "[red]FAIL[/red]", str(exc)[:120])
        failures.append("s3")

    # SMTP
    try:
        import smtplib

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as smtp:
            smtp.noop()
        table.add_row("smtp", "[green]OK[/green]", f"{settings.SMTP_HOST}:{settings.SMTP_PORT}")
    except Exception as exc:  # noqa: BLE001
        table.add_row("smtp", "[red]FAIL[/red]", str(exc)[:120])
        failures.append("smtp")

    console.print(table)
    if failures:
        console.print(f"\n[red]{len(failures)} check(s) failed: {', '.join(failures)}[/red]")
        raise typer.Exit(code=1)
    console.print("\n[bold green]all checks passed[/bold green]")


@app.command(name="drop-tables")
def cmd_drop_tables(
    yes: bool = typer.Option(False, "--yes", help="Skip confirmation prompt."),
) -> None:
    """Destructively drop the widget's tables. Use during uninstall."""
    settings = get_settings()
    if not settings.DATABASE_URL:
        typer.echo("FEEDBACK_DATABASE_URL not set", err=True)
        raise typer.Exit(code=1)
    if not yes:
        confirmed = typer.confirm(
            "This will DROP tables: feedback, feedback_attachment, "
            "feedback_widget_alembic_version. Continue?"
        )
        if not confirmed:
            typer.echo("aborted")
            raise typer.Exit(code=1)

    from sqlalchemy import create_engine, text

    eng = create_engine(settings.DATABASE_URL)
    with eng.begin() as c:
        for tbl in ("feedback_attachment", "feedback", "feedback_widget_alembic_version"):
            c.execute(text(f'DROP TABLE IF EXISTS "{tbl}" CASCADE'))
    typer.echo("widget tables dropped")


@app.command(name="init")
def cmd_init() -> None:
    """Print integration stubs (backend wiring + frontend mount + env vars)."""
    typer.echo(
        """
== Backend wiring ==
Add to your `app/api/main.py` (or equivalent FastAPI bootstrap):

    from feedback_widget import register_feedback_router
    from feedback_widget.adapters import JWTBearerAuth
    from app.core.config import settings  # your host's settings

    register_feedback_router(
        app,
        auth=JWTBearerAuth(secret_key=settings.SECRET_KEY, algorithm="HS256"),
        engine=engine,  # your sync SQLAlchemy engine — see ADR-006
    )

== Frontend mount ==
Wrap (or place near) the React root with:

    import { FeedbackProvider } from "@rl3/feedback-widget";

    <FeedbackProvider apiBaseUrl="/api/v1" authHeader={() => `Bearer ${getToken()}`}>
        <App />
    </FeedbackProvider>

== Minimum env vars ==

    FEEDBACK_DATABASE_URL=postgresql+psycopg://USER:PASS@host:5432/DB
    FEEDBACK_S3_ENDPOINT_URL=http://minio:9000
    FEEDBACK_S3_ACCESS_KEY=...
    FEEDBACK_S3_SECRET_KEY=...
    FEEDBACK_BUCKET=feedback
    FEEDBACK_SMTP_HOST=mailhog
    FEEDBACK_SMTP_PORT=1025
    FEEDBACK_EMAILS_FROM_EMAIL=feedback@yourhost.com

After setting env: run `feedback-widget verify` (must exit 0), then
`feedback-widget migrate`. Restart the host backend.
"""
    )


def main(argv: list[str] | None = None) -> None:  # pragma: no cover — entry point
    if argv is not None:
        sys.argv = ["feedback-widget", *argv]
    app()


if __name__ == "__main__":  # pragma: no cover
    main()
