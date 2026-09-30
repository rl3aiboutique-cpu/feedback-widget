"""JWT verification must not bring the unpatched pure-Python ECDSA implementation."""

from importlib.metadata import requires


def test_jwt_dependencies_do_not_require_python_jose() -> None:
    dependencies = requires("rl3-feedback-widget") or []
    assert not any(requirement.lower().startswith("python-jose") for requirement in dependencies)
