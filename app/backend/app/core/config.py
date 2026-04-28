from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Billing System API"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    tax_rate: float = 0.07
    low_stock_threshold: int = 10
    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[3] / 'data' / 'billing.db'}"

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[3] / ".env", env_file_encoding="utf-8", case_sensitive=False)


settings = Settings()
