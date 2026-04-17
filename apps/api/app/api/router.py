from __future__ import annotations

from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.billing import router as billing_router
from app.api.chat import router as chat_router
from app.api.referral import router as referral_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(referral_router)
api_router.include_router(admin_router)
api_router.include_router(billing_router)

