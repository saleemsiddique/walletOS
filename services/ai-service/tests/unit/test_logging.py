import json
import logging

from app.core.logging import JsonFormatter


def _make_record(level: int, msg: str, args: tuple[object, ...] = ()) -> logging.LogRecord:
    return logging.LogRecord(
        name="test",
        level=level,
        pathname=__file__,
        lineno=1,
        msg=msg,
        args=args,
        exc_info=None,
    )


def test_formatter_emits_parseable_json():
    record = _make_record(logging.INFO, "hola %s", ("mundo",))

    payload = json.loads(JsonFormatter().format(record))

    assert payload["level"] == "INFO"
    assert payload["service"] == "ai-service"
    assert payload["message"] == "hola mundo"
    assert "timestamp" in payload


def test_formatter_includes_extra_when_present():
    record = _make_record(logging.WARNING, "evento")
    record.extra = {"user_id": "abc"}

    payload = json.loads(JsonFormatter().format(record))

    assert payload["extra"] == {"user_id": "abc"}
