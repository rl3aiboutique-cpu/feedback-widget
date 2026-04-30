"""Alembic environment for the feedback widget.

Standalone — does NOT depend on the host's app or its config. Reads
the DB URL from the alembic Config (set by ``cli.run_migrations`` or by
the user invoking ``alembic upgrade`` directly with ``-x dburl=...``).

Uses ``version_table = 'feedback_widget_alembic_version'`` so the
package's chain coexists peacefully with the host's own Alembic chain
in the same database.

The ``include_object`` filter limits autogenerate output to tables
named ``feedback`` and ``feedback_attachment`` so the package's
migrations never touch host tables even when running against a shared
SQLModel.metadata.
"""

from __future__ import annotations

from logging.config import fileConfig

# Import the package models so SQLModel.metadata knows about them.
import feedback_widget.models  # noqa: F401
from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

_PACKAGE_TABLES = {"feedback", "feedback_attachment"}


def _include_object(
    object_: object,
    name: str | None,
    type_: str,
    reflected: bool,  # noqa: ARG001
    compare_to: object,  # noqa: ARG001
) -> bool:
    """Limit autogenerate to the package's own tables."""
    if type_ == "table":
        return name in _PACKAGE_TABLES
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table="feedback_widget_alembic_version",
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table="feedback_widget_alembic_version",
            include_object=_include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
