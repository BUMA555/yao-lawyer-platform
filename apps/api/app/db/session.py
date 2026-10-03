from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings


connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.sqlalchemy_database_url,
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)
Base = declarative_base()


def run_compatibility_migrations() -> None:
    with engine.begin() as connection:
        if engine.dialect.name != "sqlite":
            return

        inspector = inspect(connection)
        tables = set(inspector.get_table_names())

        if "orders" in tables:
            columns = {column["name"] for column in inspector.get_columns("orders")}
            if "idempotency_key" not in columns:
                connection.execute(text("ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(160)"))
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_user_idempotency_nonnull "
                    "ON orders (user_id, idempotency_key) "
                    "WHERE idempotency_key IS NOT NULL"
                )
            )

        if "users" in tables:
            columns = {column["name"] for column in inspector.get_columns("users")}
            if "wechat_openid" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN wechat_openid VARCHAR(80)"))
            if "wechat_unionid" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN wechat_unionid VARCHAR(80)"))
            if "login_provider" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN login_provider VARCHAR(20) DEFAULT 'mobile'"))
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_wechat_openid_nonnull "
                    "ON users (wechat_openid) "
                    "WHERE wechat_openid IS NOT NULL"
                )
            )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
