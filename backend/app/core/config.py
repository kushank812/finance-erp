from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "finance_ap_ar"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL

        return (
            f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()