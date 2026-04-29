"""Allow ``python -m feedback_widget`` to dispatch the CLI."""

from feedback_widget.cli import app

if __name__ == "__main__":  # pragma: no cover
    app()
