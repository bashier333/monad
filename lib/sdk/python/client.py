"""Decision Memory Python SDK (R-028) — minimal typed client for API v2.
Standard library only (urllib); covers the shipped v2 surface.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional

SDK_VERSION = "2.0.0"


class ApiError(Exception):
    def __init__(self, code: str, message: str, request_id: str):
        super().__init__(f"[{code}] {message} ({request_id})")
        self.code = code
        self.request_id = request_id


@dataclass
class Envelope:
    data: Any
    request_id: str
    api_version: str
    meta: dict


class DecisionMemory:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def get_answer(self, pack: str = "freight", week: Optional[str] = None) -> Envelope:
        params: dict[str, str] = {"pack": pack}
        if week:
            params["week"] = week
        return self._get("/api/v2/answers", params)

    def get_imports(self, limit: int = 50, cursor: Optional[str] = None, week: Optional[str] = None) -> Envelope:
        params: dict[str, str] = {"limit": str(limit)}
        if cursor:
            params["cursor"] = cursor
        if week:
            params["week"] = week
        return self._get("/api/v2/imports", params)

    def _get(self, path: str, params: dict[str, str]) -> Envelope:
        qs = urllib.parse.urlencode({k: v for k, v in params.items() if v})
        url = f"{self.base_url}{path}?{qs}" if qs else f"{self.base_url}{path}"
        req = urllib.request.Request(url, headers={"X-API-Key": self.api_key})
        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode("utf-8"))
        if "error" in body:
            err = body["error"]
            raise ApiError(err.get("code", "?"), err.get("message", "?"), err.get("requestId", "?"))
        meta = body.get("meta", {})
        return Envelope(data=body.get("data"), request_id=meta.get("requestId", "?"), api_version=meta.get("apiVersion", "?"), meta=meta)
