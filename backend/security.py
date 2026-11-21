from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl


@dataclass(frozen=True, slots=True)
class InitDataValidationResult:
    ok: bool
    user: dict | None = None
    auth_date: int | None = None
    error: str | None = None


class InitDataValidator:
    def __init__(self, bot_token: str, max_age: int) -> None:
        self._bot_token = bot_token
        self._max_age = max_age

    def validate(self, init_data: str) -> InitDataValidationResult:
        if not init_data or not self._bot_token:
            return InitDataValidationResult(ok=False, error="invalid_init_data")

        try:
            parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        except Exception:
            return InitDataValidationResult(ok=False, error="invalid_init_data")

        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return InitDataValidationResult(ok=False, error="invalid_init_data")

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", self._bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated_hash, received_hash):
            return InitDataValidationResult(ok=False, error="invalid_init_data")

        try:
            auth_date = int(parsed.get("auth_date", "0"))
        except ValueError:
            return InitDataValidationResult(ok=False, error="invalid_init_data")

        if self._max_age and time.time() - auth_date > self._max_age:
            return InitDataValidationResult(ok=False, error="expired_init_data")

        user = self._parse_user(parsed.get("user"))
        return InitDataValidationResult(ok=True, user=user, auth_date=auth_date)

    @staticmethod
    def _parse_user(raw: str | None) -> dict | None:
        if not raw:
            return None
        try:
            data = json.loads(raw)
        except Exception:
            return None
        return data if isinstance(data, dict) else None
