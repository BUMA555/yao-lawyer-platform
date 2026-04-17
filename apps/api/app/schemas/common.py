from __future__ import annotations

from pydantic import BaseModel


class ApiResponse(BaseModel):
    request_id: str
    ok: bool = True
    message: str = "ok"

