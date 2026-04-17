from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_sms_code, hash_sms_code
from app.models.entities import SmsCode


def issue_sms_code(db: Session, mobile: str) -> tuple[str, datetime]:
    code = generate_sms_code()
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=settings.sms_code_ttl_seconds)
    db.add(SmsCode(mobile=mobile, code_hash=hash_sms_code(mobile, code), expires_at=expires_at, consumed=False))
    db.commit()
    return code, expires_at


def verify_sms_code(db: Session, mobile: str, code: str) -> bool:
    hashed = hash_sms_code(mobile, code)
    now = datetime.now(UTC).replace(tzinfo=None)
    stmt = (
        select(SmsCode)
        .where(SmsCode.mobile == mobile)
        .where(SmsCode.code_hash == hashed)
        .where(SmsCode.consumed.is_(False))
        .order_by(SmsCode.id.desc())
    )
    record = db.scalar(stmt)
    if record is None:
        return False
    if record.expires_at < now:
        return False
    record.consumed = True
    db.add(record)
    db.commit()
    return True
