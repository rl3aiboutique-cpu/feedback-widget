"""Object-storage clients for the feedback widget.

The router and service speak to a thin :class:`StorageBackend` that
wraps boto3 against any S3-compatible store (MinIO in dev, AWS in
production). The public surface is :class:`StorageBackend` and
:func:`get_storage_backend` (settings-driven factory).
"""

from feedback_widget.storage.s3 import StorageBackend, get_storage_backend

__all__ = ["StorageBackend", "get_storage_backend"]
