from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Plan


DEFAULT_PLANS = [
    {
        "code": "monthly-9-9",
        "name": "9.9 月付算力",
        "description": "低门槛月付，适合持续向姚律师追问和生成基础结果卡",
        "price_cents": 990,
        "chat_credits": 80,
        "membership_days": 30,
    },
    {
        "code": "credit-pack-30",
        "name": "算力包 30",
        "description": "临时补充算力，适合一次复杂问题或短期集中追问",
        "price_cents": 990,
        "chat_credits": 30,
        "membership_days": 0,
    },
    {
        "code": "credit-pack-100",
        "name": "算力包 100",
        "description": "高频使用补充包，适合连续咨询、深度分析和材料整理",
        "price_cents": 2990,
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
