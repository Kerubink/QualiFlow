"""Relogio compartilhado: timestamps ISO-8601 em UTC usados em logs."""
from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
