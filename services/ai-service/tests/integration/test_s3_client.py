import time
from collections.abc import Iterator
from datetime import date
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import boto3
import pytest
from moto import mock_aws

from app.clients.s3_client import S3Client

_BUCKET = "walletos-exports-test"
_REGION = "eu-west-1"


def _ttl_matches(url: str, ttl: int) -> bool:
    query = parse_qs(urlparse(url).query)
    if "X-Amz-Expires" in query:  # SigV4: expiración relativa
        return query["X-Amz-Expires"][0] == str(ttl)
    if "Expires" in query:  # SigV2: timestamp absoluto (now + ttl)
        return abs(int(query["Expires"][0]) - (time.time() + ttl)) < 120
    return False


@pytest.fixture
def s3_backend() -> Iterator[object]:
    with mock_aws():
        client = boto3.client("s3", region_name=_REGION)
        client.create_bucket(
            Bucket=_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": _REGION},
        )
        yield client


async def test_put_pdf_stores_at_expected_key(s3_backend) -> None:
    user_id = uuid4()
    pdf = b"%PDF-1.4 contenido"

    key = await S3Client().put_pdf(user_id, date(2026, 4, 13), pdf)

    assert key == f"{user_id}/2026-04-13.pdf"
    stored = s3_backend.get_object(Bucket=_BUCKET, Key=key)
    assert stored["Body"].read() == pdf
    assert stored["ContentType"] == "application/pdf"


async def test_presigned_url_includes_key_and_ttl(s3_backend) -> None:
    url = await S3Client().presigned_url("user-a/2026-04-13.pdf", ttl=1800)

    assert "user-a/2026-04-13.pdf" in url
    assert _ttl_matches(url, 1800)


async def test_delete_by_prefix_only_removes_matching_objects(s3_backend) -> None:
    for key in ("user-a/1.pdf", "user-a/2.pdf", "user-b/1.pdf"):
        s3_backend.put_object(Bucket=_BUCKET, Key=key, Body=b"x")

    deleted = await S3Client().delete_by_prefix("user-a/")

    assert deleted == 2
    remaining = s3_backend.list_objects_v2(Bucket=_BUCKET).get("Contents", [])
    assert {obj["Key"] for obj in remaining} == {"user-b/1.pdf"}
