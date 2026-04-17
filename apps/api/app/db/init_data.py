from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Plan


DEFAULT_PLANS = [
    {
        "code": "trial-pack",
        "name": "体验包",
        "description": "首购体验，低门槛试用姚律师服务",
        "price_cents": 1990,
        "chat_credits": 20,
        "membership_days": 7,
    },
    {
        "code": "monthly-pro",
        "name": "月会员",
        "description": "月度深度咨询，含优先工单升级",
        "price_cents": 19900,
        "chat_credits": 200,
        "membership_days": 30,
    },
    {
        "code": "credit-pack-100",
        "name": "次数包100",
        "description": "按量补充，适合高频用户",
        "price_cents": 6990,
        "chat_credits": 100,
        "membership_days": 0,
    },
]


def seed_plans(db: Session) -> None:
    existing_codes = set(db.scalars(select(Plan.code)).all())
    for plan in DEFAULT_PLANS:
        if plan["code"] in existing_codes:
            continue
        db.add(
            Plan(
                code=plan["code"],
                name=plan["name"],
                description=plan["description"],
                price_cents=plan["price_cents"],
                chat_credits=plan["chat_credits"],
                membership_days=plan["membership_days"],
                currency="CNY",
                enabled=True,
            )
        )
    db.commit()

