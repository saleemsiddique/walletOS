import asyncio
from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

import boto3

from app.core.config import get_settings

if TYPE_CHECKING:
    from mypy_boto3_s3.type_defs import ObjectIdentifierTypeDef

_DELETE_BATCH_SIZE = 1000


class S3Client:
    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.aws_s3_bucket
        self._client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )

    @staticmethod
    def _pdf_key(user_id: UUID, week_start: date) -> str:
        return f"{user_id}/{week_start.isoformat()}.pdf"

    async def put_pdf(self, user_id: UUID, week_start: date, pdf_bytes: bytes) -> str:
        key = self._pdf_key(user_id, week_start)
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
        return key

    async def presigned_url(self, s3_key: str, ttl: int = 3600) -> str:
        return await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self._bucket, "Key": s3_key},
            ExpiresIn=ttl,
        )

    async def delete_by_prefix(self, prefix: str) -> int:
        return await asyncio.to_thread(self._delete_by_prefix, prefix)

    def _delete_by_prefix(self, prefix: str) -> int:
        paginator = self._client.get_paginator("list_objects_v2")
        keys: list[ObjectIdentifierTypeDef] = [
            {"Key": obj["Key"]}
            for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix)
            for obj in page.get("Contents", [])
        ]
        if not keys:
            return 0

        deleted = 0
        for start in range(0, len(keys), _DELETE_BATCH_SIZE):
            batch = keys[start : start + _DELETE_BATCH_SIZE]
            self._client.delete_objects(Bucket=self._bucket, Delete={"Objects": batch})
            deleted += len(batch)
        return deleted
