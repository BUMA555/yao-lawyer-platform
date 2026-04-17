from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.middleware import RequestContextMiddleware
from app.db.init_data import seed_plans
from app.db.session import Base, SessionLocal, engine
from app.models import entities as _entities  # noqa: F401
from app.services.metrics import log_event


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(RequestContextMiddleware)
    app.include_router(api_router)

    @app.on_event("startup")
    def on_startup() -> None:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_plans(db)

    @app.get("/healthz")
    def health() -> dict:
        return {"ok": True, "service": settings.app_name}

    @app.middleware("http")
    async def access_event_logger(request: Request, call_next):
        response = await call_next(request)
        request_id = getattr(request.state, "request_id", "")
        elapsed_ms = getattr(request.state, "elapsed_ms", 0.0)
        path = request.url.path
        method = request.method
        try:
            with SessionLocal() as db:
                log_event(
                    db=db,
                    request_id=request_id,
                    user_id="",
                    event_type="request.access",
                    meta={"path": path, "method": method, "status_code": response.status_code, "elapsed_ms": elapsed_ms},
                )
        except Exception:
            # Non-blocking best-effort logging
            pass
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "")
        return JSONResponse(
            status_code=500,
            content={"request_id": request_id, "ok": False, "message": "internal_error", "detail": str(exc)},
        )

    return app


app = create_app()
