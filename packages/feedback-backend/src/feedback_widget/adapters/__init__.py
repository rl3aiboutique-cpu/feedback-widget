"""Adapters hosts can use to wire the widget into their auth.

Today only ``JWTBearerAuth`` is provided — a decode-only HS256 adapter
suitable for FastAPI fullstack template hosts. Hosts that need richer
behaviour (e.g. DB lookup of the user) should write their own adapter
implementing the :class:`~feedback_widget.auth.FeedbackAuthAdapter`
Protocol; ``JWTBearerAuth`` is the canonical reference implementation.
"""

from feedback_widget.adapters.jwt_bearer import JWTBearerAuth

__all__ = ["JWTBearerAuth"]
