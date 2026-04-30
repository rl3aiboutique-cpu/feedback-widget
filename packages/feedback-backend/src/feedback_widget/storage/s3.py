"""Thin S3-compatible storage client (boto3) for screenshot upload / presign.

Designed to work against either AWS S3 or MinIO. The presign endpoint
URL can be overridden via ``FEEDBACK_S3_PUBLIC_ENDPOINT_URL`` so the
URL emailed to the submitter is reachable from the public internet
even when the in-cluster endpoint is private.

The public methods (``upload``, ``download``, ``delete``,
``presigned_url``, ``ensure_bucket``) accept an optional ``bucket``
parameter; when omitted, ``settings.BUCKET`` is used. This matches the
shape the existing service/bundle code calls into.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from feedback_widget.settings import FeedbackSettings

logger = logging.getLogger(__name__)


@dataclass
class StorageBackend:
    """S3-compatible storage operations the widget needs."""

    settings: FeedbackSettings

    def _client(self, *, public: bool = False) -> object:
        """Return a boto3 client bound to either the in-cluster or public endpoint."""
        endpoint = self.settings.s3_public_endpoint if public else self.settings.S3_ENDPOINT_URL
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self.settings.S3_ACCESS_KEY,
            aws_secret_access_key=self.settings.S3_SECRET_KEY,
            region_name=self.settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )

    def _resolve_bucket(self, bucket: str | None) -> str:
        return bucket or self.settings.BUCKET

    def ensure_bucket(self, *, bucket: str | None = None) -> None:
        """Create the configured bucket if it does not exist."""
        client = self._client()
        name = self._resolve_bucket(bucket)
        try:
            client.head_bucket(Bucket=name)  # type: ignore[attr-defined]
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchBucket"}:
                logger.info("creating storage bucket %s", name)
                client.create_bucket(Bucket=name)  # type: ignore[attr-defined]
            else:
                raise

    def upload(
        self,
        *,
        key: str,
        data: bytes,
        content_type: str,
        bucket: str | None = None,
    ) -> None:
        """Upload a blob under ``key`` in the bucket (or the configured default)."""
        client = self._client()
        client.put_object(  # type: ignore[attr-defined]
            Bucket=self._resolve_bucket(bucket),
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    def download(self, key: str, *, bucket: str | None = None) -> bytes:
        """Download the bytes at ``key``."""
        client = self._client()
        resp = client.get_object(Bucket=self._resolve_bucket(bucket), Key=key)  # type: ignore[attr-defined]
        return resp["Body"].read()  # type: ignore[no-any-return]

    def delete(self, key: str, *, bucket: str | None = None) -> None:
        """Delete the blob at ``key`` (idempotent)."""
        client = self._client()
        try:
            client.delete_object(Bucket=self._resolve_bucket(bucket), Key=key)  # type: ignore[attr-defined]
        except ClientError:
            logger.exception("storage delete failed for key=%s", key)

    def presigned_url(
        self,
        *,
        key: str,
        expires: int | None = None,
        bucket: str | None = None,
    ) -> str:
        """Return a presigned GET URL for ``key`` valid for ``expires`` seconds.

        Uses the public endpoint so the URL is reachable by the email
        recipient even when the in-cluster endpoint is private.
        """
        client = self._client(public=True)
        ttl = expires if expires is not None else self.settings.PRESIGNED_TTL_SECONDS
        return client.generate_presigned_url(  # type: ignore[attr-defined,no-any-return]
            "get_object",
            Params={"Bucket": self._resolve_bucket(bucket), "Key": key},
            ExpiresIn=ttl,
        )


def get_storage_backend(settings: FeedbackSettings) -> StorageBackend:
    """Settings-driven factory."""
    return StorageBackend(settings=settings)
