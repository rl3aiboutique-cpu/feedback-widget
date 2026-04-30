"""FastAPI dependency factories.

The widget's router builds its dependencies by calling
:func:`build_dependencies` once at registration time (inside
:func:`register_feedback_router`) — the result is a small bundle of
``Depends(...)``-friendly callables. This keeps the auth-adapter +
engine + settings injection out of every endpoint signature.

NOTE: this module intentionally does NOT use ``from __future__ import
annotations``. FastAPI's OpenAPI generator calls ``get_type_hints()`` on
the closure-captured ``_get_current_admin`` to resolve its
``Annotated[CurrentUserSnapshot, Depends(_get_current_user)]`` parameter.
Because ``_get_current_user`` is local to ``build_dependencies`` (not
module-scoped), the lazy ForwardRef-resolution that ``__future__``
imports trigger fails with ``PydanticUserError: ... is not fully
defined``. Keeping annotations eager avoids that — see
``tests/integration/test_openapi_schema.py`` for the regression test.
"""

from collections.abc import Callable, Generator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.engine import Engine
from sqlmodel import Session

from feedback_widget.auth import CurrentUserSnapshot, FeedbackAuthAdapter
from feedback_widget.settings import FeedbackSettings


@dataclass(frozen=True)
class WidgetDependencies:
    """Bundle of FastAPI dep callables closed over host adapter + engine + settings."""

    get_current_user: Callable[..., CurrentUserSnapshot]
    get_current_admin: Callable[..., CurrentUserSnapshot]
    get_session: Callable[..., Generator[Session, None, None]]
    get_settings: Callable[..., FeedbackSettings]


def build_dependencies(
    auth: FeedbackAuthAdapter,
    engine: Engine,
    settings: FeedbackSettings,
) -> WidgetDependencies:
    """Build the dependency callables for the router.

    The callables capture ``auth``, ``engine``, and ``settings`` in a
    closure so each endpoint resolves to the right host configuration
    even when multiple ``register_feedback_router`` calls coexist
    (multi-app processes).
    """

    def _get_settings() -> FeedbackSettings:
        return settings

    def _get_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    def _get_current_user(request: Request) -> CurrentUserSnapshot:
        user = auth.get_current_user(request)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
            )
        return user

    def _get_current_admin(
        user: Annotated[CurrentUserSnapshot, Depends(_get_current_user)],
    ) -> CurrentUserSnapshot:
        if not auth.is_master_admin(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required",
            )
        return user

    return WidgetDependencies(
        get_current_user=_get_current_user,
        get_current_admin=_get_current_admin,
        get_session=_get_session,
        get_settings=_get_settings,
    )
