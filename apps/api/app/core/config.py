from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Yao Lawyer API", alias="APP_NAME")
    app_env: str = Field(default="dev", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8080, alias="APP_PORT")
    debug: bool = Field(default=True, alias="DEBUG")

    database_url: str = Field(default="sqlite:///./data/yao_lawyer.db", alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    cors_allow_origins: str = Field(default="*", alias="CORS_ALLOW_ORIGINS")
    cors_allow_methods: str = Field(default="*", alias="CORS_ALLOW_METHODS")
    cors_allow_headers: str = Field(default="*", alias="CORS_ALLOW_HEADERS")
    cors_allow_credentials: bool = Field(default=False, alias="CORS_ALLOW_CREDENTIALS")

    jwt_secret: str = Field(default="please-change-this-secret", alias="JWT_SECRET")
    jwt_expire_hours: int = Field(default=72, alias="JWT_EXPIRE_HOURS")
    sms_code_ttl_seconds: int = Field(default=300, alias="SMS_CODE_TTL_SECONDS")

    ai_gateway_base_url: str = Field(default="", alias="AI_GATEWAY_BASE_URL")
    ai_gateway_api_key: str = Field(default="", alias="AI_GATEWAY_API_KEY")
    ai_gateway_timeout_seconds: int = Field(default=15, alias="AI_GATEWAY_TIMEOUT_SECONDS")
    ai_model_high: str = Field(default="gpt-4o-mini", alias="AI_MODEL_HIGH")
    ai_model_low: str = Field(default="gpt-4o-mini", alias="AI_MODEL_LOW")

    rate_limit_window_seconds: int = Field(default=60, alias="RATE_LIMIT_WINDOW_SECONDS")
    rate_limit_requests_per_window: int = Field(default=40, alias="RATE_LIMIT_REQUESTS_PER_WINDOW")
    queue_eta_seconds: int = Field(default=45, alias="QUEUE_ETA_SECONDS")
    free_chat_quota: int = Field(default=10, alias="FREE_CHAT_QUOTA")
    free_report_quota: int = Field(default=1, alias="FREE_REPORT_QUOTA")

    @property
    def is_dev(self) -> bool:
        return self.app_env.lower() in {"dev", "local", "test"}

    @staticmethod
    def _parse_csv(value: str) -> list[str]:
        cleaned = value.strip()
        if cleaned == "*":
            return ["*"]
        return [item.strip() for item in cleaned.split(",") if item.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return self._parse_csv(self.cors_allow_origins)

    @property
    def cors_methods(self) -> list[str]:
        return self._parse_csv(self.cors_allow_methods)

    @property
    def cors_headers(self) -> list[str]:
        return self._parse_csv(self.cors_allow_headers)

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            return f"postgresql+psycopg://{url.removeprefix('postgres://')}"
        if url.startswith("postgresql://"):
            return f"postgresql+psycopg://{url.removeprefix('postgresql://')}"
        return url
    def ensure_runtime_dirs(self) -> None:
        if self.database_url.startswith("sqlite:///"):
            db_path = Path(self.database_url.replace("sqlite:///", "", 1))
            db_path.parent.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_runtime_dirs()
